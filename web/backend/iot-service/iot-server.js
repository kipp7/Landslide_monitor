const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const DataProcessor = require('./data-processor');
const DeviceMapper = require('./device-mapper');
const HuaweiIoTService = require('./huawei-iot-service');

const app = express();
const PORT = 5100;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Supabase 配置 - 请替换为您的实际配置
const SUPABASE_URL= 'https://sdssoyyjhunltmcjoxtg.supabase.co'
const SUPABASE_ANON_KEY= 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkc3NveXlqaHVubHRtY2pveHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0MzY3NTIsImV4cCI6MjA1NzAxMjc1Mn0.FisL8HivC_g-cnq4o7BNqHQ8vKDUpgfW3lUINfDXMSA'


// 如果配置了环境变量，优先使用环境变量
const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// 初始化设备映射器和数据处理器
const deviceMapper = new DeviceMapper();
const dataProcessor = new DataProcessor();

// 初始化华为云IoT服务
const huaweiIoTService = new HuaweiIoTService({
  // 这些配置可以通过环境变量设置，或者在这里直接配置
  // projectId: 'your-project-id',
  // domainName: 'your-domain-name',
  // iamUsername: 'your-iam-username',
  // iamPassword: 'your-iam-password',
  // deviceId: '6815a14f9314d118511807c6_rk2206'
});



// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'landslide-iot-service',
    port: PORT
  });
});

// 服务信息接口
app.get('/info', (req, res) => {
  res.json({
    name: 'Landslide IoT Service',
    version: '1.0.0',
    description: '滑坡监测IoT数据接收服务',
    endpoints: {
      health: 'GET /health',
      info: 'GET /info',
      iot_data: 'POST /iot/huawei',
      device_mappings: 'GET /devices/mappings',
      device_list: 'GET /devices/list',
      device_info: 'GET /devices/info/:simpleId',
      huawei_config: 'GET /huawei/config',
      device_shadow: 'GET /huawei/devices/:deviceId/shadow',
      send_command: 'POST /huawei/devices/:deviceId/commands',
      command_templates: 'GET /huawei/command-templates'
    }
  });
});

// 设备列表接口 - 放在最前面避免路由冲突
app.get('/devices/list', async (req, res) => {
  try {
    const { data: devices, error } = await supabase
      .from('iot_devices')
      .select('device_id, friendly_name, last_active')
      .order('device_id');

    if (error) {
      throw error;
    }

    // 添加状态判断和扩展信息
    const now = new Date();
    const deviceList = devices.map(device => {
      const lastActive = new Date(device.last_active);
      const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / 60000);

      return {
        device_id: device.device_id,
        friendly_name: '龙门滑坡监测站', // 统一使用龙门滑坡监测站
        display_name: '龙门滑坡监测站',
        location_name: '防城港华石镇龙门村',
        device_type: 'rk2206',
        status: diffMinutes > 5 ? 'offline' : 'online',
        last_active: device.last_active
      };
    });

    res.json({
      success: true,
      data: deviceList,
      count: deviceList.length
    });
  } catch (error) {
    console.error('❌ 获取设备列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备列表失败',
      message: error.message
    });
  }
});

// 设备映射接口 - 简化版本
app.get('/devices/mappings', async (req, res) => {
  try {
    // 简化的映射数据
    const mappings = [
      {
        simple_id: 'device_1',
        actual_device_id: '6815a14f9314d118511807c6_rk2206',
        device_name: '龙门滑坡监测站',
        location_name: '防城港华石镇龙门村',
        device_type: 'rk2206',
        latitude: 21.6847,
        longitude: 108.3516,
        status: 'active',
        description: '龙门村滑坡监测设备',
        install_date: '2025-06-01',
        last_data_time: new Date().toISOString(),
        online_status: 'online'
      }
    ];

    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
  } catch (error) {
    console.error('❌ 获取设备映射失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备映射失败',
      message: error.message
    });
  }
});

// 获取特定设备信息 - 简化版本
app.get('/devices/info/:simpleId', async (req, res) => {
  try {
    const { simpleId } = req.params;

    // 简化的设备信息
    if (simpleId === 'device_1') {
      res.json({
        success: true,
        data: {
          simple_id: 'device_1',
          actual_device_id: '6815a14f9314d118511807c6_rk2206',
          device_name: '龙门滑坡监测站',
          location: {
            location_name: '防城港华石镇龙门村',
            latitude: 21.6847,
            longitude: 108.3516,
            device_type: 'rk2206'
          }
        }
      });
    } else {
      res.status(404).json({
        success: false,
        error: '设备不存在'
      });
    }
  } catch (error) {
    console.error('❌ 获取设备信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备信息失败',
      message: error.message
    });
  }
});

