#include "data_storage.h"
#include "iot_flash.h"
#include "iot_errno.h"  // 添加IOT_SUCCESS等常量定义
#include "iot_cloud.h"  // 添加IoT云上传功能
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

// 重试配置
#define MAX_RETRY_COUNT         3           // 最大重试次数
#define RETRY_DELAY_BASE_MS     1000        // 重试基础延时(毫秒)
#define UPLOAD_BATCH_SIZE       5           // 批量上传大小

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
 * @brief 查找最佳覆盖位置（优先覆盖已上传的旧数据）
 */
static uint32_t FindBestOverwriteIndex(void)
{
    StorageRecord record;
    uint32_t oldest_uploaded_index = STORAGE_MAX_RECORDS;
    uint32_t oldest_timestamp = UINT32_MAX;

    // 首先查找已上传的最旧记录
    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        uint32_t addr = GetRecordAddress(i);

        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) == IOT_SUCCESS) {
            if (record.header.magic == STORAGE_MAGIC_NUMBER &&
                record.header.upload_status == UPLOAD_STATUS_UPLOADED &&
                record.header.timestamp < oldest_timestamp) {
                oldest_timestamp = record.header.timestamp;
                oldest_uploaded_index = i;
            }
        }
    }

    // 如果找到已上传的记录，优先覆盖
    if (oldest_uploaded_index < STORAGE_MAX_RECORDS) {
        printf("Found uploaded record to overwrite at index %d\n", oldest_uploaded_index);
        return oldest_uploaded_index;
    }

    // 否则使用循环索引
    return g_storage_mgr.current_index;
}

/**
 * @brief 存储数据到Flash
 */
int DataStorage_Store(const LandslideIotData *data)
{
    if (!g_storage_mgr.initialized || data == NULL) {
        return -1;
    }

    uint32_t store_index;

    // 检查存储空间
    if (g_storage_mgr.record_count >= STORAGE_MAX_RECORDS) {
        // 存储空间已满，查找最佳覆盖位置
        store_index = FindBestOverwriteIndex();
        printf("Storage full, overwriting index %d\n", store_index);
    } else {
        // 还有空间，使用当前索引
        store_index = g_storage_mgr.current_index;
    }

    // 准备存储记录
    StorageRecord record = {0};
    record.header.magic = STORAGE_MAGIC_NUMBER;
    record.header.timestamp = LOS_TickCountGet();
    record.header.data_size = sizeof(LandslideIotData);
    record.header.upload_status = UPLOAD_STATUS_PENDING;  // 初始状态为待上传
    record.header.retry_count = 0;                        // 重试次数为0
    record.header.reserved = 0;

    // 复制数据
    memcpy(&record.data, data, sizeof(LandslideIotData));

    // 计算校验和
    record.header.checksum = CalculateChecksum((uint8_t*)&record.data, sizeof(LandslideIotData));

    // 获取存储地址
    uint32_t addr = GetRecordAddress(store_index);

    // 擦除扇区（如果需要）
    if (store_index % (STORAGE_SECTOR_SIZE / STORAGE_RECORD_SIZE) == 0) {
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
    if (g_storage_mgr.record_count < STORAGE_MAX_RECORDS) {
        g_storage_mgr.record_count++;
        g_storage_mgr.current_index = (g_storage_mgr.current_index + 1) % STORAGE_MAX_RECORDS;
    } else {
        // 如果覆盖的不是当前索引位置，需要更新当前索引
        if (store_index == g_storage_mgr.current_index) {
            g_storage_mgr.current_index = (g_storage_mgr.current_index + 1) % STORAGE_MAX_RECORDS;
        }
    }

    g_storage_mgr.stats.stored_records++;

    printf("Data stored to Flash: index=%d, timestamp=%d, status=pending\n",
           store_index, record.header.timestamp);

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
        printf("Storage not initialized\n");
        return 0;
    }

    if (!IoTCloud_IsConnected()) {
        printf("IoT cloud not connected, skipping cache upload\n");
        return 0;
    }

    int uploaded_count = 0;
    int failed_count = 0;
    int batch_count = 0;
    StorageRecord record;

    printf("Starting cached data upload, total records: %d\n", g_storage_mgr.record_count);

    // 遍历所有存储的记录
    for (uint32_t i = 0; i < g_storage_mgr.record_count && batch_count < UPLOAD_BATCH_SIZE; i++) {
        uint32_t addr = GetRecordAddress(i);

        // 读取完整记录（包含头部信息）
        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) != IOT_SUCCESS) {
            printf("Failed to read record %d from Flash\n", i);
            continue;
        }

        // 验证记录有效性
        if (record.header.magic != STORAGE_MAGIC_NUMBER) {
            continue;  // 跳过无效记录
        }

        // 只处理待上传或重试的记录
        if (record.header.upload_status != UPLOAD_STATUS_PENDING &&
            record.header.upload_status != UPLOAD_STATUS_RETRY) {
            continue;  // 跳过已上传或失败的记录
        }

        // 检查重试次数
        if (record.header.retry_count >= MAX_RETRY_COUNT) {
            printf("Record %d exceeded max retry count, marking as failed\n", i);
            record.header.upload_status = UPLOAD_STATUS_FAILED;
            // 更新Flash中的记录状态
            IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0);
            failed_count++;
            continue;
        }

        batch_count++;

        // 尝试上传数据
        printf("Uploading cached record %d (retry: %d)\n", i, record.header.retry_count);

        if (IoTCloud_SendData(&record.data) == 0) {
            // 上传成功，标记为已上传
            printf("Successfully uploaded cached record %d\n", i);
            record.header.upload_status = UPLOAD_STATUS_UPLOADED;
            record.header.retry_count = 0;
            uploaded_count++;
            g_storage_mgr.stats.uploaded_records++;
        } else {
            // 上传失败，增加重试次数
            printf("Failed to upload cached record %d, retry count: %d\n", i, record.header.retry_count + 1);
            record.header.upload_status = UPLOAD_STATUS_RETRY;
            record.header.retry_count++;
            failed_count++;
            g_storage_mgr.stats.failed_records++;
        }

        // 更新Flash中的记录状态
        if (IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0) != IOT_SUCCESS) {
            printf("Failed to update record %d status in Flash\n", i);
        }

        // 添加小延时，避免网络拥塞
        LOS_Msleep(100);
    }

    if (uploaded_count > 0 || failed_count > 0) {
        printf("Cache upload completed: uploaded=%d, failed=%d, batch_size=%d\n",
               uploaded_count, failed_count, batch_count);
    }

    return uploaded_count;
}

