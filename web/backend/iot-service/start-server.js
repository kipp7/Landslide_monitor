const express = require('express');
const cors = require('cors');
const HuaweiIoTService = require('./huawei-iot-service');

const app = express();
const PORT = 5100;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 初始化华为云IoT服务（使用成功的配置）
const huaweiIoTService = new HuaweiIoTService({
  iamEndpoint: 'https://iam.myhuaweicloud.com',
  iotEndpoint: 'https://361017cfc6.st1.iotda-app.cn-north-4.myhuaweicloud.com:443',
  domainName: 'hid_d-zeks2kzzvtkdc',
  iamUsername: 'k',
  iamPassword: '12345678k',
  projectId: '41a2637bc1ba4889bc3b49c4e2ab9e77',
  projectName: 'cn-north-4',
  deviceId: '6815a14f9314d118511807c6_rk2206'
});

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'landslide-iot-service',
    port: PORT,
    endpoints: {
      health: 'GET /health',
      info: 'GET /info',
      huawei_config: 'GET /huawei/config',
      device_shadow: 'GET /huawei/devices/:deviceId/shadow',
      send_command: 'POST /huawei/devices/:deviceId/commands',
      command_templates: 'GET /huawei/command-templates',
      motor_control: 'POST /huawei/devices/:deviceId/motor',
      buzzer_control: 'POST /huawei/devices/:deviceId/buzzer',
      system_reboot: 'POST /huawei/devices/:deviceId/reboot'
    }
  });
});

// 服务信息接口
app.get('/info', (req, res) => {
  res.json({
    service: 'landslide-iot-service',
    version: '1.0.0',
    description: '滑坡监测IoT服务 - 华为云IoT设备控制',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    endpoints: {
      health: 'GET /health',
      info: 'GET /info',
      huawei_config: 'GET /huawei/config',
      device_shadow: 'GET /huawei/devices/:deviceId/shadow',
      send_command: 'POST /huawei/devices/:deviceId/commands',
      command_templates: 'GET /huawei/command-templates',
      led_control: 'POST /huawei/devices/:deviceId/led',
      alarm_control: 'POST /huawei/devices/:deviceId/alarm',
      system_reboot: 'POST /huawei/devices/:deviceId/reboot'
    }
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

// 快捷命令接口 - 电机控制
app.post('/huawei/devices/:deviceId/motor', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { enable, speed = 100, direction = 1, duration = 5 } = req.body;

    let commandData;

    if (enable) {
      // 启动命令 - 使用基础参数集
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
    console.error('❌ 电机控制失败:', error);
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
    const { enable, frequency = 1000, duration = 2000, pattern = 1 } = req.body;

    const commandData = {
      service_id: 'smartHome',
      command_name: 'control_buzzer',
      paras: {
        enable: enable || false,
        frequency: frequency,
        duration: duration,
        pattern: pattern
      }
    };

    const result = await huaweiIoTService.sendCommand(commandData, deviceId);

    res.json({
      success: true,
      data: result,
      message: `蜂鸣器 ${enable ? '开启' : '关闭'}命令下发成功`
    });
  } catch (error) {
    console.error('❌ 蜂鸣器控制失败:', error);
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
    motorControl: '电机控制 - 控制电机启停、速度、方向和持续时间',
    buzzerControl: '蜂鸣器控制 - 控制蜂鸣器开关、频率、持续时间和模式',
    motorStart: '电机启动 - 快捷启动电机',
    motorStop: '电机停止 - 快捷停止电机',
    buzzerAlarm: '蜂鸣器报警 - 发出报警声音',
    buzzerStop: '蜂鸣器停止 - 停止蜂鸣器',
    systemTest: '系统测试 - 测试设备响应'
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
  console.log('🎉 滑坡监测IoT服务已启动');
  console.log(`📡 端口: ${PORT}`);
  console.log(`🌐 健康检查: http://localhost:${PORT}/health`);
  console.log(`⚙️  配置检查: http://localhost:${PORT}/huawei/config`);
  console.log(`📋 命令模板: http://localhost:${PORT}/huawei/command-templates`);
  console.log(`📱 设备影子: http://localhost:${PORT}/huawei/devices/6815a14f9314d118511807c6_rk2206/shadow`);
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
