# 成熟版IoT上传功能配置说明

## 📋 概述

基于 `华为云iot配置.txt` 和 `Iot配置.txt` 中的成熟函数形式，重新配置了滑坡监测系统的IoT上传功能。

## 🔧 核心配置参数

### MQTT连接参数
```c
#define MQTT_DEVICES_PWD "6d2eec8191e38ad728c429e6a5a4c89445a8e33c1ae449dce008175545c594bb"
#define HOST_ADDR "117.78.5.125"
#define DEVICE_ID "6815a14f9314d118511807c6_rk2206_0_0_2025070315"
#define DEVICE_USERNAME "6815a14f9314d118511807c6_rk2206"
```

### WiFi配置
```c
#define WIFI_SSID "中国工商银行"
#define WIFI_PASSWORD "88888888"
```

### MQTT主题
```c
#define PUBLISH_TOPIC "$oc/devices/" DEVICE_ID "/sys/properties/report"
#define SUBSCRIBE_TOPIC "$oc/devices/" DEVICE_ID "/sys/commands/+"
```

## 🚀 核心函数（基于成熟版本）

### 1. MQTT初始化
```c
void mqtt_init(void);
```
- 自动重连机制（goto begin）
- 网络连接 + MQTT客户端初始化
- 自动订阅命令主题
- 连接失败自动重试

### 2. 连接状态检查
```c
unsigned int mqtt_is_connected(void);
bool IoTCloud_IsConnected(void);  // 兼容性函数
```

### 3. 数据发送
```c
void send_msg_to_mqtt(e_iot_data *iot_data);
int IoTCloud_SendData(const LandslideIotData *data);  // 兼容性函数
```

### 4. 消息等待
```c
int wait_message(void);
```

## 📊 数据结构

### 成熟版本数据结构
```c
typedef struct {
    // 基础传感器数据
    double illumination;    // 光照强度 (lux)
    double temperature;     // 温度 (°C)
    double humidity;        // 湿度 (%)

    // MPU6050 数据
    int16_t accel_x;       // X轴加速度原始值
    int16_t accel_y;       // Y轴加速度原始值
    int16_t accel_z;       // Z轴加速度原始值
    int16_t gyro_x;        // X轴陀螺仪原始值
    int16_t gyro_y;        // Y轴陀螺仪原始值
    int16_t gyro_z;        // Z轴陀螺仪原始值
    float mpu_temp;        // MPU6050温度
    float ultrasonic_distance; // 超声波距离（-1表示无此传感器）
    int vibration;         // 振动强度

    // 扩展数据（滑坡监测专用）
    float angle_x;         // X轴倾斜角度 (°)
    float angle_y;         // Y轴倾斜角度 (°)
    int risk_level;        // 风险等级 (0-4)
    int alarm_active;      // 报警状态 (0/1)
    uint32_t uptime;       // 系统运行时间 (秒)
} e_iot_data;
```

### 数据转换
- 自动转换 `LandslideIotData` → `e_iot_data`
- 保持向后兼容性
- 处理数据类型差异

## 🔄 工作流程

### 1. 系统启动
```
IoTCloud_Init() → mqtt_init() → 自动连接
```

### 2. 网络任务
```
IoTNetworkTask():
├── WiFi配置和连接
├── MQTT初始化
└── 保持连接循环
```

### 3. 数据上传
```
主程序 → IoTCloud_SendData() → convert_landslide_to_iot_data() → send_msg_to_mqtt()
```

## 📡 MQTT消息格式

### 发布消息
```json
{
  "services": [{
    "service_id": "smartHome",
    "properties": {
      "temperature": 25.5,
      "humidity": 60.0,
      "illumination": 1200.0,
      "acceleration_x": 100,
      "acceleration_y": -50,
      "acceleration_z": 1000,
      "gyroscope_x": 10,
      "gyroscope_y": -5,
      "gyroscope_z": 2,
      "mpu_temperature": 26.0,
      "ultrasonic_distance": -1,
      "vibration": 0,
      "angle_x": 2.5,
      "angle_y": -1.2,
      "risk_level": 1,
      "alarm_active": 0,
      "uptime": 3600
    }
  }]
}
```

## 🛠️ 特性

### ✅ 成熟版本特性
- **自动重连**: 连接失败自动重试
- **错误处理**: 完善的错误处理机制
- **兼容性**: 保持与现有代码的兼容性
- **数据转换**: 自动处理数据结构转换
- **状态管理**: 完善的连接状态管理

### ✅ 滑坡监测扩展
- **风险等级**: 支持0-4级风险评估
- **倾角监测**: X/Y轴倾斜角度
- **报警状态**: 报警激活状态
- **运行时间**: 系统运行时间统计

## 🧪 测试

### 测试文件
- `test_iot_mature.c`: 完整的IoT功能测试

### 测试内容
1. MQTT连接测试
2. 数据发送测试
3. 兼容性函数测试
4. 消息等待测试
5. 持续上传测试

## 📝 使用说明

### 1. 编译
```bash
hb build -f
```

### 2. 运行
系统启动后自动初始化IoT功能

### 3. 监控
查看串口输出，确认连接状态和数据上传

## 🔍 调试信息

### 连接成功输出
```
MQTT connected and subscribed.
=== Huawei Cloud IoT Platform Connected ===
Service: smartHome
Device ID: 6815a14f9314d118511807c6_rk2206_0_0_2025070315
Host: 117.78.5.125:1883
Status: Ready for data upload and command reception
==========================================
```

### 数据上传输出
```
MQTT publish success: {"services":[...]}
=== IoT Data Upload #1 ===
Service: smartHome | Risk=1 | Temp=25.5°C | Humidity=60.0%
Motion: X=2.5° Y=-1.2° | Light=1200.0Lux | Alarm=NORMAL
========================
```

## 🎯 优势

1. **基于成熟代码**: 使用经过验证的IoT配置
2. **自动重连**: 网络断开自动恢复
3. **完整功能**: 支持数据上传和命令接收
4. **向后兼容**: 不影响现有代码
5. **易于维护**: 清晰的代码结构和注释

## 📞 技术支持

如有问题，请检查：
1. WiFi连接状态
2. MQTT服务器可达性
3. 设备认证参数
4. 华为云IoT平台配置
