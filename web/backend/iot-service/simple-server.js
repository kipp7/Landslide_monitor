const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 5100;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Supabase 配置
const SUPABASE_URL = 'https://sdssoyyjhunltmcjoxtg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkc3NveXlqaHVubHRtY2pveHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0MzY3NTIsImV4cCI6MjA1NzAxMjc1Mn0.FisL8HivC_g-cnq4o7BNqHQ8vKDUpgfW3lUINfDXMSA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
      device_list: 'GET /devices/list',
      device_mappings: 'GET /devices/mappings',
      device_info: 'GET /devices/info/:simpleId'
    }
  });
});

// 设备列表接口
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

// 设备映射接口
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

// 获取特定设备信息
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

// 启动服务器
app.listen(PORT, () => {
  console.log('=====================================');
  console.log('🚀 滑坡监测IoT服务启动成功!');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`📊 服务信息: http://localhost:${PORT}/info`);
  console.log(`📋 设备列表: http://localhost:${PORT}/devices/list`);
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
