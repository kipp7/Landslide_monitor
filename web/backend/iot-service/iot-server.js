// 首先加载环境变量
try {
  require('dotenv').config();
} catch (error) {
  console.log('dotenv未安装，使用默认配置');
}

const express = require('express');
const cors = require('cors');
const http = require('http');

// 尝试加载socket.io，如果失败则提供降级方案
let Server, io;
try {
  const socketIO = require('socket.io');
  Server = socketIO.Server;
  console.log('Socket.IO 加载成功');
} catch (error) {
  console.log('Socket.IO 未安装，将使用轮询模式');
  console.log('请运行: npm install socket.io');
  Server = null;
}

const { createClient } = require('@supabase/supabase-js');
const DataProcessor = require('./data-processor');
const DeviceMapper = require('./device-mapper');
const HuaweiIoTService = require('./huawei-iot-service');

const app = express();
const server = http.createServer(app);

// 初始化Socket.IO（如果可用）
if (Server) {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  console.log('WebSocket服务器初始化成功');
} else {
  console.log('WebSocket服务器未初始化（Socket.IO未安装）');
}

const PORT = 5100;

// 辅助函数：根据华为云IoT数据计算健康度
function calculateHealthFromIoTData(properties) {
  let score = 100;

  // 温度异常检测
  if (properties.temperature > 60 || properties.temperature < -20) {
    score -= 30;
  } else if (properties.temperature > 50 || properties.temperature < -10) {
    score -= 15;
  }

  // 湿度异常检测
  if (properties.humidity > 95 || properties.humidity < 5) {
    score -= 25;
  } else if (properties.humidity > 90 || properties.humidity < 10) {
    score -= 10;
  }

  // 振动异常检测
  if (properties.vibration > 3.0) {
    score -= 40;
  } else if (properties.vibration > 2.0) {
    score -= 20;
  } else if (properties.vibration > 1.5) {
    score -= 10;
  }

  // 风险等级影响
  if (properties.risk_level > 0) {
    score -= properties.risk_level * 15;
  }

  // 报警状态影响
  if (properties.alarm_active) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

// 辅助函数：根据运行时间计算电池电量
function calculateBatteryFromUptime(uptime, temperature) {
  let batteryLevel = 100;

  // 根据运行时间消耗电量（每小时消耗1.5%）
  const hoursRunning = uptime / 3600;
  batteryLevel -= hoursRunning * 1.5;

  // 温度影响电池性能
  if (temperature > 40) {
    batteryLevel -= 10;
  } else if (temperature < 0) {
    batteryLevel -= 15;
  }

  return Math.max(0, Math.min(100, batteryLevel));
}

// 辅助函数：转换华为云IoT时间格式
function parseHuaweiIoTTime(timeString) {
  try {
    // 华为云IoT时间格式：20250723T055331Z
    // 转换为标准ISO格式：2025-07-23T05:53:31Z
    if (timeString && timeString.match(/^\d{8}T\d{6}Z$/)) {
      const isoTimeString = timeString.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
      const date = new Date(isoTimeString);

      // 验证日期是否有效
      if (isNaN(date.getTime())) {
        console.error('时间转换失败:', { original: timeString, converted: isoTimeString });
        return null;
      }

      return date;
    } else {
      // 尝试直接解析（可能已经是标准格式）
      const date = new Date(timeString);
      return isNaN(date.getTime()) ? null : date;
    }
  } catch (error) {
    console.error('时间解析错误:', error, timeString);
    return null;
  }
}

// 辅助函数：检查数据库中的最新数据（更准确的在线判断）
async function checkDatabaseForRecentData(deviceId) {
  try {
    const { data, error } = await supabase
      .from('iot_data')
      .select('event_time, temperature, humidity')
      .eq('device_id', deviceId)
      .order('event_time', { ascending: false })
      .limit(1);

    if (error) {
      console.error('查询数据库最新数据失败:', error);
      return { hasRecentData: false, lastDataTime: null };
    }

    if (!data || data.length === 0) {
      console.log(`设备 ${deviceId} 数据库中没有数据`);
      return { hasRecentData: false, lastDataTime: null };
    }

    const latestRecord = data[0];
    const lastDataTime = new Date(latestRecord.event_time);
    const now = new Date();
    const timeDiff = now.getTime() - lastDataTime.getTime();
    const maxOfflineTime = 60 * 1000; // 1分钟
    const hasRecentData = timeDiff < maxOfflineTime;

    console.log(`设备 ${deviceId} 数据库数据检查:`, {
      lastDataTime: latestRecord.event_time,
      timeDiff: Math.round(timeDiff / 1000) + '秒前',
      hasRecentData,
      temperature: latestRecord.temperature,
      humidity: latestRecord.humidity
    });

    return {
      hasRecentData,
      lastDataTime: latestRecord.event_time,
      latestData: latestRecord
    };
  } catch (error) {
    console.error('检查数据库数据失败:', error);
    return { hasRecentData: false, lastDataTime: null };
  }
}

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 支持nginx代理的路径前缀处理
app.use((req, res, next) => {
  // 如果路径以 /iot 开头，去掉这个前缀
  if (req.url.startsWith('/iot')) {
    req.url = req.url.replace(/^\/iot/, '') || '/';
    console.log(`路径重写: ${req.originalUrl} -> ${req.url}`);
  }
  next();
});

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

// 使用环境变量或默认配置
const huaweiIoTService = new HuaweiIoTService({
  iamEndpoint: process.env.HUAWEI_IAM_ENDPOINT || 'https://iam.myhuaweicloud.com',
  iotEndpoint: process.env.HUAWEI_IOT_ENDPOINT || 'https://361017cfc6.st1.iotda-app.cn-north-4.myhuaweicloud.com:443',
  domainName: process.env.HUAWEI_DOMAIN_NAME || 'hid_d-zeks2kzzvtkdc',
  iamUsername: process.env.HUAWEI_IAM_USERNAME || 'k',
  iamPassword: process.env.HUAWEI_IAM_PASSWORD || '12345678k',
  projectId: process.env.HUAWEI_PROJECT_ID || '41a2637bc1ba4889bc3b49c4e2ab9e77',
  projectName: process.env.HUAWEI_PROJECT_NAME || 'cn-north-4',
  deviceId: process.env.HUAWEI_DEVICE_ID || '6815a14f9314d118511807c6_rk2206'
});



// 健康检查接口 - 支持直接访问和nginx代理
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
    console.error('获取设备列表失败:', error);
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
    console.error('获取设备映射失败:', error);
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
    console.error('获取设备信息失败:', error);
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
          console.error('数据库插入失败:', error);
          console.error('错误详情:', error.message);
        } else {
          console.log('数据插入成功');
          if (data && data.length > 0) {
            console.log('插入的记录ID:', data[0].id);
          }
          processedCount++;
        }

      } catch (serviceError) {
        console.error(`处理服务 ${service_id} 时出错:`, serviceError.message);
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
    console.error('处理华为IoT数据时发生错误:', error);
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
    console.warn('无法解析时间格式，使用当前时间:', eventTime);
    return new Date().toISOString();
  } catch (error) {
    console.warn('时间格式化失败，使用当前时间:', eventTime, error.message);
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
    console.error('配置检查失败:', error);
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
    console.error('获取设备影子失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备影子失败',
      message: error.message
    });
  }
});

