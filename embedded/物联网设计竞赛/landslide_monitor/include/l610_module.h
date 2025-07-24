/*
 * Copyright (c) 2024 iSoftStone Education Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#ifndef L610_MODULE_H
#define L610_MODULE_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include "iot_cloud.h"

#ifdef __cplusplus
extern "C" {
#endif

// L610模块配置
#define L610_UART_ID                EUART2_M1
#define L610_UART_BAUDRATE          115200
#define L610_DEVICE_ID              "6815a14f9314d118511807c6_rk2206"
#define L610_CMD_BUFFER_SIZE        512
#define L610_RECV_BUFFER_SIZE       512

// L610操作结果
typedef enum {
    L610_RESULT_SUCCESS = 0,
    L610_RESULT_ERROR = -1,
    L610_RESULT_TIMEOUT = -2
} L610_Result;

// L610统计信息结构体（兼容性）
typedef struct {
    uint32_t init_count;
    uint32_t upload_success_count;
    uint32_t upload_error_count;
    uint32_t connection_error_count;
    uint32_t last_upload_time;
} L610_Stats;

/**
 * @brief 初始化L610模块
 * @return L610_Result 初始化结果
 */
L610_Result L610_Init(void);

/**
 * @brief 检查L610模块连接状态
 * @return true 连接正常，false 连接异常
 */
bool L610_IsConnected(void);

/**
 * @brief 上传IoT数据到华为云
 * @param data IoT数据结构指针
 * @return L610_Result 上传结果
 */
L610_Result L610_UploadData(const e_iot_data *data);

/**
 * @brief 上传山体滑坡数据 (兼容性函数)
 * @param data 山体滑坡数据结构指针
 * @return L610_Result 上传结果
 */
L610_Result L610_UploadLandslideData(const LandslideIotData *data);

/**
 * @brief 获取L610统计信息 (兼容性函数)
 * @param stats 统计信息结构体指针
 */
void L610_GetStats(L610_Stats *stats);

/**
 * @brief 启动L610后台任务 (兼容性函数)
 * @return L610_Result 启动结果
 */
L610_Result L610_StartBackgroundTask(void);

/**
 * @brief 停止L610后台任务 (兼容性函数)
 */
void L610_StopBackgroundTask(void);

/**
 * @brief 启动L610任务 (兼容性函数)
 * @return L610_Result 启动结果
 */
L610_Result L610_StartTask(void);

#ifdef __cplusplus
}
#endif

#endif // L610_MODULE_H