// 华为IoT数据接收接口
app.post('/iot/huawei', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('=== 收到华为IoT数据 ===');
    console.log('时间:', new Date().toISOString());
    console.log('数据:', JSON.stringify(req.body, null, 2));
    
    // 基本数据验证
    if (!req.body || !req.body.notify_data) {
      console.log('数据格式错误: 缺少notify_data');
      return res.status(400).json({
        "Status Code": 400,
        "message": "数据格式错误",
        "error": "缺少notify_data字段"
      });
    }

    const { notify_data, event_time, resource, event } = req.body;
    
    if (!notify_data.body || !notify_data.body.services) {
      console.log('数据格式错误: 缺少services');
      return res.status(400).json({
        "Status Code": 400,
        "message": "数据格式错误",
        "error": "缺少services字段"
      });
    }

    const { header, body } = notify_data;
    const { device_id, product_id } = header;
    const { services } = body;

    console.log(`设备ID: ${device_id}`);
    console.log(`产品ID: ${product_id}`);
    console.log(`服务数量: ${services.length}`);

    let processedCount = 0;

    // 处理每个服务的数据
    for (const service of services) {
      const { service_id, properties, event_time: serviceEventTime } = service;
      
      console.log(`\n处理服务: ${service_id}`);
      console.log('属性数据:', properties);
      
      try {
        // 获取或创建设备的简洁ID
        const simpleDeviceId = await deviceMapper.getSimpleId(device_id, {
          device_name: `监测站-${device_id.slice(-6)}`,
          location_name: '防城港华石镇',
          latitude: properties.latitude,
          longitude: properties.longitude
        });

        // 构造要插入到 iot_data 表的数据（使用简洁设备ID）
        const sensorData = {
          // 基本字段 - 使用简洁的设备ID
          device_id: simpleDeviceId,
          event_time: formatEventTime(serviceEventTime || event_time),

          // 传感器数据字段 - 直接映射
          temperature: properties.temperature,
          humidity: properties.humidity,
          illumination: properties.illumination,
          acceleration_x: properties.acceleration_x ? parseInt(properties.acceleration_x) : null,
          acceleration_y: properties.acceleration_y ? parseInt(properties.acceleration_y) : null,
          acceleration_z: properties.acceleration_z ? parseInt(properties.acceleration_z) : null,
          gyroscope_x: properties.gyroscope_x ? parseInt(properties.gyroscope_x) : null,
          gyroscope_y: properties.gyroscope_y ? parseInt(properties.gyroscope_y) : null,
          gyroscope_z: properties.gyroscope_z ? parseInt(properties.gyroscope_z) : null,
          mpu_temperature: properties.mpu_temperature,
          latitude: properties.latitude,
          longitude: properties.longitude,
          vibration: properties.vibration ? parseInt(properties.vibration) : null,

          // 计算字段
          acceleration_total: calculateTotal(properties.acceleration_x, properties.acceleration_y, properties.acceleration_z),
          gyroscope_total: calculateTotal(properties.gyroscope_x, properties.gyroscope_y, properties.gyroscope_z),

          // 新增字段（需要先在iot_data表中添加这些列）
          risk_level: properties.risk_level,
          alarm_active: properties.alarm_active,
          uptime: properties.uptime,
          angle_x: properties.angle_x,
          angle_y: properties.angle_y,
          angle_z: properties.angle_z,

          // GPS形变分析字段 - 直接从华为云IoT读取
          deformation_distance_3d: properties.deformation_distance_3d || properties.deform_3d || properties.displacement_3d || null,
          deformation_horizontal: properties.deformation_horizontal || properties.deform_h || properties.displacement_h || null,
          deformation_vertical: properties.deformation_vertical || properties.deform_v || properties.displacement_v || null,
          deformation_velocity: properties.deformation_velocity || properties.deform_vel || properties.velocity || null,
          deformation_risk_level: properties.deformation_risk_level || properties.deform_risk || properties.risk_deform || null,
          deformation_type: properties.deformation_type || properties.deform_type || properties.type_deform || null,
          deformation_confidence: properties.deformation_confidence || properties.deform_conf || properties.confidence || null,
          baseline_established: properties.baseline_established || properties.baseline_ok || properties.has_baseline || null,

          // 超声波距离（如果有的话）
          ultrasonic_distance: properties.ultrasonic_distance
        };

        // 移除undefined值
        Object.keys(sensorData).forEach(key => {
          if (sensorData[key] === undefined) {
            delete sensorData[key];
          }
        });

        console.log('准备插入数据:', sensorData);

        // 插入到Supabase数据库的 iot_data 表
        const { data, error } = await supabase
          .from('iot_data')
          .insert([sensorData])
          .select();

        if (error) {
          console.error('❌ 数据库插入失败:', error);
          console.error('错误详情:', error.message);
        } else {
          console.log('数据插入成功');
          if (data && data.length > 0) {
            console.log('插入的记录ID:', data[0].id);
          }
          processedCount++;
        }

      } catch (serviceError) {
        console.error(`❌ 处理服务 ${service_id} 时出错:`, serviceError.message);
      }
    }

    const processingTime = Date.now() - startTime;
    console.log(`\n处理完成，耗时: ${processingTime}ms`);
    console.log(`成功处理: ${processedCount}/${services.length} 个服务`);
    console.log('=== 处理结束 ===\n');

    // 返回成功响应给华为云
    res.status(200).json({
      "Status Code": 200,
      "message": "数据接收成功",
      "timestamp": new Date().toISOString(),
      "device_id": device_id,
      "processed_services": processedCount,
      "total_services": services.length,
      "processing_time_ms": processingTime
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ 处理华为IoT数据时发生错误:', error);
    console.error('错误堆栈:', error.stack);
    
    res.status(500).json({
      "Status Code": 500,
      "message": "数据处理失败",
      "error": error.message,
      "timestamp": new Date().toISOString(),
      "processing_time_ms": processingTime
    });
  }
});