// 获取设备完整管理信息（类似前端API的功能）
app.get('/devices/:deviceId/management', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`获取设备管理信息: ${deviceId}`);

    // 1. 设备基本配置
    const deviceConfig = {
      device_1: {
        device_id: 'device_1',
        real_name: '6815a14f9314d118511807c6_rk2206',
        display_name: '龙门滑坡监测站',
        location: '防城港华石镇龙门村',
        coordinates: { lat: 21.6847, lng: 108.3516 },
        device_type: '软通套件',
        firmware_version: 'v2.1.3',
        install_date: '2025-06-01'
      }
    };

    const baseInfo = deviceConfig[deviceId];
    if (!baseInfo) {
      return res.status(404).json({
        success: false,
        error: '设备不存在'
      });
    }

    // 2. 获取华为云IoT实时状态
    let iotStatus = { status: 'offline', real_time_data: null };
    try {
      const shadowData = await huaweiIoTService.getDeviceShadow(baseInfo.real_name);
      if (shadowData.shadow && shadowData.shadow.length > 0) {
        const properties = shadowData.shadow[0].reported?.properties;
        if (properties) {
          iotStatus = {
            status: 'online',
            real_time_data: properties,
            last_update: shadowData.shadow[0].reported.event_time
          };
        }
      }
    } catch (iotError) {
      console.warn('获取华为云IoT状态失败:', iotError.message);
    }

    // 3. 从Supabase获取历史数据和统计信息
    const { data: latestData, error: dataError } = await supabase
      .from('iot_data')
      .select(`
        *,
        latitude,
        longitude,
        deformation_distance_3d,
        deformation_horizontal,
        deformation_vertical,
        deformation_velocity,
        deformation_risk_level,
        deformation_type,
        deformation_confidence,
        baseline_established
      `)
      .eq('device_id', deviceId)
      .order('event_time', { ascending: false })
      .limit(1);

    if (dataError) {
      console.error('获取传感器数据失败:', dataError);
    }

    // 4. 获取今日数据统计
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: todayData, error: statsError } = await supabase
      .from('iot_data')
      .select('id')
      .eq('device_id', deviceId)
      .gte('event_time', today)
      .lt('event_time', tomorrowStr);

    if (statsError) {
      console.error('获取今日统计失败:', statsError);
    }

    // 5. 计算设备状态和健康度
    const latestRecord = latestData?.[0];
    const hasRecentData = latestRecord &&
      (Date.now() - new Date(latestRecord.event_time).getTime()) < 60 * 1000;

    // 优先使用华为云IoT状态，如果获取不到则使用Supabase数据判断
    const isOnline = iotStatus.status === 'online' || hasRecentData;

    console.log(`设备 ${deviceId} 在线状态判断:`, {
      iotStatus: iotStatus.status,
      hasRecentData,
      finalStatus: isOnline ? 'online' : 'offline',
      iotLastUpdate: iotStatus.last_update,
      supabaseLastUpdate: latestRecord?.event_time
    });

    // 健康度计算（基于数据完整性和时效性）
    let healthScore = 0;
    if (isOnline) {
      if (iotStatus.real_time_data) {
        // 使用华为云IoT实时数据计算健康度
        healthScore = calculateHealthFromIoTData(iotStatus.real_time_data);
      } else if (latestRecord) {
        // 使用Supabase历史数据计算健康度
        const dataAge = Date.now() - new Date(latestRecord.event_time).getTime();
        const ageScore = Math.max(0, 100 - (dataAge / (60 * 1000)) * 2);

        const requiredFields = ['temperature', 'humidity'];
        const validFields = requiredFields.filter(field =>
          latestRecord[field] !== null && latestRecord[field] !== undefined
        );
        const completenessScore = (validFields.length / requiredFields.length) * 100;

        healthScore = Math.round((ageScore + completenessScore) / 2);
      }
    }

    // 信号强度计算
    const signalStrength = isOnline ? Math.min(100, healthScore + Math.random() * 20) : 0;

    // 电池电量计算
    let batteryLevel = 0;
    if (iotStatus.real_time_data?.uptime) {
      batteryLevel = calculateBatteryFromUptime(iotStatus.real_time_data.uptime, iotStatus.real_time_data.temperature);
    } else if (isOnline) {
      batteryLevel = Math.max(20, 100 - Math.random() * 30);
    }

    // 6. 构建完整的设备信息
    const deviceInfo = {
      ...baseInfo,
      status: isOnline ? 'online' : 'offline',
      last_active: iotStatus.last_update || latestRecord?.event_time || new Date().toISOString(),
      data_count_today: todayData?.length || 0,
      last_data_time: iotStatus.last_update || latestRecord?.event_time || new Date().toISOString(),
      health_score: Math.round(healthScore),
      temperature: iotStatus.real_time_data?.temperature || latestRecord?.temperature || 0,
      humidity: iotStatus.real_time_data?.humidity || latestRecord?.humidity || 0,
      battery_level: Math.round(batteryLevel),
      signal_strength: Math.round(signalStrength),
      real_time_data: iotStatus.real_time_data
    };

    // 7. GPS形变分析数据
    let deformationData = null;
    if (latestRecord) {
      deformationData = {
        latitude: latestRecord.latitude,
        longitude: latestRecord.longitude,
        deformation_distance_3d: latestRecord.deformation_distance_3d,
        deformation_horizontal: latestRecord.deformation_horizontal,
        deformation_vertical: latestRecord.deformation_vertical,
        deformation_velocity: latestRecord.deformation_velocity,
        deformation_risk_level: latestRecord.deformation_risk_level,
        deformation_type: latestRecord.deformation_type,
        deformation_confidence: latestRecord.deformation_confidence,
        baseline_established: latestRecord.baseline_established
      };
    }

    res.json({
      success: true,
      data: deviceInfo,
      deformation_data: deformationData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('获取设备管理信息失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备管理信息失败',
      message: error.message
    });
  }
});

