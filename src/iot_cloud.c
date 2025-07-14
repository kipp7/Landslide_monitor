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

#include "iot_cloud.h"
#include "MQTTClient.h"
#include "cJSON.h"
#include "cmsis_os2.h"
#include "config_network.h"
#include "los_task.h"
#include "ohos_init.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MAX_BUFFER_LENGTH 1024
#define MAX_STRING_LENGTH 64

// MQTT相关变量（参考e1_iot_smart_home）
static unsigned char sendBuf[MAX_BUFFER_LENGTH];
static unsigned char readBuf[MAX_BUFFER_LENGTH];

static Network network;
static MQTTClient client;

// 直接使用字符串字面量，避免宏定义连接问题
static char mqtt_devid[64] = "6815a14f9314d118511807c6_rk2206_0_0_2025053112";
static char mqtt_pwd[64] = "651b10d40dedc432a32d45ecb04fffbd93730d3fb8f636dccfaeaf78fe52c05c";
static char mqtt_username[64] = "6815a14f9314d118511807c6_rk2206";
static char mqtt_hostaddr[64] = "361017cfc6.st1.iotda-device.cn-north-4.myhuaweicloud.com";

static char publish_topic[128];
static char subcribe_topic[128];
static char response_topic[128];

static unsigned int mqttConnectFlag = 0;

// 外部变量声明（用于命令处理）
extern bool g_alarm_acknowledged;

/**
 * @brief MQTT消息到达回调函数（参考e1_iot_smart_home）
 */
static void mqtt_message_arrived(MessageData *data)
{
    int rc;
    cJSON *root = NULL;
    cJSON *cmd_name = NULL;
    char *cmd_name_str = NULL;
    char *request_id_idx = NULL;
    char request_id[20] = {0};
    MQTTMessage message;
    char payload[MAX_BUFFER_LENGTH];

    char rsptopic[128] = {0};

    printf("Message arrived on topic %.*s: %.*s\n",
           data->topicName->lenstring.len, data->topicName->lenstring.data,
           data->message->payloadlen, data->message->payload);

    // 提取request_id
    request_id_idx = strstr(data->topicName->lenstring.data, "request_id=");
    if (request_id_idx != NULL) {
        strncpy(request_id, request_id_idx + 11, 19);
        request_id[19] = '\0';
    }

    // 构建响应主题
    sprintf(rsptopic, "$oc/devices/%s/sys/commands/response/request_id=%s", mqtt_devid, request_id);

    // 构建响应消息
    sprintf(payload, "{ \"result_code\": 0, \"response_name\": \"COMMAND_RESPONSE\", \"paras\": { \"result\": \"success\" } }");

    message.qos = 0;
    message.retained = 0;
    message.payload = payload;
    message.payloadlen = strlen(payload);

    // 发送响应消息
    if ((rc = MQTTPublish(&client, rsptopic, &message)) != 0) {
        printf("Return code from MQTT publish is %d\n", rc);
        mqttConnectFlag = 0;
    }

    // 解析JSON命令
    root = cJSON_ParseWithLength(data->message->payload, data->message->payloadlen);
    if (root != NULL) {
        cmd_name = cJSON_GetObjectItem(root, "command_name");
        if (cmd_name != NULL) {
            cmd_name_str = cJSON_GetStringValue(cmd_name);
            printf("Received command: %s\n", cmd_name_str);

            if (!strcmp(cmd_name_str, "reset_alarm")) {
                printf("\n=== CLOUD COMMAND: RESET ALARM ===\n");
                printf("Remote operator confirmed: Landslide risk manually cleared\n");
                printf("System returning to normal monitoring mode\n");
                printf("===================================\n");

                // 设置重置标志
                g_alarm_acknowledged = true;

            } else if (!strcmp(cmd_name_str, "get_status")) {
                printf("Cloud requested system status\n");

            } else {
                printf("Unknown command: %s\n", cmd_name_str);
            }
        }
        cJSON_Delete(root);
    }
}

/**
 * @brief MQTT初始化（参考e1_iot_smart_home）
 */
