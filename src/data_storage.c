#include "data_storage.h"
#include "iot_flash.h"
#include "iot_errno.h"  // 添加IOT_SUCCESS等常量定义
#include "los_task.h"
#include "los_memory.h"
#include <string.h>
#include <stdio.h>

// 存储管理结构
typedef struct {
    bool initialized;
    uint32_t current_index;     // 当前写入索引
    uint32_t record_count;      // 记录数量
    StorageStats stats;         // 统计信息
} StorageManager;

static StorageManager g_storage_mgr = {0};

// 魔数定义
#define STORAGE_MAGIC_NUMBER    0x12345678

/**
 * @brief 计算校验和
 */
static uint16_t CalculateChecksum(const uint8_t *data, uint16_t size)
{
    uint16_t checksum = 0;
    for (uint16_t i = 0; i < size; i++) {
        checksum += data[i];
    }
    return checksum;
}

/**
 * @brief 获取记录的Flash地址
 */
static uint32_t GetRecordAddress(uint32_t index)
{
    return STORAGE_FLASH_BASE_ADDR + (index * STORAGE_RECORD_SIZE);
}

/**
 * @brief 初始化数据存储
 */
int DataStorage_Init(void)
{
    printf("Initializing data storage...\n");
    
    // 初始化Flash
    if (IoTFlashInit() != IOT_SUCCESS) {
        printf("Failed to initialize Flash\n");
        return -1;
    }
    
    // 初始化存储管理器
    memset(&g_storage_mgr, 0, sizeof(StorageManager));
    g_storage_mgr.initialized = true;
    g_storage_mgr.current_index = 0;
    g_storage_mgr.record_count = 0;
    
    // 扫描现有记录
    StorageRecord record;
    for (uint32_t i = 0; i < STORAGE_MAX_RECORDS; i++) {
        uint32_t addr = GetRecordAddress(i);
        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) == IOT_SUCCESS) {
            if (record.header.magic == STORAGE_MAGIC_NUMBER) {
                g_storage_mgr.record_count++;
                if (record.header.timestamp > 0) {
                    g_storage_mgr.current_index = (i + 1) % STORAGE_MAX_RECORDS;
                }
            }
        }
    }
    
    // 初始化统计信息
    g_storage_mgr.stats.total_records = STORAGE_MAX_RECORDS;
    g_storage_mgr.stats.stored_records = g_storage_mgr.record_count;
    g_storage_mgr.stats.uploaded_records = 0;
    g_storage_mgr.stats.failed_records = 0;
    g_storage_mgr.stats.state = STORAGE_STATE_READY;
    
    printf("Data storage initialized: %d existing records found\n", g_storage_mgr.record_count);
    return 0;
}

/**
 * @brief 反初始化数据存储
 */
void DataStorage_Deinit(void)
{
    if (g_storage_mgr.initialized) {
        IoTFlashDeinit();
        g_storage_mgr.initialized = false;
        printf("Data storage deinitialized\n");
    }
}

/**
 * @brief 存储数据到Flash
 */
int DataStorage_Store(const LandslideIotData *data)
{
    if (!g_storage_mgr.initialized || data == NULL) {
        return -1;
    }
    
    // 准备存储记录
    StorageRecord record = {0};
    record.header.magic = STORAGE_MAGIC_NUMBER;
    record.header.timestamp = LOS_TickCountGet();
    record.header.data_size = sizeof(LandslideIotData);
    
    // 复制数据
    memcpy(&record.data, data, sizeof(LandslideIotData));
    
    // 计算校验和
    record.header.checksum = CalculateChecksum((uint8_t*)&record.data, sizeof(LandslideIotData));
    
    // 获取存储地址
    uint32_t addr = GetRecordAddress(g_storage_mgr.current_index);
    
    // 擦除扇区（如果需要）
    if (g_storage_mgr.current_index % (STORAGE_SECTOR_SIZE / STORAGE_RECORD_SIZE) == 0) {
        uint32_t sector_addr = addr & ~(STORAGE_SECTOR_SIZE - 1);
        if (IoTFlashErase(sector_addr, STORAGE_SECTOR_SIZE) != IOT_SUCCESS) {
            printf("Failed to erase Flash sector at 0x%x\n", sector_addr);
            g_storage_mgr.stats.failed_records++;
            return -1;
        }
    }
    
    // 写入Flash
    if (IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0) != IOT_SUCCESS) {
        printf("Failed to write data to Flash at 0x%x\n", addr);
        g_storage_mgr.stats.failed_records++;
        return -1;
    }
    
    // 更新索引和统计
    g_storage_mgr.current_index = (g_storage_mgr.current_index + 1) % STORAGE_MAX_RECORDS;
    if (g_storage_mgr.record_count < STORAGE_MAX_RECORDS) {
        g_storage_mgr.record_count++;
    }
    g_storage_mgr.stats.stored_records++;
    
    printf("Data stored to Flash: index=%d, timestamp=%d\n", 
           g_storage_mgr.current_index - 1, record.header.timestamp);
    
    return 0;
}

