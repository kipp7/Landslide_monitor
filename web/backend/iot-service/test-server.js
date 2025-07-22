const express = require('express');
const cors = require('cors');
const HuaweiIoTService = require('./huawei-iot-service');

const app = express();
const PORT = 5100;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 初始化华为云IoT服务
const huaweiIoTService = new HuaweiIoTService();

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'landslide-iot-test-service',
    port: PORT
  });
});

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
    console.log(`🔍 获取设备影子: ${deviceId}`);
    
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
    
    console.log(`📤 向设备下发命令: ${deviceId}`);
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
  console.log('🧪 华为云IoT测试服务已启动');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`⚙️  配置检查: http://localhost:${PORT}/huawei/config`);
  console.log(`📋 命令模板: http://localhost:${PORT}/huawei/command-templates`);
  console.log('⏰ 启动时间:', new Date().toISOString());
  console.log('=====================================');

  // 启动时测试配置
  setTimeout(async () => {
    try {
      console.log('\n🔍 启动时配置检查...');
      const configCheck = huaweiIoTService.checkConfig();
      if (configCheck.isValid) {
        console.log('✅ 配置检查通过');
        // 测试获取token
        try {
          await huaweiIoTService.getToken();
          console.log('✅ Token获取成功，服务就绪');
        } catch (tokenError) {
          console.log('❌ Token获取失败:', tokenError.message);
        }
      } else {
        console.log('❌ 配置不完整:', configCheck.missing);
      }
    } catch (error) {
      console.log('❌ 启动检查失败:', error.message);
    }
  }, 1000);
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