/**
 * @brief 标记记录为已上传
 */
int DataStorage_MarkAsUploaded(uint32_t index)
{
    if (!g_storage_mgr.initialized || index >= STORAGE_MAX_RECORDS) {
        return -1;
    }

    StorageRecord record;
    uint32_t addr = GetRecordAddress(index);

    // 读取记录
    if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) != IOT_SUCCESS) {
        return -1;
    }

    // 验证记录有效性
    if (record.header.magic != STORAGE_MAGIC_NUMBER) {
        return -1;
    }

    // 更新状态
    record.header.upload_status = UPLOAD_STATUS_UPLOADED;
    record.header.retry_count = 0;

    // 写回Flash
    if (IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0) != IOT_SUCCESS) {
        return -1;
    }

    printf("Marked record %d as uploaded\n", index);
    return 0;
}

/**
 * @brief 获取待上传的记录数量
 */
uint32_t DataStorage_GetPendingCount(void)
{
    if (!g_storage_mgr.initialized) {
        return 0;
    }

    uint32_t pending_count = 0;
    StorageRecord record;

    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        uint32_t addr = GetRecordAddress(i);

        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) == IOT_SUCCESS) {
            if (record.header.magic == STORAGE_MAGIC_NUMBER &&
                (record.header.upload_status == UPLOAD_STATUS_PENDING ||
                 record.header.upload_status == UPLOAD_STATUS_RETRY)) {
                pending_count++;
            }
        }
    }

    return pending_count;
}

/**
 * @brief 清理已上传的旧记录
 */
int DataStorage_CleanupUploaded(uint32_t keep_count)
{
    if (!g_storage_mgr.initialized || keep_count >= STORAGE_MAX_RECORDS) {
        return 0;
    }

    int cleaned_count = 0;
    StorageRecord record;

    // 从最旧的记录开始清理
    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        if (cleaned_count >= (int)(g_storage_mgr.record_count - keep_count)) {
            break;
        }

        uint32_t addr = GetRecordAddress(i);

        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) == IOT_SUCCESS) {
            if (record.header.magic == STORAGE_MAGIC_NUMBER &&
                record.header.upload_status == UPLOAD_STATUS_UPLOADED) {

                // 擦除记录（设置magic为0）
                memset(&record, 0, sizeof(StorageRecord));
                if (IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0) == IOT_SUCCESS) {
                    cleaned_count++;
                    printf("Cleaned uploaded record at index %d\n", i);
                }
            }
        }
    }

    if (cleaned_count > 0) {
        printf("Cleaned %d uploaded records\n", cleaned_count);
        // 重新扫描记录数量
        g_storage_mgr.record_count -= cleaned_count;
    }

    return cleaned_count;
}

/**
 * @brief 重置失败记录的重试计数
 */
