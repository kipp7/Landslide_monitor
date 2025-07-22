const axios = require('axios');

async function testWithProjectScope() {
  console.log('🧪 使用项目范围测试华为云IoT...\n');

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
    // 1. 使用项目ID获取project-scoped token
    console.log('1️⃣ 获取project-scoped token...');
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
            id: config.projectId  // 使用项目ID而不是名称
          }
        }
      }
    };

    console.log('认证请求数据:', JSON.stringify(authData, null, 2));

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
    console.log('✅ Project-scoped token获取成功');
    console.log('Token长度:', token.length);

    // 2. 测试获取设备影子
    console.log('\n2️⃣ 测试获取设备影子...');
    const shadowUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/shadow`;
    console.log('请求URL:', shadowUrl);
    
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
            if (service.reported && service.reported.properties) {
              const props = Object.keys(service.reported.properties);
              console.log(`    属性: ${props.slice(0, 3).join(', ')}${props.length > 3 ? '...' : ''}`);
            }
          });
        }
      }
    } catch (shadowError) {
      console.log('❌ 设备影子获取失败:', shadowError.message);
      if (shadowError.response) {
        console.log('   状态码:', shadowError.response.status);
        console.log('   错误详情:', JSON.stringify(shadowError.response.data, null, 2));
      }
    }

    // 3. 测试命令下发
    console.log('\n3️⃣ 测试LED命令下发...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    console.log('命令URL:', commandUrl);
    
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
        console.log('响应数据:', JSON.stringify(commandResponse.data, null, 2));
      }
    } catch (commandError) {
      console.log('❌ 命令下发失败:', commandError.message);
      if (commandError.response) {
        console.log('   状态码:', commandError.response.status);
        console.log('   错误详情:', JSON.stringify(commandError.response.data, null, 2));
      }
    }

    // 4. 测试获取设备列表（验证权限）
    console.log('\n4️⃣ 测试获取设备列表...');
    const devicesUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices`;
    
    try {
      const devicesResponse = await axios.get(devicesUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        params: {
          limit: 5  // 限制返回数量
        },
        timeout: 10000
      });

      if (devicesResponse.status === 200) {
        console.log('✅ 设备列表获取成功');
        const devices = devicesResponse.data.devices || [];
        console.log(`找到 ${devices.length} 个设备`);
        devices.forEach((device, index) => {
          console.log(`  设备 ${index + 1}: ${device.device_id} (${device.device_name || '无名称'})`);
        });
      }
    } catch (devicesError) {
      console.log('❌ 设备列表获取失败:', devicesError.message);
      if (devicesError.response) {
        console.log('   状态码:', devicesError.response.status);
        console.log('   错误详情:', JSON.stringify(devicesError.response.data, null, 2));
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n💡 如果仍然遇到403错误，请检查:');
  console.log('1. IAM用户是否有IoTDA服务的权限');
  console.log('2. 是否已经开通IoTDA服务');
  console.log('3. 项目ID是否正确');
  console.log('4. 设备是否存在于该项目中');
}

// 运行测试
if (require.main === module) {
  testWithProjectScope().catch(console.error);
}

module.exports = testWithProjectScope;
