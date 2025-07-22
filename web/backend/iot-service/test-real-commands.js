const axios = require('axios');

async function testRealCommands() {
  console.log('🧪 测试实际设备命令（control_motor 和 control_buzzer）...\n');

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

    // 2. 测试电机控制命令
    console.log('\n2️⃣ 测试电机控制命令...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    
    const motorCommands = [
      {
        name: '电机启动测试',
        command: {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: true,
            speed: 100,
            direction: 1,
            duration: 3000
          }
        }
      },
      {
        name: '电机停止测试',
        command: {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: false,
            speed: 0,
            direction: 1,
            duration: 0
          }
        }
      }
    ];

    for (const motorCmd of motorCommands) {
      console.log(`\n   测试${motorCmd.name}...`);
      console.log('   命令数据:', JSON.stringify(motorCmd.command, null, 2));
      
      try {
        const commandResponse = await axios.post(commandUrl, motorCmd.command, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (commandResponse.status === 200 || commandResponse.status === 201) {
          console.log(`   ✅ ${motorCmd.name} 成功！`);
          console.log(`   📤 命令ID: ${commandResponse.data.command_id}`);
          
          if (commandResponse.data.response) {
            console.log('   📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
          } else {
            console.log('   ⏳ 等待设备响应...');
          }
        }
      } catch (commandError) {
        console.log(`   ❌ ${motorCmd.name} 失败:`, commandError.message);
        if (commandError.response) {
          console.log(`      状态码: ${commandError.response.status}`);
          if (commandError.response.data) {
            console.log('      错误:', commandError.response.data.error_msg);
            console.log('      错误码:', commandError.response.data.error_code);
          }
        }
      }
      
      // 命令之间等待2秒
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 3. 测试蜂鸣器控制命令
    console.log('\n3️⃣ 测试蜂鸣器控制命令...');
    
    const buzzerCommands = [
      {
        name: '蜂鸣器报警测试',
        command: {
          service_id: 'smartHome',
          command_name: 'control_buzzer',
          paras: {
            enable: true,
            frequency: 2000,
            duration: 2000,
            pattern: 2
          }
        }
      },
      {
        name: '蜂鸣器停止测试',
        command: {
          service_id: 'smartHome',
          command_name: 'control_buzzer',
          paras: {
            enable: false,
            frequency: 0,
            duration: 0,
            pattern: 1
          }
        }
      }
    ];

    for (const buzzerCmd of buzzerCommands) {
      console.log(`\n   测试${buzzerCmd.name}...`);
      console.log('   命令数据:', JSON.stringify(buzzerCmd.command, null, 2));
      
      try {
        const commandResponse = await axios.post(commandUrl, buzzerCmd.command, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (commandResponse.status === 200 || commandResponse.status === 201) {
          console.log(`   ✅ ${buzzerCmd.name} 成功！`);
          console.log(`   📤 命令ID: ${commandResponse.data.command_id}`);
          
          if (commandResponse.data.response) {
            console.log('   📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
          } else {
            console.log('   ⏳ 等待设备响应...');
          }
        }
      } catch (commandError) {
        console.log(`   ❌ ${buzzerCmd.name} 失败:`, commandError.message);
        if (commandError.response) {
          console.log(`      状态码: ${commandError.response.status}`);
          if (commandError.response.data) {
            console.log('      错误:', commandError.response.data.error_msg);
            console.log('      错误码:', commandError.response.data.error_code);
          }
        }
      }
      
      // 命令之间等待2秒
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n🎯 测试完成！');
    console.log('\n📋 命令参数说明:');
    console.log('电机控制 (control_motor):');
    console.log('  - enable: true/false (启用/禁用)');
    console.log('  - speed: 0-255 (速度)');
    console.log('  - direction: 1/-1 (正转/反转)');
    console.log('  - duration: 毫秒 (持续时间)');
    console.log('');
    console.log('蜂鸣器控制 (control_buzzer):');
    console.log('  - enable: true/false (启用/禁用)');
    console.log('  - frequency: Hz (频率)');
    console.log('  - duration: 毫秒 (持续时间)');
    console.log('  - pattern: 1/2/3 (连续/间断/快速)');

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
  testRealCommands().catch(console.error);
}

module.exports = testRealCommands;
