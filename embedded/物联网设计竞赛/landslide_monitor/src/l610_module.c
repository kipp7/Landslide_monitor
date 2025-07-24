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

#include "l610_module.h"
#include "iot_uart.h"
#include "los_task.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>

// 简化的L610模块实现 - 参考C:\2\openharmony\txsmartropenharmony\L610.c

static bool g_l610_initialized = false;

/**
 * @brief 检查L610模块连接状态
 */
static int CheckL610Connected(void)
{
    // 尝试多种AT命令格式
    const char *commands[] = {
        "AT\r\n",
        "AT\r",
        "at\r\n",
        "AT\n"
    };
    int num_commands = sizeof(commands) / sizeof(commands[0]);

    for (int i = 0; i < num_commands; i++) {
        const char *cmd = commands[i];
        char buf[128] = {0};

        printf("Trying L610 command %d: [%s] (len=%d)\n", i+1, cmd, strlen(cmd));
        int write_ret = IoTUartWrite(L610_UART_ID, (unsigned char *)cmd, strlen(cmd));
        printf("L610 UART write returned: %d\n", write_ret);

        LOS_Msleep(500);  // 等待500ms

        printf("Reading L610 response...\n");
        int r = IoTUartRead(L610_UART_ID, (unsigned char *)buf, sizeof(buf)-1);
        printf("L610 UART read returned: %d bytes\n", r);

        if (r > 0) {
            buf[r] = '\0';
            printf("L610 Response: [%s]\n", buf);
            if (strstr(buf, "OK") != NULL || strstr(buf, "ok") != NULL) {
                printf("L610 responded successfully!\n");
                return 1;
            }
        } else {
            printf("No L610 response\n");
        }

        LOS_Msleep(500);  // 命令间隔
    }

    printf("All L610 commands failed\n");
    return 0;
}

/**
 * @brief 构建山体滑坡监测数据的AT+HMPUB命令（基础传感器数据）
 */
static void BuildLandslideATCmd(char *outBuf, size_t bufLen, const e_iot_data *data)
{
    // 构建山体滑坡监测JSON数据（基础传感器数据）
    char payloadRaw[512];
    int rawLen = snprintf(payloadRaw, sizeof(payloadRaw),
        "{"
        "\"services\":["
        "{"
        "\"service_id\":\"smartHome\","
        "\"properties\":{"
        "\"temperature\":%.1f,"
        "\"humidity\":%.1f,"
        "\"illumination\":%.1f,"
        "\"acceleration_x\":%ld,"
        "\"acceleration_y\":%ld,"
        "\"acceleration_z\":%ld,"
        "\"gyroscope_x\":%ld,"
        "\"gyroscope_y\":%ld,"
        "\"gyroscope_z\":%ld,"
        "\"mpu_temperature\":%.1f,"
        "\"latitude\":%.6f,"
        "\"longitude\":%.6f,"
        "\"vibration\":%.2f,"
        "\"risk_level\":%d,"
        "\"alarm_active\":%s,"
        "\"uptime\":%ld"
        "}"
        "}"
        "]"
        "}",
        data->temperature, data->humidity, data->illumination,
        data->acceleration_x, data->acceleration_y, data->acceleration_z,
        data->gyroscope_x, data->gyroscope_y, data->gyroscope_z,
        data->mpu_temperature, data->latitude, data->longitude,
        data->vibration, data->risk_level,
        data->alarm_active ? "true" : "false",
        data->uptime
    );

    // 开始拼接AT命令头
    int pos = snprintf(outBuf, bufLen,
        "AT+HMPUB=1,\"$oc/devices/%s/sys/properties/report\",%d,\"",
        L610_DEVICE_ID, rawLen);

    // 逐字符扫描raw JSON，把双引号和反斜杠转义
    for (int i = 0; i < rawLen && pos < bufLen - 4; ++i) {
        char c = payloadRaw[i];
        if (c == '"' || c == '\\') {
            outBuf[pos++] = '\\';
        }
        outBuf[pos++] = c;
    }

    // 结束引号 + 回车换行
    outBuf[pos++] = '\"';
    outBuf[pos++] = '\r';
    outBuf[pos++] = '\n';
    outBuf[pos] = '\0';

    // 输出长度信息用于调试
    printf("Sensor JSON length: %d bytes\n", rawLen);
    printf("AT command total length: %d bytes\n", pos);
}