int DataStorage_ResetRetryCount(void)
{
    if (!g_storage_mgr.initialized) {
        return 0;
    }

    int reset_count = 0;
    StorageRecord record;

    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        uint32_t addr = GetRecordAddress(i);

        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) == IOT_SUCCESS) {
            if (record.header.magic == STORAGE_MAGIC_NUMBER &&
                record.header.upload_status == UPLOAD_STATUS_FAILED &&
                record.header.retry_count > 0) {

                // 重置为待上传状态
                record.header.upload_status = UPLOAD_STATUS_PENDING;
                record.header.retry_count = 0;

                if (IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0) == IOT_SUCCESS) {
                    reset_count++;
                }
            }
        }
    }

    if (reset_count > 0) {
        printf("Reset retry count for %d failed records\n", reset_count);
    }

    return reset_count;
}

/**
 * @brief 智能重试上传（带指数退避）
 */
int DataStorage_SmartRetryUpload(void)
{
    if (!g_storage_mgr.initialized || !IoTCloud_IsConnected()) {
        return 0;
    }

    int retry_count = 0;
    StorageRecord record;
    static uint32_t last_retry_time = 0;
    uint32_t current_time = LOS_TickCountGet();

    // 限制重试频率（至少间隔5秒）
    if (current_time - last_retry_time < 5000) {
        return 0;
    }

    printf("Starting smart retry upload...\n");

    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        uint32_t addr = GetRecordAddress(i);

        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) != IOT_SUCCESS) {
            continue;
        }

        if (record.header.magic != STORAGE_MAGIC_NUMBER ||
            record.header.upload_status != UPLOAD_STATUS_RETRY) {
            continue;
        }

        // 计算退避延时（指数退避：1s, 2s, 4s, 8s...）
        uint32_t backoff_delay = RETRY_DELAY_BASE_MS * (1 << record.header.retry_count);
        uint32_t record_age = current_time - record.header.timestamp;

        if (record_age < backoff_delay) {
            continue;  // 还没到重试时间
        }

        if (record.header.retry_count >= MAX_RETRY_COUNT) {
            // 超过最大重试次数，标记为失败
            record.header.upload_status = UPLOAD_STATUS_FAILED;
            IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0);
            printf("Record %d marked as permanently failed\n", i);
            continue;
        }

        // 尝试重新上传
        printf("Retrying upload for record %d (attempt %d)\n", i, record.header.retry_count + 1);

        if (IoTCloud_SendData(&record.data) == 0) {
            // 重试成功
            record.header.upload_status = UPLOAD_STATUS_UPLOADED;
            record.header.retry_count = 0;
            g_storage_mgr.stats.uploaded_records++;
            printf("Retry successful for record %d\n", i);
        } else {
            // 重试失败，增加计数
            record.header.retry_count++;
            printf("Retry failed for record %d, count now %d\n", i, record.header.retry_count);
        }

        // 更新记录状态
        IoTFlashWrite(addr, sizeof(StorageRecord), (uint8_t*)&record, 0);
        retry_count++;

        // 限制每次重试的数量，避免网络拥塞
        if (retry_count >= 3) {
            break;
        }

        // 重试间隔
        LOS_Msleep(500);
    }

    last_retry_time = current_time;

    if (retry_count > 0) {
        printf("Smart retry completed: processed %d records\n", retry_count);
    }

    return retry_count;
}

/**
 * @brief 获取存储健康状态
 */
void DataStorage_GetHealthStatus(void)
{
    if (!g_storage_mgr.initialized) {
        printf("Storage not initialized\n");
        return;
    }

    uint32_t pending_count = 0;
    uint32_t uploaded_count = 0;
    uint32_t failed_count = 0;
    uint32_t retry_count = 0;
    StorageRecord record;

    for (uint32_t i = 0; i < g_storage_mgr.record_count; i++) {
        uint32_t addr = GetRecordAddress(i);

        if (IoTFlashRead(addr, sizeof(StorageRecord), (uint8_t*)&record) == IOT_SUCCESS &&
            record.header.magic == STORAGE_MAGIC_NUMBER) {

            switch (record.header.upload_status) {
                case UPLOAD_STATUS_PENDING:
                    pending_count++;
                    break;
                case UPLOAD_STATUS_UPLOADED:
                    uploaded_count++;
                    break;
                case UPLOAD_STATUS_FAILED:
                    failed_count++;
                    break;
                case UPLOAD_STATUS_RETRY:
                    retry_count++;
                    break;
            }
        }
    }

    printf("=== Storage Health Status ===\n");
    printf("Total Records: %d/%d\n", g_storage_mgr.record_count, STORAGE_MAX_RECORDS);
    printf("Pending Upload: %d\n", pending_count);
    printf("Successfully Uploaded: %d\n", uploaded_count);
    printf("Retry Queue: %d\n", retry_count);
    printf("Permanently Failed: %d\n", failed_count);
    printf("Storage Usage: %.1f%%\n",
           (float)g_storage_mgr.record_count / STORAGE_MAX_RECORDS * 100);
    printf("============================\n");
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