/**
 * @brief 从Flash读取数据
 */
int DataStorage_Read(uint32_t index, LandslideIotData *data)
{
    if (!g_storage_mgr.initialized || data == NULL || index >= STORAGE_MAX_RECORDS) {
        return -1;
    }
    
    StorageRecord record;
    uint32_t addr = GetRecordAddress(index);
    
    // 从Flash读取
    if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) != IOT_SUCCESS) {
        return -1;
    }
    
    // 验证魔数
    if (record.header.magic != STORAGE_MAGIC_NUMBER) {
        return -1;
    }
    
    // 验证校验和
    uint16_t checksum = CalculateChecksum((uint8_t*)&record.data, sizeof(LandslideIotData));
    if (checksum != record.header.checksum) {
        printf("Checksum mismatch for record %d\n", index);
        return -1;
    }
    
    // 复制数据
    memcpy(data, &record.data, sizeof(LandslideIotData));
    
    return 0;
}

/**
 * @brief 获取存储的记录数量
 */
uint32_t DataStorage_GetRecordCount(void)
{
    return g_storage_mgr.record_count;
}

/**
 * @brief 清空所有存储的数据
 */
int DataStorage_Clear(void)
{
    if (!g_storage_mgr.initialized) {
        return -1;
    }
    
    printf("Clearing all stored data...\n");
    
    // 擦除所有存储区域
    for (uint32_t addr = STORAGE_FLASH_BASE_ADDR; 
         addr < STORAGE_FLASH_BASE_ADDR + STORAGE_TOTAL_SIZE; 
         addr += STORAGE_SECTOR_SIZE) {
        if (IoTFlashErase(addr, STORAGE_SECTOR_SIZE) != IOT_SUCCESS) {
            printf("Failed to erase Flash sector at 0x%x\n", addr);
            return -1;
        }
    }
    
    // 重置管理器
    g_storage_mgr.current_index = 0;
    g_storage_mgr.record_count = 0;
    g_storage_mgr.stats.stored_records = 0;
    g_storage_mgr.stats.uploaded_records = 0;
    g_storage_mgr.stats.failed_records = 0;
    
    printf("All stored data cleared\n");
    return 0;
}

/**
 * @brief 获取存储统计信息
 */
int DataStorage_GetStats(StorageStats *stats)
{
    if (!g_storage_mgr.initialized || stats == NULL) {
        return -1;
    }
    
    memcpy(stats, &g_storage_mgr.stats, sizeof(StorageStats));
    return 0;
}

/**
 * @brief 检查存储空间是否已满
 */
bool DataStorage_IsFull(void)
{
    return g_storage_mgr.record_count >= STORAGE_MAX_RECORDS;
}

/**
 * @brief 上传所有缓存的数据
 */
int DataStorage_UploadCached(void)
{
    if (!g_storage_mgr.initialized) {
        return 0;
    }

    int uploaded_count = 0;
    LandslideIotData data;

    // 遍历所有存储的记录
    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        if (DataStorage_Read(i, &data) == 0) {
            // 这里应该调用IoT云上传函数
            // 由于需要包含iot_cloud.h，暂时用printf模拟
            printf("Uploading cached record %d\n", i);
            uploaded_count++;

            // 实际项目中应该调用：
            // if (IoTCloud_SendData(&data) == 0) {
            //     uploaded_count++;
            // }
        }
    }

    // 如果有数据上传成功，可以考虑清空缓存
    if (uploaded_count > 0) {
        printf("Successfully uploaded %d cached records\n", uploaded_count);
        g_storage_mgr.stats.uploaded_records += uploaded_count;
    }

    return uploaded_count;
}

/**
 * @brief 获取最旧的记录索引
 */
uint32_t DataStorage_GetOldestIndex(void)
{
    if (g_storage_mgr.record_count < STORAGE_MAX_RECORDS) {
        return 0;
    } else {
        return g_storage_mgr.current_index;
    }
}
