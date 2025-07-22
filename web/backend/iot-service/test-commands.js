const axios = require('axios');

async function testCommands() {
  console.log('🧪 测试设备命令（基于smartHome服务）...\n');

  const config = {
    iamEndpoint: 'https://iam.myhuaweicloud.com',
    iotEndpoint: 'https://361017cfc6.st1.iotda-app.cn-north-4.myhuaweicloud.com:443',
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k',
    projectId: '41a2637bc1ba4889bc3b49c4e2ab9e77',
    deviceId: '6815a14f9314d118511807c6_rk2206'
  };

  try {
    // 1. 获取token
    console.log('1️⃣ 获取IAM token...');
    const authUrl = `${config.iamEndpoint}/v3/auth/tokens`;
    
    const authData = {
      auth: {
        identity: {
          methods: ["password"],
          password: {
            user: {
              domain: {
                name: config.domainName
              },
              name: config.iamUsername,
              password: config.iamPassword
            }
          }
        },
        scope: {
          project: {
            name: "cn-north-4"
          }
        }
      }
    };

    const authResponse = await axios.post(authUrl, authData, {
      headers: {
        'Content-Type': 'application/json;charset=utf8'
      },
      timeout: 15000
    });

    if (authResponse.status !== 201) {
      throw new Error(`认证失败，状态码: ${authResponse.status}`);
    }

    const token = authResponse.headers['x-subject-token'];
    console.log('✅ Token获取成功');

    // 2. 测试不同的命令格式
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    
    // 基于设备实际属性的可能命令
    const testCommands = [
      {
        name: 'LED控制',
        command: {
          service_id: 'smartHome',
          command_name: 'led_control',
          paras: {
            led_status: 'ON'
          }
        }
      },
      {
        name: '报警控制',
        command: {
          service_id: 'smartHome',
          command_name: 'alarm_control',
          paras: {
            alarm_active: true
          }
        }
      },
      {
        name: '设置风险等级',
        command: {
          service_id: 'smartHome',
          command_name: 'set_risk_level',
          paras: {
            risk_level: 1
          }
        }
      },
      {
        name: '建立基线',
        command: {
          service_id: 'smartHome',
          command_name: 'establish_baseline',
          paras: {}
        }
      },
      {
        name: '校准传感器',
        command: {
          service_id: 'smartHome',
          command_name: 'calibrate_sensors',
          paras: {}
        }
      },
      {
        name: '系统重启',
        command: {
          service_id: 'smartHome',
          command_name: 'system_reboot',
          paras: {}
        }
      }
    ];

    console.log('\n2️⃣ 测试各种命令格式...');
    
    for (const testCmd of testCommands) {
      console.log(`\n   测试${testCmd.name}...`);
      console.log('   命令数据:', JSON.stringify(testCmd.command, null, 2));
      
      try {
        const commandResponse = await axios.post(commandUrl, testCmd.command, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (commandResponse.status === 200 || commandResponse.status === 201) {
          console.log(`   ✅ ${testCmd.name} 命令下发成功！`);
          console.log(`   📤 命令ID: ${commandResponse.data.command_id}`);
          
          if (commandResponse.data.response) {
            console.log('   📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
          } else {
            console.log('   ⏳ 等待设备响应...');
          }
          
          // 如果找到一个成功的命令，就记录下来
          console.log(`   🎯 成功的命令格式:`);
          console.log(`      service_id: "${testCmd.command.service_id}"`);
          console.log(`      command_name: "${testCmd.command.command_name}"`);
          
          break; // 找到一个成功的就停止测试
        }
      } catch (commandError) {
        console.log(`   ❌ ${testCmd.name} 失败:`, commandError.message);
        if (commandError.response) {
          console.log(`      状态码: ${commandError.response.status}`);
          if (commandError.response.data) {
            console.log('      错误:', commandError.response.data.error_msg);
            console.log('      错误码:', commandError.response.data.error_code);
          }
        }
      }
      
      // 每个命令之间稍微等待一下
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 3. 如果所有预定义命令都失败，尝试获取设备支持的命令
    console.log('\n3️⃣ 如果需要，可以查看华为云控制台中设备的产品模型...');
    console.log('   产品ID:', '6815a14f9314d118511807c6');
    console.log('   设备ID:', config.deviceId);
    console.log('   服务ID:', 'smartHome');
    
    console.log('\n💡 建议:');
    console.log('1. 检查华为云IoT控制台中的产品模型定义');
    console.log('2. 查看设备支持的命令列表');
    console.log('3. 确认命令名称和参数格式');
    console.log('4. 确保设备在线并能接收命令');

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 运行测试
if (require.main === module) {
  testCommands().catch(console.error);
}

module.exports = testCommands;
