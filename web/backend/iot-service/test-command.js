const axios = require('axios');

async function testCommand() {
  console.log('🧪 测试设备命令下发...\n');

  const config = {
    iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
    iotEndpoint: 'https://iotda.cn-north-4.myhuaweicloud.com',
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
          methods: ['password'],
          password: {
            user: {
              name: config.iamUsername,
              password: config.iamPassword,
              domain: {
                name: config.domainName
              }
            }
          }
        },
        scope: {
          project: {
            name: 'cn-north-4'
          }
        }
      }
    };

    const authResponse = await axios.post(authUrl, authData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (authResponse.status !== 201) {
      throw new Error(`认证失败，状态码: ${authResponse.status}`);
    }

    const token = authResponse.headers['x-subject-token'];
    console.log('✅ IAM token获取成功');

    // 2. 测试获取设备影子
    console.log('\n2️⃣ 测试获取设备影子...');
    const shadowUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/shadow`;
    
    try {
      const shadowResponse = await axios.get(shadowUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 10000
      });

      if (shadowResponse.status === 200) {
        console.log('✅ 设备影子获取成功');
        console.log('设备ID:', shadowResponse.data.device_id);
        if (shadowResponse.data.shadow && shadowResponse.data.shadow.length > 0) {
          console.log('服务数量:', shadowResponse.data.shadow.length);
          shadowResponse.data.shadow.forEach((service, index) => {
            console.log(`  服务 ${index + 1}: ${service.service_id}`);
          });
        }
      }
    } catch (shadowError) {
      console.log('⚠️  设备影子获取失败:', shadowError.message);
      if (shadowError.response) {
        console.log('   状态码:', shadowError.response.status);
      }
    }

    // 3. 测试LED命令下发
    console.log('\n3️⃣ 测试LED命令下发...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    const commandData = {
      service_id: 'IntelligentCockpit',
      command_name: 'light_control',
      paras: {
        onoff: 'ON'
      }
    };

    console.log('命令数据:', JSON.stringify(commandData, null, 2));

    try {
      const commandResponse = await axios.post(commandUrl, commandData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (commandResponse.status === 200 || commandResponse.status === 201) {
        console.log('✅ 命令下发成功');
        console.log('命令ID:', commandResponse.data.command_id);
        if (commandResponse.data.response) {
          console.log('设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
        } else {
          console.log('⏳ 等待设备响应...');
        }
      }
    } catch (commandError) {
      console.log('❌ 命令下发失败:', commandError.message);
      if (commandError.response) {
        console.log('   状态码:', commandError.response.status);
        console.log('   响应数据:', JSON.stringify(commandError.response.data, null, 2));
      }
    }

    // 4. 测试其他命令
    console.log('\n4️⃣ 测试电机控制命令...');
    const motorCommand = {
      service_id: 'IntelligentCockpit',
      command_name: 'motor_control',
      paras: {
        motorStatus: 'ON'
      }
    };

    try {
      const motorResponse = await axios.post(commandUrl, motorCommand, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (motorResponse.status === 200 || motorResponse.status === 201) {
        console.log('✅ 电机控制命令下发成功');
        console.log('命令ID:', motorResponse.data.command_id);
      }
    } catch (motorError) {
      console.log('⚠️  电机控制命令失败:', motorError.message);
    }

    console.log('\n🎯 测试总结:');
    console.log('- 认证: ✅ 成功');
    console.log('- 配置信息:');
    console.log(`  项目ID: ${config.projectId}`);
    console.log(`  设备ID: ${config.deviceId}`);
    console.log('- 建议: 如果命令下发失败，请检查设备是否在线并支持相应命令');

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
  testCommand().catch(console.error);
}

module.exports = testCommand;
