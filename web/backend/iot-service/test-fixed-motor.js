const axios = require('axios');

async function testFixedMotor() {
  console.log('🧪 测试修复后的电机控制命令...\n');

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

    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;

    // 2. 测试启动命令（使用相同的参数结构）
    console.log('\n2️⃣ 测试电机启动命令...');
    const startCommand = {
      service_id: 'smartHome',
      command_name: 'control_motor',
      paras: {
        enable: true,
        speed: 80,
        direction: 1,
        duration: 8000
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
        
        if (startResponse.data.response && startResponse.data.response.result_code === 0) {
          console.log('🎉 设备确认启动成功！');
        }
      }
    } catch (startError) {
      console.log('❌ 电机启动失败:', startError.message);
      return;
    }

    // 等待3秒
    console.log('\n⏳ 等待3秒后测试停止命令...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 3. 测试停止命令（使用相同的参数结构）
    console.log('\n3️⃣ 测试电机停止命令（使用相同参数结构）...');
    const stopCommand = {
      service_id: 'smartHome',
      command_name: 'control_motor',
      paras: {
        enable: false,
        speed: 0,
        direction: 1,
        duration: 0
      }
    };

    console.log('停止命令:', JSON.stringify(stopCommand, null, 2));

    try {
      const stopResponse = await axios.post(commandUrl, stopCommand, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (stopResponse.status === 200 || stopResponse.status === 201) {
        console.log('✅ 电机停止命令下发成功');
        console.log('停止响应:', JSON.stringify(stopResponse.data, null, 2));
        
        if (stopResponse.data.response && stopResponse.data.response.result_code === 0) {
          console.log('🎉 设备确认停止成功！');
        } else if (stopResponse.data.error_code) {
          console.log('⚠️  停止命令有错误:', stopResponse.data.error_msg);
        } else {
          console.log('⏳ 等待设备响应停止命令...');
        }
      }
    } catch (stopError) {
      console.log('❌ 电机停止失败:', stopError.message);
      if (stopError.response && stopError.response.data) {
        console.log('停止错误详情:', JSON.stringify(stopError.response.data, null, 2));
      }
    }

    // 4. 再次测试完整的启动-停止循环
    console.log('\n4️⃣ 测试完整的启动-停止循环...');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 再次启动
    console.log('   再次启动电机...');
    try {
      const startResponse2 = await axios.post(commandUrl, {
        service_id: 'smartHome',
        command_name: 'control_motor',
        paras: {
          enable: true,
          speed: 60,
          direction: 1,
          duration: 5000
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (startResponse2.data.response && startResponse2.data.response.result_code === 0) {
        console.log('   ✅ 第二次启动成功');
        
        // 等待2秒后停止
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('   停止电机...');
        const stopResponse2 = await axios.post(commandUrl, {
          service_id: 'smartHome',
          command_name: 'control_motor',
          paras: {
            enable: false,
            speed: 0,
            direction: 1,
            duration: 0
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (stopResponse2.data.response && stopResponse2.data.response.result_code === 0) {
          console.log('   ✅ 第二次停止成功');
          console.log('\n🎉 电机控制功能完全正常！');
        } else {
          console.log('   ⚠️  第二次停止可能有问题');
        }
      }
    } catch (cycleError) {
      console.log('   ❌ 启动-停止循环测试失败:', cycleError.message);
    }

    console.log('\n📋 测试总结:');
    console.log('✅ 解决方案: 启动和停止命令使用相同的参数结构');
    console.log('✅ 启动: {enable: true, speed: X, direction: 1, duration: X}');
    console.log('✅ 停止: {enable: false, speed: 0, direction: 1, duration: 0}');

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
  testFixedMotor().catch(console.error);
}

module.exports = testFixedMotor;