static void mqtt_init(void)
{
    int rc;

    printf("Starting MQTT...\n");

    // 网络初始化
    NetworkInit(&network);

begin:
    // 连接网络
    printf("NetworkConnect  ...\n");
    NetworkConnect(&network, mqtt_hostaddr, MQTT_PORT);
    printf("MQTTClientInit  ...\n");

    // MQTT客户端初始化
    MQTTClientInit(&client, &network, 2000, sendBuf, sizeof(sendBuf), readBuf, sizeof(readBuf));

    MQTTString clientId = MQTTString_initializer;
    clientId.cstring = "6815a14f9314d118511807c6_rk2206_0_0_2025053112";

    MQTTString userName = MQTTString_initializer;
    userName.cstring = "6815a14f9314d118511807c6_rk2206";

    MQTTString password = MQTTString_initializer;
    password.cstring = "651b10d40dedc432a32d45ecb04fffbd93730d3fb8f636dccfaeaf78fe52c05c";

    MQTTPacket_connectData data = MQTTPacket_connectData_initializer;
    data.clientID = clientId;
    data.username = userName;
    data.password = password;
    data.willFlag = 0;
    data.MQTTVersion = 4;
    data.keepAliveInterval = 60;
    data.cleansession = 1;

    printf("MQTTConnect  ...\n");
    printf("Connecting to: %s:%d\n", mqtt_hostaddr, MQTT_PORT);
    printf("Client ID: %s\n", mqtt_devid);
    printf("Username: %s\n", mqtt_username);
    printf("Password: %s\n", mqtt_pwd);
    printf("Note: Attempting connection to Huawei Cloud IoT Platform (smartHome service)\n");
    printf("Using port 1883 (non-SSL) as per Liu Tianle stable configuration\n");

    rc = MQTTConnect(&client, &data);
    if (rc != 0) {
        printf("MQTTConnect failed: %d\n", rc);
        NetworkDisconnect(&network);
        MQTTDisconnect(&client);
        osDelay(200);
        goto begin;
    }

    printf("MQTTSubscribe  ...\n");
    sprintf(subcribe_topic, "$oc/devices/%s/sys/commands/+", mqtt_devid);
    rc = MQTTSubscribe(&client, subcribe_topic, 0, mqtt_message_arrived);
    if (rc != 0) {
        printf("MQTTSubscribe failed: %d\n", rc);
        osDelay(200);
        goto begin;
    }

    mqttConnectFlag = 1;
    printf("MQTT connected and subscribed.\n");
    printf("=== Huawei Cloud IoT Platform Connected ===\n");
    printf("Service: smartHome\n");
    printf("Device ID: %s\n", mqtt_devid);
    printf("Port: %d (Non-SSL)\n", MQTT_PORT);
    printf("Status: Ready for data upload and command reception\n");
    printf("==========================================\n");
}

/**
 * @brief 初始化IoT云平台连接
 */
int IoTCloud_Init(void)
{
    printf("Initializing IoT Cloud connection to Huawei IoT Platform...\n");
    printf("Device ID: %s\n", DEVICE_ID);
    printf("MQTT Host: %s:%d\n", MQTT_HOST, MQTT_PORT);

    return 0;
}

/**
 * @brief 等待MQTT消息（参考e1_iot_smart_home）
 */
static int wait_message(void)
{
    uint8_t rec = MQTTYield(&client, 5000);
    if (rec != 0) {
        mqttConnectFlag = 0;
    }
    if (mqttConnectFlag == 0) {
        return 0;
    }
    return 1;
}

/**
 * @brief IoT网络任务（参考e1_iot_smart_home）
 */