// 获取设备完整状态信息（包含健康度、电池电量、今日数据统计）
app.get('/devices/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;
    console.log(`获取设备完整状态: ${deviceId}`);

    // 1. 获取设备影子数据
    const shadowData = await huaweiIoTService.getDeviceShadow(deviceId);
    const properties = shadowData.shadow?.[0]?.reported?.properties;

    if (!properties) {
      throw new Error('无法获取设备数据');
    }

    // 2. 计算健康度
    const healthScore = calculateDeviceHealth(properties);

    // 3. 计算电池电量
    const batteryLevel = calculateBatteryLevel(properties);

    // 4. 获取今日数据统计
    const todayStats = await getTodayDataStats(deviceId);

    // 5. 获取最近7天的数据趋势
    const weeklyTrend = await getWeeklyTrend(deviceId);

    res.json({
      success: true,
      data: {
        device_id: deviceId,
        status: properties.uptime > 0 ? 'online' : 'offline',
        health_score: healthScore,
        battery_level: batteryLevel,
        last_update: shadowData.shadow[0].reported.event_time,
        current_data: {
          temperature: properties.temperature,
          humidity: properties.humidity,
          vibration: properties.vibration,
          risk_level: properties.risk_level,
          alarm_active: properties.alarm_active,
          uptime: properties.uptime
        },
        today_stats: todayStats,
        weekly_trend: weeklyTrend
      }
    });
  } catch (error) {
    console.error('获取设备状态失败:', error);
    res.status(500).json({
      success: false,
      error: '获取设备状态失败',
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
    console.error('命令下发失败:', error);
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
    console.error('获取命令模板失败:', error);
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
    console.error('LED控制失败:', error);
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
    const { enable, speed = 100, direction = 1, duration = 5 } = req.body;

    let commandData;

    if (enable) {
      // 启动命令 - 包含所有参数
      commandData = {
        service_id: 'smartHome',
        command_name: 'control_motor',
        paras: {
          enable: true,
          speed: speed,
          direction: direction,
          duration: duration
        }
      };
    } else {
      // 停止命令 - 使用相同的参数结构，但设置为停止状态
      commandData = {
        service_id: 'smartHome',
        command_name: 'control_motor',
        paras: {
          enable: false,
          speed: 0,
          direction: 1,
          duration: 0
        }
      };
    }

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: `电机 ${enable ? '启动' : '停止'}命令下发成功`
    });
  } catch (error) {
    console.error('电机控制失败:', error);
    res.status(500).json({
      success: false,
      error: '电机控制失败',
      message: error.message
    });
  }
});