/**
 * @brief 构建GPS形变数据的AT+HMPUB命令
 */
static void BuildDeformationATCmd(char *outBuf, size_t bufLen, const e_iot_data *data)
{
    // 构建GPS形变监测JSON数据
    char payloadRaw[512];
    int rawLen = snprintf(payloadRaw, sizeof(payloadRaw),
        "{"
        "\"services\":["
        "{"
        "\"service_id\":\"smartHome\","
        "\"properties\":{"
        "\"deformation_distance_3d\":%.3f,"
        "\"deformation_horizontal\":%.3f,"
        "\"deformation_vertical\":%.3f,"
        "\"deformation_velocity\":%.3f,"
        "\"deformation_risk_level\":%d,"
        "\"deformation_type\":%d,"
        "\"deformation_confidence\":%.3f,"
        "\"baseline_established\":%s"
        "}"
        "}"
        "]"
        "}",
        data->deformation_distance_3d,
        data->deformation_horizontal,
        data->deformation_vertical,
        data->deformation_velocity,
        data->deformation_risk_level,
        data->deformation_type,
        data->deformation_confidence,
        data->baseline_established ? "true" : "false"
    );

    // 开始拼接AT命令头
    int pos = snprintf(outBuf, bufLen,
        "AT+HMPUB=1,\"$oc/devices/%s/sys/properties/report\",%d,\"",
        L610_DEVICE_ID, rawLen);

    // 逐字符扫描raw JSON，把双引号和反斜杠转义
    for (int i = 0; i < rawLen && pos < bufLen - 4; ++i) {
        char c = payloadRaw[i];
        if (c == '"' || c == '\\') {
            outBuf[pos++] = '\\';
        }
        outBuf[pos++] = c;
    }

    // 结束引号 + 回车换行
    outBuf[pos++] = '\"';
    outBuf[pos++] = '\r';
    outBuf[pos++] = '\n';
    outBuf[pos] = '\0';

    // 输出长度信息用于调试
    printf("Deformation JSON length: %d bytes\n", rawLen);
    printf("AT command total length: %d bytes\n", pos);
}

/**
 * @brief 初始化L610模块
 */
L610_Result L610_Init(void)
{
    if (g_l610_initialized) {
        printf("L610 already initialized\n");
        return L610_RESULT_SUCCESS;
    }

    printf("Initializing L610 module...\n");
    
    // 配置UART参数
    IotUartAttribute attr = {
        .baudRate = L610_UART_BAUDRATE,
        .dataBits = IOT_UART_DATA_BIT_8,
        .stopBits = IOT_UART_STOP_BIT_1,
        .parity   = IOT_UART_PARITY_NONE,
        .rxBlock  = IOT_UART_BLOCK_STATE_NONE_BLOCK,
        .txBlock  = IOT_UART_BLOCK_STATE_NONE_BLOCK,
    };
    
    printf("Initializing L610 UART2_M1 (GPIO0_PB2/PB3) at %d baud...\n", L610_UART_BAUDRATE);
    int ret = IoTUartInit(L610_UART_ID, &attr);
    if (ret != 0) {
        printf("L610 UART init failed with error: %d\n", ret);
        return L610_RESULT_ERROR;
    }
    printf("L610 UART init successful!\n");

    // 等待一段时间让UART稳定
    LOS_Msleep(1000);

    // 进行L610网络和MQTT初始化
    printf("Configuring L610 network and MQTT...\n");

    // 1. 基本AT测试
    if (CheckL610Connected() != 1) {
        printf("L610 basic AT test failed\n");
        return L610_RESULT_ERROR;
    }

    // 2. 关闭回显
    const char *ate0_cmd = "ATE0\r\n";
    IoTUartWrite(L610_UART_ID, (unsigned char *)ate0_cmd, strlen(ate0_cmd));
    LOS_Msleep(500);

    // 3. 检查网络注册状态
    const char *creg_cmd = "AT+CREG?\r\n";
    IoTUartWrite(L610_UART_ID, (unsigned char *)creg_cmd, strlen(creg_cmd));
    LOS_Msleep(1000);

    // 4. 检查信号强度
    const char *csq_cmd = "AT+CSQ\r\n";
    IoTUartWrite(L610_UART_ID, (unsigned char *)csq_cmd, strlen(csq_cmd));
    LOS_Msleep(1000);

    // 5. 配置MQTT服务器（华为云IoT平台）
    char mqtt_config[512];
    snprintf(mqtt_config, sizeof(mqtt_config),
             "AT+HMCFG=\"iot-mqtts.cn-north-4.myhuaweicloud.com\",8883,\"%s\",\"%s\",300,1,\"%s\"\r\n",
             "6815a14f9314d118511807c6_rk2206",  // clientId
             "6815a14f9314d118511807c6_rk2206",  // username
             "6d2eec8191e38ad728c429e6a5a4c89445a8e33c1ae449dce008175545c594bb");  // password

    printf("Configuring MQTT server...\n");
    IoTUartWrite(L610_UART_ID, (unsigned char *)mqtt_config, strlen(mqtt_config));
    LOS_Msleep(3000);  // MQTT配置需要更长时间

    // 6. 连接到MQTT服务器
    const char *connect_cmd = "AT+HMCON=1\r\n";
    printf("Connecting to MQTT server...\n");
    IoTUartWrite(L610_UART_ID, (unsigned char *)connect_cmd, strlen(connect_cmd));
    LOS_Msleep(5000);  // 连接需要较长时间

    // 清空UART缓冲区中的响应数据
    char dummy_buf[256];
    IoTUartRead(L610_UART_ID, (unsigned char *)dummy_buf, sizeof(dummy_buf));

    g_l610_initialized = true;
    printf("L610 module initialized and configured successfully\n");
    return L610_RESULT_SUCCESS;
}