static void IoTNetworkTask(void *arg)
{
    (void)arg;

    printf("Starting IoT network task...\n");

    // 首先启动WiFi配置任务，这会调用TaskConfigWifiModeEntry来设置正确的WiFi配置
    printf("Starting WiFi configuration task...\n");
    extern UINT32 ExternalTaskConfigNetwork(VOID);
    UINT32 ret = ExternalTaskConfigNetwork();
    if (ret != LOS_OK) {
        printf("Failed to start WiFi configuration task: %d\n", ret);
        LOS_Msleep(5000);
        return;
    }

    printf("WiFi configuration task started, waiting for connection...\n");

    // 等待WiFi连接成功
    int retry_count = 0;
    while (retry_count < 30) {  // 最多等待30秒
        extern int wifi_get_connect_status_internal(void);
        if (wifi_get_connect_status_internal() == 1) {
            printf("WiFi connected successfully!\n");
            break;
        }
        printf("Waiting for WiFi connection... (%d/30)\n", retry_count + 1);
        LOS_Msleep(1000);
        retry_count++;
    }

    if (retry_count >= 30) {
        printf("WiFi connection timeout, MQTT will not be available\n");
        return;
    }

    // WiFi连接成功后，初始化MQTT
    mqtt_init();

    // 保持MQTT连接
    while (1) {
        if (!wait_message()) {
            printf("MQTT connection lost, reconnecting...\n");
            mqtt_init();
        }
        LOS_Msleep(1);
    }
}

/**
 * @brief 启动IoT任务
 */
int IoTCloud_StartTask(void)
{
    printf("Starting IoT Cloud network task...\n");

    // 创建IoT网络任务
    TSK_INIT_PARAM_S task_param = {0};
    task_param.pfnTaskEntry = (TSK_ENTRY_FUNC)IoTNetworkTask;
    task_param.uwStackSize = 4096;
    task_param.pcName = "IoTNetTask";
    task_param.usTaskPrio = 25;
    task_param.uwResved = LOS_TASK_STATUS_DETACHED;

    static uint32_t iot_task_id = 0;
    UINT32 ret = LOS_TaskCreate(&iot_task_id, &task_param);
    if (ret != LOS_OK) {
        printf("Failed to create IoT network task: %d\n", ret);
        return -1;
    }

    printf("IoT Cloud network task started successfully\n");
    return 0;
}

/**
 * @brief 检查MQTT连接状态（参考e1_iot_smart_home）
 */
bool IoTCloud_IsConnected(void)
{
    return mqttConnectFlag;
}

/**
 * @brief 发送传感器数据到云平台（参考e1_iot_smart_home）
 */
