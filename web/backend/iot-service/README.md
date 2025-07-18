# 滑坡监测IoT数据接收服务

简单的Node.js服务，专门用于接收华为云IoT平台推送的数据并存储到Supabase数据库。

## 快速开始

### 1. 配置Supabase
编辑 `iot-server.js` 文件，找到以下两行并替换为您的实际配置：

```javascript
const SUPABASE_URL = 'your_supabase_url_here';
const SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';
```

### 2. 启动服务
```bash
chmod +x start.sh
./start.sh
```

### 3. 验证服务
```bash
# 健康检查
curl http://localhost:5100/health

# 服务信息
curl http://localhost:5100/info
```

## API接口

### 健康检查
- **URL**: `GET /health`
- **响应**: 
```json
{
  "status": "OK",
  "timestamp": "2024-01-17T12:00:00.000Z",
  "service": "landslide-iot-service",
  "port": 5100
}
```

### 华为IoT数据接收
- **URL**: `POST /iot/huawei`
- **Content-Type**: `application/json`
- **功能**: 接收华为云IoT平台推送的数据
- **响应**:
```json
{
  "Status Code": 200,
  "message": "数据接收成功",
  "timestamp": "2024-01-17T12:00:00.000Z",
  "device_id": "device-001",
  "processed_services": 2,
  "total_services": 2,
  "processing_time_ms": 45
}
```

## 测试功能

运行测试脚本：
```bash
npm test
```

或手动测试：
```bash
curl -X POST http://localhost:5100/iot/huawei \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "device.property",
    "event": "report",
    "event_time": "20240117T120000Z",
    "notify_data": {
      "header": {
        "device_id": "test-001",
        "product_id": "landslide-monitor"
      },
      "body": {
        "services": [{
          "service_id": "sensor_data",
          "properties": {
            "temperature": 25.5,
            "humidity": 60.2
          }
        }]
      }
    }
  }'
```

## 管理命令

```bash
# 启动服务
./start.sh

# 查看日志
tail -f server.log

# 停止服务
pkill -f iot-server.js

# 查看进程
ps aux | grep iot-server
```

## 华为云IoT配置

在华为云IoT平台的数据转发配置中，设置URL为：
```
https://ylsf.chat:1020/iot/huawei
```

确保您的nginx配置包含：
```nginx
location /iot/ {
    proxy_pass http://127.0.0.1:5100;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## 数据处理

服务会自动：
1. 接收华为IoT标准格式数据
2. 解析设备ID、产品ID、服务ID
<<<<<<< HEAD
3. 提取所有传感器属性
4. 格式化时间戳
5. 存储到Supabase的`iot_data`表

=======
3. 提取所有传感器属性并进行字段映射
4. 格式化时间戳
5. 计算总加速度和总角速度
6. 直接存储到Supabase的`iot_data`表（前端使用的表）

### 字段映射说明
华为IoT数据字段会自动映射到`iot_data`表结构：
- 基础传感器数据：温度、湿度、光照度、加速度、陀螺仪等
- 位置信息：经纬度
- 设备状态：运行时间、角度、风险等级、报警状态
- 自动计算：总加速度、总角速度

>>>>>>> 9fe64841431b07a852a4f908ce5aeae98147da1b
## 故障排除

### 服务无法启动
```bash
# 检查端口占用
sudo netstat -tlnp | grep :5100

# 查看错误日志
cat server.log
```

### 数据库连接失败
- 检查Supabase URL和KEY是否正确
- 确认Supabase项目是否正常运行
- 检查网络连接

### 数据插入失败
- 确认`iot_data`表存在
- 检查表结构是否匹配（执行database_migration.sql添加新字段）
- 查看Supabase控制台的错误日志

## 文件说明

- `iot-server.js` - 主服务文件
- `package.json` - 项目配置
- `start.sh` - 启动脚本
- `test-server.js` - 测试脚本
- `server.log` - 运行日志（启动后生成）

## 核心功能

这个服务专注于：
- **简单可靠** - 最小化依赖，专注核心功能
- **实时处理** - 立即处理接收到的IoT数据
<<<<<<< HEAD
- **详细日志** - 完整记录数据处理过程
- **错误处理** - 优雅处理各种异常情况
- **数据完整** - 保留所有原始数据字段
=======
- **智能分析** - 自动检测异常、分析风险趋势
- **设备管理** - 自动维护设备信息和位置数据
- **详细日志** - 完整记录数据处理过程
- **错误处理** - 优雅处理各种异常情况
- **数据完整** - 保留所有原始数据字段

## 数据处理流程

```
华为IoT数据 → iot_data表 → 数据处理器 → 业务表
                              ├── iot_devices (设备信息)
                              ├── iot_device_locations (设备位置)
                              ├── iot_anomalies (异常检测)
                              └── iot_anomaly_trends (风险趋势)
```

### 自动处理功能
1. **设备管理**: 自动注册新设备，更新设备活跃状态
2. **位置跟踪**: 基于GPS数据更新设备位置信息
3. **异常检测**: 实时检测温度、湿度、加速度等异常
4. **风险评估**: 分析滑坡风险等级和趋势
5. **数据清洗**: 自动处理和验证传感器数据
>>>>>>> 9fe64841431b07a852a4f908ce5aeae98147da1b