// 快捷命令接口 - 蜂鸣器控制
app.post('/huawei/devices/:deviceId/buzzer', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { enable, frequency = 2000, duration = 3, pattern = 2 } = req.body;

    let commandData;

    if (enable) {
      // 开启蜂鸣器
      commandData = {
        service_id: 'smartHome',
        command_name: 'control_buzzer',
        paras: {
          enable: true,
          frequency: frequency,
          duration: duration,
          pattern: pattern
        }
      };
    } else {
      // 关闭蜂鸣器
      commandData = {
        service_id: 'smartHome',
        command_name: 'control_buzzer',
        paras: {
          enable: false,
          frequency: 0,
          duration: 0,
          pattern: 1
        }
      };
    }

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: `蜂鸣器 ${enable ? '开启' : '关闭'}命令下发成功`
    });
  } catch (error) {
    console.error('蜂鸣器控制失败:', error);
    res.status(500).json({
      success: false,
      error: '蜂鸣器控制失败',
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
    console.error('系统重启失败:', error);
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

// 调试接口：检查数据库中的最新数据
app.get('/debug/latest-data/:deviceId?', async (req, res) => {
  try {
    const { deviceId } = req.params;

    let query = supabase
      .from('iot_data')
      .select('*')
      .order('event_time', { ascending: false })
      .limit(10);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const now = new Date();
    const dataWithAge = data.map(record => ({
      ...record,
      data_age_seconds: Math.round((now.getTime() - new Date(record.event_time).getTime()) / 1000)
    }));

    res.json({
      success: true,
      data: dataWithAge,
      total_records: data.length,
      query_time: now.toISOString(),
      device_filter: deviceId || 'all'
    });

  } catch (error) {
    console.error('获取最新数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取最新数据失败',
      message: error.message
    });
  }
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

// WebSocket连接处理（仅在Socket.IO可用时）
if (io) {
  io.on('connection', (socket) => {
  console.log('客户端连接:', socket.id);

  // 客户端请求订阅设备实时数据
  socket.on('subscribe_device', (deviceId) => {
    console.log(`客户端 ${socket.id} 订阅设备 ${deviceId} 的实时数据`);
    socket.join(`device_${deviceId}`);

    // 立即发送一次当前数据
    sendDeviceData(deviceId);
  });

  // 客户端取消订阅
  socket.on('unsubscribe_device', (deviceId) => {
    console.log(`客户端 ${socket.id} 取消订阅设备 ${deviceId}`);
    socket.leave(`device_${deviceId}`);
  });

  socket.on('disconnect', () => {
    console.log('客户端断开连接:', socket.id);
  });
});

} // 结束WebSocket连接处理的if语句

// 发送设备数据到订阅的客户端（移到全局作用域）
async function sendDeviceData(deviceId) {
  try {
    // 获取设备管理信息
    const deviceConfig = {
      device_1: {
        device_id: 'device_1',
        real_name: '6815a14f9314d118511807c6_rk2206',
        display_name: '龙门滑坡监测站',
        location: '防城港华石镇龙门村',
        coordinates: { lat: 21.6847, lng: 108.3516 },
        device_type: '软通套件',
        firmware_version: 'v2.1.3',
        install_date: '2025-06-01'
      }
    };

    const baseInfo = deviceConfig[deviceId];
    if (!baseInfo) return;

    // 方案1：检查数据库中的最新数据（主要判断方式）
    const dbCheck = await checkDatabaseForRecentData(deviceId);

    // 方案2：获取华为云IoT实时状态（备用判断方式）
    let iotStatus = { status: 'offline', real_time_data: null, last_update: null };
    try {
      const shadowData = await huaweiIoTService.getDeviceShadow(baseInfo.real_name);
      if (shadowData.shadow && shadowData.shadow.length > 0) {
        const shadowInfo = shadowData.shadow[0];
        const properties = shadowInfo.reported?.properties;
        const lastUpdateTime = shadowInfo.reported?.event_time;

        if (properties && lastUpdateTime) {
          const lastUpdate = parseHuaweiIoTTime(lastUpdateTime);

          if (lastUpdate) {
            const now = new Date();
            const timeDiff = now.getTime() - lastUpdate.getTime();
            const maxOfflineTime = 60 * 1000; // 1分钟
            const isDataFresh = timeDiff < maxOfflineTime;

            console.log(`设备 ${deviceId} 华为云IoT数据检查:`, {
              originalTime: lastUpdateTime,
              parsedTime: lastUpdate.toISOString(),
              timeDiff: Math.round(timeDiff / 1000) + '秒前',
              isDataFresh,
              uptime: properties.uptime
            });

            iotStatus = {
              status: isDataFresh ? 'online' : 'offline',
              real_time_data: properties,
              last_update: lastUpdateTime,
              data_age_seconds: Math.round(timeDiff / 1000)
            };
          }
        }
      }
    } catch (iotError) {
      console.error(`获取设备 ${deviceId} 华为云IoT状态失败:`, iotError.message);
    }

    // 综合判断：优先使用数据库判断，华为云IoT作为备用
    const finalStatus = dbCheck.hasRecentData ? 'online' :
                       (iotStatus.status === 'online' ? 'online' : 'offline');

    console.log(`设备 ${deviceId} 最终状态判断:`, {
      databaseStatus: dbCheck.hasRecentData ? 'online' : 'offline',
      iotStatus: iotStatus.status,
      finalStatus,
      primarySource: dbCheck.hasRecentData ? 'database' : 'huawei_iot'
    });

    // 计算健康度和电池电量
    let healthScore = 0;
    let batteryLevel = 0;

    // 优先使用华为云IoT数据计算，如果没有则使用数据库数据
    const dataForCalculation = iotStatus.real_time_data || dbCheck.latestData;
    if (dataForCalculation) {
      if (iotStatus.real_time_data) {
        healthScore = calculateHealthFromIoTData(iotStatus.real_time_data);
        batteryLevel = calculateBatteryFromUptime(
          iotStatus.real_time_data.uptime || 0,
          iotStatus.real_time_data.temperature || 25
        );
      } else {
        // 基于数据库数据的简单健康度计算
        healthScore = finalStatus === 'online' ? 80 : 0;
        batteryLevel = finalStatus === 'online' ? 75 : 0;
      }
    }

    // 构建实时数据
    const realtimeData = {
      ...baseInfo,
      status: finalStatus,
      temperature: iotStatus.real_time_data?.temperature || dbCheck.latestData?.temperature || 0,
      humidity: iotStatus.real_time_data?.humidity || dbCheck.latestData?.humidity || 0,
      health_score: Math.round(healthScore),
      battery_level: Math.round(batteryLevel),
      signal_strength: finalStatus === 'online' ? 85 : 0,
      last_data_time: dbCheck.lastDataTime || iotStatus.last_update || new Date().toISOString(),
      real_time_data: iotStatus.real_time_data,
      database_data: dbCheck.latestData,
      data_source: dbCheck.hasRecentData ? 'database' : 'huawei_iot',
      timestamp: new Date().toISOString()
    };

    // 发送到订阅的客户端（仅在WebSocket可用时）
    if (io) {
      io.to(`device_${deviceId}`).emit('device_data', realtimeData);
    }

  } catch (error) {
    console.error('发送设备数据失败:', error);
  }
}

// 定时获取并推送实时数据（每500毫秒一次，真正实时）
if (io) {
  setInterval(() => {
    sendDeviceData('device_1');
  }, 500);
  console.log('WebSocket实时数据推送已启动（每500毫秒）');
} else {
  console.log('WebSocket实时数据推送未启动（Socket.IO不可用）');
}

// 启动服务器
server.listen(PORT, '0.0.0.0', async () => {
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
    console.error('设备映射器初始化失败:', error);
  }

  try {
    await dataProcessor.start();
    console.log('数据处理器启动成功');
  } catch (error) {
    console.error('数据处理器启动失败:', error);
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