/**
 * @brief 检查L610模块连接状态
 */
bool L610_IsConnected(void)
{
    if (!g_l610_initialized) {
        printf("L610 not initialized\n");
        return false;
    }

    return CheckL610Connected() == 1;
}

/**
 * @brief 分包发送AT命令的通用函数
 */
static L610_Result SendATCommandInChunks(const char *atCmd, const char *description)
{
    printf("Sending %s...\n", description);
    printf("Send:\n%s", atCmd);

    // 分包发送AT命令（每次最多60字节，避免UART缓冲区溢出）
    int cmd_len = strlen(atCmd);
    int sent = 0;
    const int chunk_size = 60;

    while (sent < cmd_len) {
        int to_send = (cmd_len - sent > chunk_size) ? chunk_size : (cmd_len - sent);
        int write_ret = IoTUartWrite(L610_UART_ID, (unsigned char *)(atCmd + sent), to_send);

        if (write_ret <= 0) {
            printf("L610 UART write failed at offset %d: %d\n", sent, write_ret);
            return L610_RESULT_ERROR;
        }

        sent += to_send;
        printf("Sent chunk: %d/%d bytes\n", sent, cmd_len);

        // 短暂延时，避免UART缓冲区溢出
        usleep(50000);  // 50ms
    }

    usleep(500000);  // 等待500ms让L610处理完整命令

    // 分段接收响应，处理长响应
    char recv[L610_RECV_BUFFER_SIZE];
    int total_received = 0;
    memset(recv, 0, sizeof(recv));

    // 尝试多次读取，直到没有更多数据
    for (int attempt = 0; attempt < 5; attempt++) {
        int r = IoTUartRead(L610_UART_ID, (unsigned char *)(recv + total_received),
                           sizeof(recv) - total_received - 1);
        if (r > 0) {
            total_received += r;
            printf("Recv part %d [%d bytes]\n", attempt + 1, r);
            usleep(100000);  // 等待100ms看是否有更多数据
        } else {
            break;  // 没有更多数据
        }
    }

    if (total_received > 0) {
        recv[total_received] = '\0';
        printf("L610 Response [%d bytes]: %s\n", total_received, recv);

        // 检查是否成功
        if (strstr(recv, "+HMPUB OK") != NULL || strstr(recv, "OK") != NULL) {
            printf("✅ %s uploaded successfully via L610\n", description);
            return L610_RESULT_SUCCESS;
        } else {
            printf("❌ L610 %s upload failed: %s\n", description, recv);
            return L610_RESULT_ERROR;
        }
    } else {
        printf("❌ No response from L610 for %s\n", description);
        return L610_RESULT_TIMEOUT;
    }
}

