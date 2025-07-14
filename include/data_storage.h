#ifndef DATA_STORAGE_H
#define DATA_STORAGE_H

#include <stdint.h>
#include <stdbool.h>
#include "iot_cloud.h"

#ifdef __cplusplus
extern "C" {
#endif

// Flash存储配置
#define STORAGE_FLASH_BASE_ADDR     0x200000    // Flash存储起始地址
#define STORAGE_SECTOR_SIZE         4096        // 扇区大小 4KB
#define STORAGE_MAX_RECORDS         100         // 最大存储记录数
#define STORAGE_RECORD_SIZE         256         // 每条记录大小
#define STORAGE_TOTAL_SIZE          (STORAGE_MAX_RECORDS * STORAGE_RECORD_SIZE)

// 上传状态枚举
typedef enum {
    UPLOAD_STATUS_PENDING = 0,      // 待上传
    UPLOAD_STATUS_UPLOADED = 1,     // 已上传
    UPLOAD_STATUS_FAILED = 2,       // 上传失败
    UPLOAD_STATUS_RETRY = 3         // 重试中
} UploadStatus;

// 存储记录头部
typedef struct {
    uint32_t magic;             // 魔数 0x12345678
    uint32_t timestamp;         // 时间戳
    uint16_t data_size;         // 数据大小
    uint16_t checksum;          // 校验和
    uint8_t upload_status;      // 上传状态
    uint8_t retry_count;        // 重试次数
    uint16_t reserved;          // 预留字段
} StorageHeader;

// 存储记录结构
typedef struct {
    StorageHeader header;
    LandslideIotData data;
    uint8_t reserved[64];       // 预留空间
} StorageRecord;

// 存储状态
typedef enum {
    STORAGE_STATE_UNINITIALIZED = 0,
    STORAGE_STATE_READY,
    STORAGE_STATE_FULL,
    STORAGE_STATE_ERROR
} StorageState;

// 存储统计信息
typedef struct {
    uint32_t total_records;     // 总记录数
    uint32_t stored_records;    // 已存储记录数
    uint32_t uploaded_records;  // 已上传记录数
    uint32_t failed_records;    // 失败记录数
    StorageState state;         // 存储状态
} StorageStats;

/**
 * @brief 初始化数据存储
 * @return 0: 成功, 其他: 失败
 */
int DataStorage_Init(void);

/**
 * @brief 反初始化数据存储
 */
void DataStorage_Deinit(void);

/**
 * @brief 存储数据到Flash
 * @param data 要存储的数据
 * @return 0: 成功, 其他: 失败
 */
int DataStorage_Store(const LandslideIotData *data);

/**
 * @brief 从Flash读取数据
 * @param index 记录索引
 * @param data 读取的数据
 * @return 0: 成功, 其他: 失败
 */
int DataStorage_Read(uint32_t index, LandslideIotData *data);

/**
 * @brief 获取存储的记录数量
 * @return 记录数量
 */
uint32_t DataStorage_GetRecordCount(void);

/**
 * @brief 清空所有存储的数据
 * @return 0: 成功, 其他: 失败
 */
int DataStorage_Clear(void);

/**
 * @brief 获取存储统计信息
 * @param stats 统计信息
 * @return 0: 成功, 其他: 失败
 */
int DataStorage_GetStats(StorageStats *stats);

/**
 * @brief 上传所有缓存的数据
 * @return 上传成功的记录数
 */
int DataStorage_UploadCached(void);

/**
 * @brief 检查存储空间是否已满
 * @return true: 已满, false: 未满
 */
bool DataStorage_IsFull(void);

/**
 * @brief 获取最旧的记录索引（用于循环覆盖）
 * @return 记录索引
 */
uint32_t DataStorage_GetOldestIndex(void);

/**
 * @brief 标记记录为已上传
 * @param index 记录索引
 * @return 0: 成功, 其他: 失败
 */
int DataStorage_MarkAsUploaded(uint32_t index);

/**
 * @brief 获取待上传的记录数量
 * @return 待上传记录数量
 */
uint32_t DataStorage_GetPendingCount(void);

/**
 * @brief 清理已上传的旧记录
 * @param keep_count 保留的记录数量
 * @return 清理的记录数量
 */
int DataStorage_CleanupUploaded(uint32_t keep_count);

/**
 * @brief 重置失败记录的重试计数
 * @return 重置的记录数量
 */
int DataStorage_ResetRetryCount(void);

/**
 * @brief 智能重试上传（带指数退避）
 * @return 处理的重试记录数量
 */
int DataStorage_SmartRetryUpload(void);

/**
 * @brief 获取存储健康状态
 */
void DataStorage_GetHealthStatus(void);

#ifdef __cplusplus
}
#endif

#endif // DATA_STORAGE_H
