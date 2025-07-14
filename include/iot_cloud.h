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

// 华为云IoT平台配置（基于华为云iot配置.txt成熟版本）
#define MQTT_DEVICES_PWD "8ebe8b17e8464208b73064df53d68e15f7ab038713ab3ef6a1996227e63ae45e"
#define HOST_ADDR "361017cfc6.st1.iotda-device.cn-north-4.myhuaweicloud.com"
#define HOST_PORT 1883  // MQTT标准端口（基于参考配置）
#define DEVICE_ID "6815a14f9314d118511807c6_rk2206_0_0_2025070314"
#define DEVICE_USERNAME "6815a14f9314d118511807c6_rk2206"

#define PUBLISH_TOPIC "$oc/devices/" DEVICE_ID "/sys/properties/report"
#define SUBSCRIBE_TOPIC "$oc/devices/" DEVICE_ID "/sys/commands/+"

// WiFi配置（基于用户偏好设置）
#define WIFI_SSID "188"
#define WIFI_PASSWORD "88888888"

// MQTT主题定义
#define PUBLISH_TOPIC "$oc/devices/" DEVICE_ID "/sys/properties/report"
#define SUBCRIB_TOPIC "$oc/devices/" DEVICE_ID "/sys/commands/+"
#define RESPONSE_TOPIC "$oc/devices/" DEVICE_ID "/sys/commands/response"

// 兼容性数据结构（原有的LandslideIotData）
typedef struct {
    // 基础传感器数据
    float temperature;      // 温度 (°C)
    float humidity;         // 湿度 (%)
    float light;           // 光照强度 (lux)

    // MPU6050 数据
    float accel_x;         // X轴加速度 (g)
    float accel_y;         // Y轴加速度 (g)
    float accel_z;         // Z轴加速度 (g)
    float gyro_x;          // X轴陀螺仪 (°/s)
    float gyro_y;          // Y轴陀螺仪 (°/s)
    float gyro_z;          // Z轴陀螺仪 (°/s)
    float angle_x;         // X轴倾斜角度 (°)
    float angle_y;         // Y轴倾斜角度 (°)
    float angle_z;         // Z轴倾斜角度 (°)
    float vibration;       // 振动强度

    // 系统状态
    int risk_level;        // 风险等级 (0-4)
    bool alarm_active;     // 报警状态
    uint32_t uptime;       // 系统运行时间 (秒)

    // 扩展字段
    bool rgb_enabled;      // RGB LED使能
    bool buzzer_enabled;   // 蜂鸣器使能
    bool motor_enabled;    // 电机使能
    bool voice_enabled;    // 语音使能
} LandslideIotData;

// 华为云IoT平台数据结构（完全匹配云端字段定义）
typedef struct {
    // 基础环境传感器数据（decimal类型）
    double temperature;        // 温度 (°C) - decimal
    double illumination;       // 光照强度 (lux) - decimal
    double humidity;          // 湿度 (%) - decimal

    // MPU6050加速度数据（long类型 - 云端单位：g）
    long acceleration_x;      // X轴加速度(g×1000) - 云端除以1000显示为g
    long acceleration_y;      // Y轴加速度(g×1000) - 云端除以1000显示为g
    long acceleration_z;      // Z轴加速度(g×1000) - 云端除以1000显示为g

    // MPU6050陀螺仪数据（long类型 - 云端单位：°/s）
    long gyroscope_x;         // X轴陀螺仪(°/s×100) - 云端除以100显示为°/s
    long gyroscope_y;         // Y轴陀螺仪(°/s×100) - 云端除以100显示为°/s
    long gyroscope_z;         // Z轴陀螺仪(°/s×100) - 云端除以100显示为°/s

    // MPU6050温度（decimal类型）
    double mpu_temperature;   // MPU6050温度 - decimal

    // GPS定位数据（decimal类型）
    double latitude;          // 纬度 - decimal
    double longitude;         // 经度 - decimal

    // 振动传感器数据（decimal类型）
    double vibration;         // 振动传感器数值 - decimal

    // 滑坡监测专用数据
    int risk_level;           // 山体滑坡风险等级 (0安全,1低风险,2中风险,3高风险,4极高风险) - int
    bool alarm_active;        // 当前报警状态 (true=激活) - boolean
    long uptime;              // 系统运行时间 (秒) - long

    // 倾角数据（decimal类型）
    double angle_x;           // X轴倾角 (°) - decimal
    double angle_y;           // Y轴倾角 (°) - decimal
    double angle_z;           // 总倾斜角度（基于X、Y轴计算） - decimal
} e_iot_data;

// MQTT 核心功能（基于成熟版本）
void mqtt_init(void);
int wait_message(void);
unsigned int mqtt_is_connected(void);
void send_msg_to_mqtt(e_iot_data *iot_data);

// 扩展功能
int IoTCloud_Init(void);
void IoTCloud_Deinit(void);
bool IoTCloud_IsConnected(void);
int IoTCloud_SendData(const LandslideIotData *data);
int IoTCloud_StartTask(void);

// 命令处理函数
void IoTCloud_ProcessCommand(const char *command_name, const char *payload);
void IoTCloud_HandleResetCommand(void);
void IoTCloud_HandleConfigCommand(const char *config_data);

#ifdef __cplusplus
}
#endif

#endif // IOT_CLOUD_H
