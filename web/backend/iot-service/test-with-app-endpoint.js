const axios = require('axios');

async function testWithAppEndpoint() {
  console.log('🧪 使用应用侧端点测试华为云IoT...\n');

  const config = {
    // 使用您成功调试的端点
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

    // 2. 测试您成功的设备影子API
    console.log('\n2️⃣ 测试设备影子API（使用您成功的端点）...');
    const shadowUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/shadow`;
    console.log('请求URL:', shadowUrl);
    
    try {
      const shadowResponse = await axios.get(shadowUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 15000
      });

      if (shadowResponse.status === 200) {
        console.log('🎉 设备影子获取成功！');
        console.log(`📱 设备ID: ${shadowResponse.data.device_id}`);
        
        if (shadowResponse.data.shadow && shadowResponse.data.shadow.length > 0) {
          console.log(`🔧 服务数量: ${shadowResponse.data.shadow.length}`);
          shadowResponse.data.shadow.forEach((service, index) => {
            console.log(`   服务${index + 1}: ${service.service_id}`);
            if (service.reported && service.reported.properties) {
              console.log('   最新属性:');
              Object.entries(service.reported.properties).forEach(([key, value]) => {
                console.log(`      ${key}: ${value}`);
              });
              console.log(`   更新时间: ${service.reported.event_time}`);
            }
          });
        }
      }
    } catch (shadowError) {
      console.log('❌ 设备影子获取失败:', shadowError.message);
      if (shadowError.response) {
        console.log('状态码:', shadowError.response.status);
        console.log('错误详情:', JSON.stringify(shadowError.response.data, null, 2));
      }
      return; // 如果影子都获取不到，就不测试命令了
    }

    // 3. 测试命令下发
    console.log('\n3️⃣ 测试命令下发API...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    console.log('命令URL:', commandUrl);
    
    const testCommand = {
      service_id: 'IntelligentCockpit',
      command_name: 'light_control',
      paras: {
        onoff: 'ON'
      }
    };

    console.log('命令数据:', JSON.stringify(testCommand, null, 2));

    try {
      const commandResponse = await axios.post(commandUrl, testCommand, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (commandResponse.status === 200 || commandResponse.status === 201) {
        console.log('🎉 命令下发成功！');
        console.log(`📤 命令ID: ${commandResponse.data.command_id}`);
        
        if (commandResponse.data.response) {
          console.log('📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
        } else {
          console.log('⏳ 等待设备响应...');
        }
      }
    } catch (commandError) {
      console.log('❌ 命令下发失败:', commandError.message);
      if (commandError.response) {
        console.log('状态码:', commandError.response.status);
        console.log('错误详情:', JSON.stringify(commandError.response.data, null, 2));
      }
    }

    // 4. 测试设备列表
    console.log('\n4️⃣ 测试设备列表API...');
    const devicesUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices`;
    
    try {
      const devicesResponse = await axios.get(devicesUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        params: { limit: 5 },
        timeout: 15000
      });

      if (devicesResponse.status === 200) {
        console.log('✅ 设备列表获取成功');
        const devices = devicesResponse.data.devices || [];
        console.log(`📱 设备数量: ${devices.length}`);
        
        if (devices.length > 0) {
          console.log('📋 设备列表:');
          devices.forEach((device, index) => {
            console.log(`   ${index + 1}. ${device.device_id}`);
            console.log(`      名称: ${device.device_name || '无名称'}`);
            console.log(`      状态: ${device.status}`);
            console.log(`      产品ID: ${device.product_id}`);
          });
        }
      }
    } catch (devicesError) {
      console.log('⚠️  设备列表获取失败:', devicesError.message);
      if (devicesError.response) {
        console.log('状态码:', devicesError.response.status);
      }
    }

    // 输出最终配置
    console.log('\n🎯 测试完成！推荐使用以下配置:');
    console.log('=====================================');
    console.log(`HUAWEI_IAM_ENDPOINT=${config.iamEndpoint}`);
    console.log(`HUAWEI_IOT_ENDPOINT=${config.iotEndpoint}`);
    console.log(`HUAWEI_DOMAIN_NAME=${config.domainName}`);
    console.log(`HUAWEI_IAM_USERNAME=${config.iamUsername}`);
    console.log(`HUAWEI_IAM_PASSWORD=${config.iamPassword}`);
    console.log(`HUAWEI_PROJECT_ID=${config.projectId}`);
    console.log(`HUAWEI_DEVICE_ID=${config.deviceId}`);
    console.log(`HUAWEI_PROJECT_NAME=cn-north-4`);
    console.log('=====================================');

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
  testWithAppEndpoint().catch(console.error);
}

module.exports = testWithAppEndpoint;