// 计算三轴数据的总值
function calculateTotal(x, y, z) {
  if (x === undefined || y === undefined || z === undefined) {
    return null;
  }

  const numX = parseFloat(x) || 0;
  const numY = parseFloat(y) || 0;
  const numZ = parseFloat(z) || 0;

  return Math.sqrt(numX * numX + numY * numY + numZ * numZ);
}

// 格式化事件时间
function formatEventTime(eventTime) {
  if (!eventTime) {
    return new Date().toISOString();
  }

  try {
    // 华为IoT时间格式: 20151212T121212Z
    if (/^\d{8}T\d{6}Z$/.test(eventTime)) {
      const year = eventTime.substring(0, 4);
      const month = eventTime.substring(4, 6);
      const day = eventTime.substring(6, 8);
      const hour = eventTime.substring(9, 11);
      const minute = eventTime.substring(11, 13);
      const second = eventTime.substring(13, 15);
      
      const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
      const date = new Date(isoString);
      
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    // 尝试直接解析
    const date = new Date(eventTime);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // 如果都失败，返回当前时间
    console.warn('⚠️  无法解析时间格式，使用当前时间:', eventTime);
    return new Date().toISOString();
  } catch (error) {
    console.warn('⚠️  时间格式化失败，使用当前时间:', eventTime, error.message);
    return new Date().toISOString();
  }
}

// ==================== 华为云IoT相关接口 ====================

// 华为云IoT配置检查接口
app.get('/huawei/config', (req, res) => {
  try {
    const configCheck = huaweiIoTService.checkConfig();
    res.json({
      success: true,
      data: configCheck
    });
  } catch (error) {
    console.error('❌ 配置检查失败:', error);
    res.status(500).json({
      success: false,
      error: '配置检查失败',
      message: error.message
    });
  }
});

// 获取设备影子信息
app.get('/huawei/devices/:deviceId/shadow', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`获取设备影子: ${deviceId}`);

    const shadowData = await huaweiIoTService.getDeviceShadow(deviceId);

    res.json({
      success: true,
      data: shadowData
    });
  } catch (error) {
    console.error('❌ 获取设备影子失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备影子失败',
      message: error.message
    });
  }
});