/**
 * @brief 上传山体滑坡监测数据到华为云（分包发送：传感器数据 + GPS形变数据）
 */
L610_Result L610_UploadData(const e_iot_data *data)
{
    if (!g_l610_initialized) {
        printf("L610 not initialized\n");
        return L610_RESULT_ERROR;
    }

    if (data == NULL) {
        printf("Invalid data parameter\n");
        return L610_RESULT_ERROR;
    }

    printf("Uploading landslide data via L610 (2 packages)...\n");

    // 第一包：发送基础传感器数据
    char sensorCmd[L610_CMD_BUFFER_SIZE];
    BuildLandslideATCmd(sensorCmd, sizeof(sensorCmd), data);

    L610_Result sensor_result = SendATCommandInChunks(sensorCmd, "sensor data");
    if (sensor_result != L610_RESULT_SUCCESS) {
        printf("❌ Sensor data upload failed\n");
        return sensor_result;
    }

    // 等待一段时间再发送第二包
    printf("Waiting before sending GPS deformation data...\n");
    usleep(1000000);  // 1秒间隔

    // 第二包：发送GPS形变数据
    char deformCmd[L610_CMD_BUFFER_SIZE];
    BuildDeformationATCmd(deformCmd, sizeof(deformCmd), data);

    L610_Result deform_result = SendATCommandInChunks(deformCmd, "GPS deformation data");
    if (deform_result != L610_RESULT_SUCCESS) {
        printf("❌ GPS deformation data upload failed\n");
        return deform_result;
    }

    printf("✅ All data packages uploaded successfully via L610\n");
    return L610_RESULT_SUCCESS;
}

/**
 * @brief 上传山体滑坡数据 (兼容性函数)
 */
L610_Result L610_UploadLandslideData(const LandslideIotData *data)
{
    if (data == NULL) {
        printf("Invalid landslide data parameter\n");
        return L610_RESULT_ERROR;
    }

    // 创建e_iot_data结构
    e_iot_data iot_data = {0};
    iot_data.temperature = data->temperature;
    iot_data.humidity = data->humidity;
    iot_data.illumination = data->light;
    iot_data.acceleration_x = (long)(data->accel_x * 1000);
    iot_data.acceleration_y = (long)(data->accel_y * 1000);
    iot_data.acceleration_z = (long)(data->accel_z * 1000);
    iot_data.gyroscope_x = (long)(data->gyro_x * 100);
    iot_data.gyroscope_y = (long)(data->gyro_y * 100);
    iot_data.gyroscope_z = (long)(data->gyro_z * 100);
    iot_data.mpu_temperature = data->temperature;  // 使用环境温度作为MPU温度
    iot_data.latitude = data->gps_latitude;
    iot_data.longitude = data->gps_longitude;
    iot_data.vibration = data->vibration;
    iot_data.risk_level = data->risk_level;
    iot_data.alarm_active = data->alarm_active;
    iot_data.uptime = data->uptime;

    return L610_UploadData(&iot_data);
}

/**
 * @brief 获取L610统计信息 (兼容性函数)
 */
void L610_GetStats(L610_Stats *stats)
{
    if (stats == NULL) {
        return;
    }

    // 简化版本，只返回基本信息
    stats->init_count = g_l610_initialized ? 1 : 0;
    stats->upload_success_count = 0;
    stats->upload_error_count = 0;
    stats->connection_error_count = 0;
    stats->last_upload_time = 0;
}

/**
 * @brief 启动L610后台任务 (兼容性函数)
 */
L610_Result L610_StartBackgroundTask(void)
{
    printf("L610 background task started (simplified version)\n");
    return L610_RESULT_SUCCESS;
}

/**
 * @brief 停止L610后台任务 (兼容性函数)
 */
void L610_StopBackgroundTask(void)
{
    printf("L610 background task stopped (simplified version)\n");
}

/**
 * @brief 启动L610任务 (兼容性函数)
 */
L610_Result L610_StartTask(void)
{
    printf("L610 task started (simplified version)\n");
    return L610_RESULT_SUCCESS;
}
