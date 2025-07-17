const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

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
      iot_data: 'POST /iot/huawei'
    }
  });
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
      console.log('❌ 数据格式错误: 缺少notify_data');
      return res.status(400).json({
        "Status Code": 400,
        "message": "数据格式错误",
        "error": "缺少notify_data字段"
      });
    }

    const { notify_data, event_time, resource, event } = req.body;
    
    if (!notify_data.body || !notify_data.body.services) {
      console.log('❌ 数据格式错误: 缺少services');
      return res.status(400).json({
        "Status Code": 400,
        "message": "数据格式错误",
        "error": "缺少services字段"
      });
    }

    const { header, body } = notify_data;
    const { device_id, product_id } = header;
    const { services } = body;

    console.log(`📱 设备ID: ${device_id}`);
    console.log(`📦 产品ID: ${product_id}`);
    console.log(`🔧 服务数量: ${services.length}`);

    let processedCount = 0;

    // 处理每个服务的数据
    for (const service of services) {
      const { service_id, properties, event_time: serviceEventTime } = service;
      
      console.log(`\n🔄 处理服务: ${service_id}`);
      console.log('属性数据:', properties);
      
      try {
        // 构造要插入的数据
        const sensorData = {
          device_id: device_id,
          product_id: product_id,
          service_id: service_id,
          event_time: formatEventTime(serviceEventTime || event_time),
          resource: resource,
          event_type: event,
          // 展开所有属性
          ...properties,
          // 保存原始数据
          raw_data: req.body,
          // 添加创建时间
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // 移除undefined值
        Object.keys(sensorData).forEach(key => {
          if (sensorData[key] === undefined) {
            delete sensorData[key];
          }
        });

        console.log('📝 准备插入数据:', sensorData);

        // 插入到Supabase数据库
        const { data, error } = await supabase
          .from('huawei_iot_data')
          .insert([sensorData])
          .select();

        if (error) {
          console.error('❌ 数据库插入失败:', error);
          console.error('错误详情:', error.message);
        } else {
          console.log('✅ 数据插入成功');
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
    console.log(`\n⏱️  处理完成，耗时: ${processingTime}ms`);
    console.log(`✅ 成功处理: ${processedCount}/${services.length} 个服务`);
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
app.listen(PORT, '0.0.0.0', () => {
  console.log('🏔️  滑坡监测IoT服务已启动');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`📊 服务信息: http://localhost:${PORT}/info`);
  console.log(`📨 IoT数据接收: http://localhost:${PORT}/iot/huawei`);
  console.log('⏰ 启动时间:', new Date().toISOString());
  console.log('=====================================');
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