int IoTCloud_SendData(const LandslideIotData *data)
{
    int rc;
    MQTTMessage message;
    char payload[MAX_BUFFER_LENGTH] = {0};
    char str[MAX_STRING_LENGTH] = {0};

    if (mqttConnectFlag == 0) {
        printf("IoT not connected (simulation mode not active)\n");
        return -1;
    }

    if (data == NULL) {
        return -1;
    }

    cJSON *root = cJSON_CreateObject();
    if (root != NULL) {
        cJSON *serv_arr = cJSON_AddArrayToObject(root, "services");
        cJSON *arr_item = cJSON_CreateObject();
        cJSON_AddStringToObject(arr_item, "service_id", "smartHome");
        cJSON *pro_obj = cJSON_CreateObject();
        cJSON_AddItemToObject(arr_item, "properties", pro_obj);

        // 添加传感器数据（按照华为云IoT平台字段定义）
        // 温度 - decimal(小数)
        cJSON_AddNumberToObject(pro_obj, "temperature", data->temperature);

        // 湿度 - decimal(小数)
        cJSON_AddNumberToObject(pro_obj, "humidity", data->humidity);

        // 光照强度 - decimal(小数)
        cJSON_AddNumberToObject(pro_obj, "illumination", data->light);

        // MPU6050温度 - decimal(小数)
        cJSON_AddNumberToObject(pro_obj, "mpu_temperature", data->temperature);

        // 加速度数据 - 使用MPU6050真实加速度数据 (单位: g, 华为云平台期望)
        cJSON_AddNumberToObject(pro_obj, "acceleration_x", data->accel_x / 9.8);  // m/s² 转换为 g
        cJSON_AddNumberToObject(pro_obj, "acceleration_y", data->accel_y / 9.8);
        cJSON_AddNumberToObject(pro_obj, "acceleration_z", data->accel_z / 9.8);

        // 陀螺仪数据 - 使用MPU6050真实陀螺仪数据 (单位: °/s, 华为云平台期望)
        cJSON_AddNumberToObject(pro_obj, "gyroscope_x", data->gyro_x);  // 直接使用 °/s
        cJSON_AddNumberToObject(pro_obj, "gyroscope_y", data->gyro_y);
        cJSON_AddNumberToObject(pro_obj, "gyroscope_z", data->gyro_z);

        // 倾角数据 - 山体滑坡监测的关键指标 (单位: 度)
        cJSON_AddNumberToObject(pro_obj, "angle_x", data->angle_x);  // X轴倾角 (decimal)
        cJSON_AddNumberToObject(pro_obj, "angle_y", data->angle_y);  // Y轴倾角 (decimal)
        cJSON_AddNumberToObject(pro_obj, "angle_z", data->angle_z);  // Z轴倾角 (decimal)

        // 山体滑坡监测系统特有字段 (需要在华为云IoT平台添加对应属性定义)
        cJSON_AddNumberToObject(pro_obj, "vibration", data->vibration);  // 振动强度 (decimal)
        cJSON_AddNumberToObject(pro_obj, "risk_level", data->risk_level);  // 风险等级 (int, 0-4)
        cJSON_AddNumberToObject(pro_obj, "alarm_active", data->alarm_active ? 1 : 0);  // 报警状态 (boolean)
        cJSON_AddNumberToObject(pro_obj, "uptime", data->uptime);  // 运行时间 (long, 秒)

        // 注意: 移除了ultrasonic_distance字段，因为硬件没有超声波传感器

        cJSON_AddItemToArray(serv_arr, arr_item);

        char *json_string = cJSON_Print(root);
        if (json_string != NULL) {
            int json_len = strlen(json_string);
            printf("JSON length: %d, Buffer size: %d\n", json_len, MAX_BUFFER_LENGTH);
            if (json_len < MAX_BUFFER_LENGTH) {
                strncpy(payload, json_string, sizeof(payload) - 1);
                payload[sizeof(payload) - 1] = '\0';  // 确保字符串结束
            } else {
                printf("JSON too large! Truncating...\n");
                strncpy(payload, json_string, sizeof(payload) - 1);
                payload[sizeof(payload) - 1] = '\0';
            }
            free(json_string);
        } else {
            printf("Failed to generate JSON string\n");
            cJSON_Delete(root);
            return -1;
        }
        cJSON_Delete(root);
    } else {
        printf("Failed to create JSON object\n");
        return -1;
    }

    message.qos = 0;
    message.retained = 0;
    message.payload = payload;
    message.payloadlen = strlen(payload);

    sprintf(publish_topic, "$oc/devices/%s/sys/properties/report", mqtt_devid);
    printf("Publishing to topic: %s\n", publish_topic);
    printf("Payload: %s\n", payload);
    if ((rc = MQTTPublish(&client, publish_topic, &message)) != 0) {
        printf("Failed to publish MQTT message: %d\n", rc);
        printf("Topic: %s\n", publish_topic);
        printf("Payload length: %d\n", message.payloadlen);
        mqttConnectFlag = 0;
        return -1;
    } else {
        static uint32_t upload_count = 0;
        upload_count++;
        printf("MQTT publish success: %s\n", payload);
        printf("=== IoT Data Upload #%d ===\n", upload_count);
        printf("Service: smartHome | Risk=%d | Temp=%.1f°C | Humidity=%.1f%%\n",
               data->risk_level, data->temperature, data->humidity);
        printf("Motion: X=%.1f° Y=%.1f° | Light=%.1fLux | Alarm=%s\n",
               data->angle_x, data->angle_y, data->light, data->alarm_active ? "ACTIVE" : "NORMAL");
        printf("========================\n");
    }

    return 0;
}

/**
 * @brief 清理IoT连接
 */
void IoTCloud_Deinit(void)
{
    if (mqttConnectFlag) {
        MQTTDisconnect(&client);
        NetworkDisconnect(&network);
    }
    mqttConnectFlag = 0;
    printf("IoT Cloud connection closed\n");
}
