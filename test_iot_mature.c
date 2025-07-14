/**
 * @file test_iot_mature.c
 * @brief 测试成熟版本的IoT上传功能
 */

#include <stdio.h>
#include <string.h>
#include "iot_cloud.h"
#include "landslide_monitor.h"
#include "cmsis_os2.h"

/**
 * @brief 测试成熟版本的IoT功能
 */
void test_mature_iot_functions(void)
{
    printf("=== 测试成熟版本IoT功能 ===\n");
    
    // 1. 测试MQTT初始化
    printf("1. 初始化MQTT连接...\n");
    mqtt_init();
    
    // 等待连接建立
    osDelay(3000);
    
    // 2. 检查连接状态
    printf("2. 检查连接状态...\n");
    if (mqtt_is_connected()) {
        printf("✓ MQTT连接成功\n");
    } else {
        printf("✗ MQTT连接失败\n");
        return;
    }
    
    // 3. 测试数据发送
    printf("3. 测试数据发送...\n");
    
    // 创建测试数据
    e_iot_data test_data = {
        .temperature = 25.5,
        .humidity = 60.0,
        .illumination = 1200.0,
        .accel_x = 100,
        .accel_y = -50,
        .accel_z = 1000,
        .gyro_x = 10,
        .gyro_y = -5,
        .gyro_z = 2,
        .mpu_temp = 26.0,
        .ultrasonic_distance = -1.0,  // 无超声波传感器
        .vibration = 0,
        .angle_x = 2.5,
        .angle_y = -1.2,
        .risk_level = 1,  // 低风险
        .alarm_active = 0,
        .uptime = 3600
    };
    
    // 发送测试数据
    send_msg_to_mqtt(&test_data);
    
    // 4. 测试兼容性函数
    printf("4. 测试兼容性函数...\n");
    
    LandslideIotData landslide_data = {
        .temperature = 24.8,
        .humidity = 65.2,
        .light = 1150.0,
        .accel_x = 0.1,
        .accel_y = -0.05,
        .accel_z = 1.0,
        .gyro_x = 1.0,
        .gyro_y = -0.5,
        .gyro_z = 0.2,
        .angle_x = 2.8,
        .angle_y = -1.5,
        .angle_z = 0.1,
        .vibration = 0.0,
        .risk_level = RISK_LEVEL_LOW,
        .alarm_active = false,
        .uptime = 3660
    };
    
    // 使用兼容性函数发送
    if (IoTCloud_IsConnected()) {
        printf("✓ IoTCloud_IsConnected() 工作正常\n");
        int result = IoTCloud_SendData(&landslide_data);
        if (result == 0) {
            printf("✓ IoTCloud_SendData() 发送成功\n");
        } else {
            printf("✗ IoTCloud_SendData() 发送失败: %d\n", result);
        }
    } else {
        printf("✗ IoTCloud_IsConnected() 返回false\n");
    }
    
    // 5. 测试消息等待
    printf("5. 测试消息等待...\n");
    for (int i = 0; i < 5; i++) {
        int result = wait_message();
        printf("wait_message() 返回: %d\n", result);
        osDelay(1000);
    }
    
    printf("=== IoT功能测试完成 ===\n");
}

/**
 * @brief 持续测试IoT上传
 */
void continuous_iot_test(void)
{
    printf("=== 开始持续IoT测试 ===\n");
    
    // 初始化
    mqtt_init();
    osDelay(3000);
    
    if (!mqtt_is_connected()) {
        printf("MQTT连接失败，退出测试\n");
        return;
    }
    
    int test_count = 0;
    while (test_count < 10) {  // 测试10次
        test_count++;
        
        // 创建模拟传感器数据
        e_iot_data sensor_data = {
            .temperature = 20.0 + (test_count % 10),
            .humidity = 50.0 + (test_count % 20),
            .illumination = 1000.0 + (test_count * 50),
            .accel_x = test_count * 10,
            .accel_y = -test_count * 5,
            .accel_z = 1000 + test_count,
            .gyro_x = test_count,
            .gyro_y = -test_count / 2,
            .gyro_z = test_count / 3,
            .mpu_temp = 25.0 + test_count * 0.1,
            .ultrasonic_distance = -1.0,
            .vibration = test_count % 3,
            .angle_x = test_count * 0.5,
            .angle_y = -test_count * 0.3,
            .risk_level = test_count % 5,
            .alarm_active = (test_count % 4 == 0) ? 1 : 0,
            .uptime = test_count * 60
        };
        
        printf("--- 测试 #%d ---\n", test_count);
        send_msg_to_mqtt(&sensor_data);
        
        // 等待并检查消息
        wait_message();
        
        // 间隔5秒
        osDelay(5000);
    }
    
    printf("=== 持续测试完成 ===\n");
}