// 向设备下发命令
app.post('/huawei/devices/:deviceId/commands', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const commandData = req.body;

    console.log(`向设备下发命令: ${deviceId}`);
    console.log('命令数据:', JSON.stringify(commandData, null, 2));

    // 验证命令数据格式
    if (!commandData.service_id || !commandData.command_name) {
      return res.status(400).json({
        success: false,
        error: '命令数据格式错误',
        message: '缺少必要字段: service_id 或 command_name'
      });
    }

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: '命令下发成功'
    });
  } catch (error) {
    console.error('❌ 命令下发失败:', error);
    res.status(500).json({
      success: false,
      error: '命令下发失败',
      message: error.message
    });
  }
});

// 获取命令模板
app.get('/huawei/command-templates', (req, res) => {
  try {
    const templates = huaweiIoTService.getCommandTemplates();

    // 转换为更友好的格式
    const templateList = Object.keys(templates).map(key => ({
      name: key,
      description: getTemplateDescription(key),
      example: templates[key]()
    }));

    res.json({
      success: true,
      data: templateList
    });
  } catch (error) {
    console.error('❌ 获取命令模板失败:', error);
    res.status(500).json({
      success: false,
      error: '获取命令模板失败',
      message: error.message
    });
  }
});

// 快捷命令接口 - LED控制
app.post('/huawei/devices/:deviceId/led', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action } = req.body; // 'on' 或 'off'

    const templates = huaweiIoTService.getCommandTemplates();
    const commandData = templates.ledControl(action === 'on' ? 'ON' : 'OFF');

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: `LED ${action === 'on' ? '开启' : '关闭'}命令下发成功`
    });
  } catch (error) {
    console.error('❌ LED控制失败:', error);
    res.status(500).json({
      success: false,
      error: 'LED控制失败',
      message: error.message
    });
  }
});

// 快捷命令接口 - 电机控制
app.post('/huawei/devices/:deviceId/motor', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { action } = req.body; // 'on' 或 'off'

    const templates = huaweiIoTService.getCommandTemplates();
    const commandData = templates.motorControl(action === 'on' ? 'ON' : 'OFF');

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: `电机 ${action === 'on' ? '开启' : '关闭'}命令下发成功`
    });
  } catch (error) {
    console.error('❌ 电机控制失败:', error);
    res.status(500).json({
      success: false,
      error: '电机控制失败',
      message: error.message
    });
  }
});

// 快捷命令接口 - 系统重启
app.post('/huawei/devices/:deviceId/reboot', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const templates = huaweiIoTService.getCommandTemplates();
    const commandData = templates.systemReboot();

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: '系统重启命令下发成功'
    });
  } catch (error) {
    console.error('❌ 系统重启失败:', error);
    res.status(500).json({
      success: false,
      error: '系统重启失败',
      message: error.message
    });
  }
});

// 辅助函数：获取模板描述
function getTemplateDescription(templateName) {
  const descriptions = {
    ledControl: 'LED灯控制 - 开启或关闭LED灯',
    motorControl: '电机控制 - 开启或关闭电机',
    autoModeControl: '自动模式控制 - 开启或关闭自动模式',
    systemReboot: '系统重启 - 重启设备系统',
    setDataInterval: '设置数据采集频率 - 设置传感器数据采集间隔',
    setAlarmThreshold: '设置报警阈值 - 设置各种传感器的报警阈值'
  };
  return descriptions[templateName] || '未知命令';
}

// ==================== 华为云IoT接口结束 ====================

// 404处理
app.use((req, res) => {
  res.status(404).json({
    "Status Code": 404,
    "message": "接口不存在",
    "path": req.path,
    "method": req.method
  });
});

// 错误处理
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    "Status Code": 500,
    "message": "服务器内部错误",
    "error": error.message
  });
});

// 启动服务器
app.listen(PORT, '0.0.0.0', async () => {
  console.log('滑坡监测IoT服务已启动');
  console.log(`端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`服务信息: http://localhost:${PORT}/info`);
  console.log(`IoT数据接收: http://localhost:${PORT}/iot/huawei`);
  console.log('启动时间:', new Date().toISOString());
  console.log('=====================================');

  // 初始化设备映射器和数据处理器
  try {
    await deviceMapper.initializeCache();
    console.log('设备映射器初始化成功');
  } catch (error) {
    console.error('❌ 设备映射器初始化失败:', error);
  }

  try {
    await dataProcessor.start();
    console.log('数据处理器启动成功');
  } catch (error) {
    console.error('❌ 数据处理器启动失败:', error);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});
