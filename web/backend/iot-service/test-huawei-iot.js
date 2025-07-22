const HuaweiIoTService = require('./huawei-iot-service');

async function testHuaweiIoTService() {
  console.log('🧪 开始测试华为云IoT服务...\n');

  // 创建服务实例
  const huaweiIoTService = new HuaweiIoTService({
    // 测试配置 - 请根据实际情况修改
    // projectId: 'your-project-id',
    // domainName: 'your-domain-name',
    // iamUsername: 'your-iam-username',
    // iamPassword: 'your-iam-password',
    // deviceId: '6815a14f9314d118511807c6_rk2206'
  });

  // 1. 检查配置
  console.log('1️⃣ 检查配置状态:');
  const configCheck = huaweiIoTService.checkConfig();
  console.log('配置检查结果:', JSON.stringify(configCheck, null, 2));
  
  if (!configCheck.isValid) {
    console.log('❌ 配置不完整，缺少以下配置项:', configCheck.missing);
    console.log('\n📝 请按照以下步骤配置:');
    console.log('1. 复制 .env.example 为 .env');
    console.log('2. 在 .env 文件中填入您的华为云配置信息');
    console.log('3. 重新运行测试');
    return;
  }

  try {
    // 2. 测试IAM认证
    console.log('\n2️⃣ 测试IAM认证:');
    const token = await huaweiIoTService.getToken();
    console.log('✅ IAM认证成功，token长度:', token.length);

    // 3. 测试获取设备影子
    console.log('\n3️⃣ 测试获取设备影子:');
    const shadowData = await huaweiIoTService.getDeviceShadow();
    console.log('✅ 设备影子获取成功');
    console.log('设备ID:', shadowData.device_id);
    if (shadowData.shadow && shadowData.shadow.length > 0) {
      console.log('服务数量:', shadowData.shadow.length);
      shadowData.shadow.forEach((service, index) => {
        console.log(`服务 ${index + 1}:`, service.service_id);
        if (service.reported && service.reported.properties) {
          console.log('  最新属性:', Object.keys(service.reported.properties).slice(0, 5).join(', '));
        }
      });
    }

    // 4. 测试命令模板
    console.log('\n4️⃣ 测试命令模板:');
    const templates = huaweiIoTService.getCommandTemplates();
    console.log('✅ 可用命令模板:', Object.keys(templates).join(', '));

    // 5. 测试命令下发（LED控制示例）
    console.log('\n5️⃣ 测试命令下发 (LED控制):');
    const ledCommand = templates.ledControl('ON');
    console.log('命令数据:', JSON.stringify(ledCommand, null, 2));
    
    // 注意：这里实际会向设备发送命令，请确保设备能够处理
    const commandResult = await huaweiIoTService.sendCommand(ledCommand);
    console.log('✅ 命令下发成功');
    console.log('命令ID:', commandResult.command_id);
    if (commandResult.response) {
      console.log('设备响应:', commandResult.response);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('详细错误:', error);
  }

  console.log('\n🏁 测试完成');
}

// 运行测试
if (require.main === module) {
  testHuaweiIoTService().catch(console.error);
}

module.exports = testHuaweiIoTService;
