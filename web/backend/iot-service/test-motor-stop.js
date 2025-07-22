const axios = require('axios');

async function testMotorStop() {
  console.log('🧪 测试不同的电机停止命令格式...\n');

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

    // 2. 先启动电机
    console.log('\n2️⃣ 先启动电机...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    
    const startCommand = {
      service_id: 'smartHome',
      command_name: 'control_motor',
      paras: {
        enable: true,
        speed: 50,  // 较低速度
        direction: 1,
        duration: 10000  // 10秒
      }
    };

    console.log('启动命令:', JSON.stringify(startCommand, null, 2));

    try {
      const startResponse = await axios.post(commandUrl, startCommand, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (startResponse.status === 200 || startResponse.status === 201) {
        console.log('✅ 电机启动成功');
        console.log('启动响应:', JSON.stringify(startResponse.data, null, 2));
      }
    } catch (startError) {
      console.log('❌ 电机启动失败:', startError.message);
      return;
    }

    // 等待2秒
    console.log('\n⏳ 等待2秒后测试停止命令...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. 测试不同的停止命令格式
    console.log('\n3️⃣ 测试不同的停止命令格式...');
    
    const stopCommands = [
      {
        name: '停止方式1 - 仅设置enable为false',
        command: {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: false
          }
        }
      },
      {
        name: '停止方式2 - enable为false，其他参数为0',
        command: {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: false,
            speed: 0,
            direction: 0,
            duration: 0
          }
        }
      },
      {
        name: '停止方式3 - enable为false，保持direction为1',
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
      },
      {
        name: '停止方式4 - 速度为0但enable为true',
        command: {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: true,
            speed: 0,
            direction: 1,
            duration: 1000
          }
        }
      },
      {
        name: '停止方式5 - 持续时间为0',
        command: {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: true,
            speed: 0,
            direction: 1,
            duration: 0
          }
        }
      }
    ];

    for (const stopCmd of stopCommands) {
      console.log(`\n   测试${stopCmd.name}...`);
      console.log('   命令数据:', JSON.stringify(stopCmd.command, null, 2));
      
      try {
        const stopResponse = await axios.post(commandUrl, stopCmd.command, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (stopResponse.status === 200 || stopResponse.status === 201) {
          console.log(`   ✅ ${stopCmd.name} 成功！`);
          console.log(`   📤 命令ID: ${stopResponse.data.command_id}`);
          
          if (stopResponse.data.response) {
            console.log('   📥 设备响应:', JSON.stringify(stopResponse.data.response, null, 2));
            
            // 如果这个方式成功，记录下来
            if (stopResponse.data.response.result_code === 0) {
              console.log(`\n🎯 找到有效的停止命令格式: ${stopCmd.name}`);
              console.log('推荐使用的停止参数:', JSON.stringify(stopCmd.command.paras, null, 2));
              break;
            }
          } else {
            console.log('   ⏳ 等待设备响应...');
          }
        }
      } catch (stopError) {
        console.log(`   ❌ ${stopCmd.name} 失败:`, stopError.message);
        if (stopError.response && stopError.response.data) {
          console.log('      错误:', stopError.response.data.error_msg);
          console.log('      错误码:', stopError.response.data.error_code);
        }
      }
      
      // 每个命令之间等待3秒
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n📋 测试总结:');
    console.log('1. 如果某个停止方式成功，请更新代码使用该格式');
    console.log('2. 如果所有方式都超时，可能是设备端处理停止命令的逻辑问题');
    console.log('3. 建议检查设备端代码中对control_motor命令的处理');

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
  testMotorStop().catch(console.error);
}

module.exports = testMotorStop;
