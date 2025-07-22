const axios = require('axios');

async function testApiVersions() {
  console.log('🧪 测试不同的华为云IoT API版本...\n');

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
            id: config.projectId
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
    console.log('✅ Token获取成功');

    // 测试不同的API版本
    const versions = ['v3', 'v5'];
    
    for (const version of versions) {
      console.log(`\n🔍 测试API版本: ${version}`);
      console.log('='.repeat(50));

      // 测试设备影子
      console.log(`\n2️⃣ 测试${version}版本 - 获取设备影子...`);
      const shadowUrl = `${config.iotEndpoint}/${version}/iot/${config.projectId}/devices/${config.deviceId}/shadow`;
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
          console.log(`✅ ${version}版本 - 设备影子获取成功`);
          console.log('设备ID:', shadowResponse.data.device_id);
          if (shadowResponse.data.shadow && shadowResponse.data.shadow.length > 0) {
            console.log('服务数量:', shadowResponse.data.shadow.length);
          }
        }
      } catch (shadowError) {
        console.log(`❌ ${version}版本 - 设备影子获取失败:`, shadowError.message);
        if (shadowError.response) {
          console.log('   状态码:', shadowError.response.status);
          if (shadowError.response.status !== 403) {
            console.log('   错误详情:', JSON.stringify(shadowError.response.data, null, 2));
          }
        }
      }

      // 测试命令下发
      console.log(`\n3️⃣ 测试${version}版本 - LED命令下发...`);
      const commandUrl = `${config.iotEndpoint}/${version}/iot/${config.projectId}/devices/${config.deviceId}/commands`;
      console.log('命令URL:', commandUrl);
      
      const commandData = {
        service_id: 'IntelligentCockpit',
        command_name: 'light_control',
        paras: {
          onoff: 'ON'
        }
      };

      try {
        const commandResponse = await axios.post(commandUrl, commandData, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (commandResponse.status === 200 || commandResponse.status === 201) {
          console.log(`✅ ${version}版本 - 命令下发成功`);
          console.log('响应数据:', JSON.stringify(commandResponse.data, null, 2));
        }
      } catch (commandError) {
        console.log(`❌ ${version}版本 - 命令下发失败:`, commandError.message);
        if (commandError.response) {
          console.log('   状态码:', commandError.response.status);
          if (commandError.response.status !== 403) {
            console.log('   错误详情:', JSON.stringify(commandError.response.data, null, 2));
          }
        }
      }

      // 测试设备列表
      console.log(`\n4️⃣ 测试${version}版本 - 获取设备列表...`);
      const devicesUrl = `${config.iotEndpoint}/${version}/iot/${config.projectId}/devices`;
      
      try {
        const devicesResponse = await axios.get(devicesUrl, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          params: {
            limit: 5
          },
          timeout: 10000
        });

        if (devicesResponse.status === 200) {
          console.log(`✅ ${version}版本 - 设备列表获取成功`);
          const devices = devicesResponse.data.devices || [];
          console.log(`找到 ${devices.length} 个设备`);
        }
      } catch (devicesError) {
        console.log(`❌ ${version}版本 - 设备列表获取失败:`, devicesError.message);
        if (devicesError.response) {
          console.log('   状态码:', devicesError.response.status);
          if (devicesError.response.status !== 403) {
            console.log('   错误详情:', JSON.stringify(devicesError.response.data, null, 2));
          }
        }
      }
    }

    // 尝试不同的端点
    console.log('\n🔍 测试不同的IoT端点...');
    console.log('='.repeat(50));
    
    const endpoints = [
      'https://iotda.cn-north-4.myhuaweicloud.com',
      'https://iotda.myhuaweicloud.com',
      'https://iot.cn-north-4.myhuaweicloud.com'
    ];

    for (const endpoint of endpoints) {
      console.log(`\n测试端点: ${endpoint}`);
      const testUrl = `${endpoint}/v5/iot/${config.projectId}/devices`;
      
      try {
        const response = await axios.get(testUrl, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          params: { limit: 1 },
          timeout: 5000
        });

        if (response.status === 200) {
          console.log(`✅ 端点 ${endpoint} 可用`);
        }
      } catch (error) {
        console.log(`❌ 端点 ${endpoint} 不可用:`, error.message);
        if (error.response && error.response.status !== 403) {
          console.log('   状态码:', error.response.status);
        }
      }
    }

  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n📋 测试总结:');
  console.log('- 如果所有版本都返回403错误，说明是权限问题');
  console.log('- 如果某个版本返回其他错误，说明该版本可能是正确的');
  console.log('- 请检查华为云控制台中的IoT设备接入服务是否已开通');
  console.log('- 确认IAM用户是否有IoTDA服务权限');
}

// 运行测试
if (require.main === module) {
  testApiVersions().catch(console.error);
}

module.exports = testApiVersions;
