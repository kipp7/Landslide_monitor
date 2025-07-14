/*
 * Copyright (c) 2023 iSoftStone Information Technology (Group) Co.,Ltd.
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

#ifndef IOT_CLOUD_H
#define IOT_CLOUD_H

#include <stdbool.h>
#include <stdint.h>
#include "landslide_monitor.h"  // 使用主头文件中的RiskLevel定义

#ifdef __cplusplus
extern "C" {
#endif

// 华为云IoT平台配置（基于实际配置文件）
#define MQTT_CLIENT_ID "6815a14f9314d118511807c6_rk2206_0_0_2025053112"
#define MQTT_USERNAME "6815a14f9314d118511807c6_rk2206"
#define MQTT_PASSWORD "651b10d40dedc432a32d45ecb04fffbd93730d3fb8f636dccfaeaf78fe52c05c"
#define MQTT_HOST "361017cfc6.st1.iotda-device.cn-north-4.myhuaweicloud.com"
#define MQTT_PORT 1883
#define DEVICE_ID "6815a14f9314d118511807c6_rk2206_0_0_2025053112"

// WiFi配置
#define WIFI_SSID "1"
#define WIFI_PASSWORD "12345678"

// MQTT主题定义
#define PUBLISH_TOPIC "$oc/devices/" DEVICE_ID "/sys/properties/report"
#define SUBCRIB_TOPIC "$oc/devices/" DEVICE_ID "/sys/commands/+"
#define RESPONSE_TOPIC "$oc/devices/" DEVICE_ID "/sys/commands/response"

// 滑坡监测数据结构
typedef struct {
    // 传感器数据
    float temperature;      // 温度 (°C)
    float humidity;         // 湿度 (%)
    float light;           // 光照强度 (lux)
    float angle_x;         // X轴倾斜角度 (°)
    float angle_y;         // Y轴倾斜角度 (°)
    float angle_z;         // Z轴倾斜角度 (°)
    float vibration;       // 振动强度
    
    // 系统状态
    RiskLevel risk_level;   // 风险等级
    bool alarm_active;      // 报警状态
    uint32_t uptime;        // 系统运行时间 (秒)
    
    // 设备状态
    bool rgb_enabled;       // RGB LED状态
    bool buzzer_enabled;    // 蜂鸣器状态
    bool motor_enabled;     // 马达状态
    bool voice_enabled;     // 语音状态
} LandslideIotData;

// IoT云平台函数声明
int IoTCloud_Init(void);
void IoTCloud_Deinit(void);
bool IoTCloud_IsConnected(void);
int IoTCloud_SendData(const LandslideIotData *data);
int IoTCloud_StartTask(void);

// 命令处理函数
void IoTCloud_ProcessCommand(const char *command_name, const char *payload);
void IoTCloud_HandleResetCommand(void);
void IoTCloud_HandleConfigCommand(const char *config_data);

// 数据上报函数
void IoTCloud_ReportSensorData(const LandslideIotData *data);
void IoTCloud_ReportAlarmStatus(RiskLevel level, bool active);
void IoTCloud_ReportSystemStatus(void);

#ifdef __cplusplus
}
#endif

#endif // IOT_CLOUD_H
