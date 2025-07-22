const axios = require('axios');

async function testGlobalEndpoint() {
  console.log('🧪 测试华为云IoT全局端点...\n');

  const config = {
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k',
    projectId: '41a2637bc1ba4889bc3b49c4e2ab9e77',
    deviceId: '6815a14f9314d118511807c6_rk2206'
  };

  // 测试不同的全局端点
  const endpoints = [
    {
      name: '全局端点1',
      iamEndpoint: 'https://iam.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.ap-southeast-1.myhuaweicloud.com'
    },
    {
      name: '全局端点2', 
      iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.ap-southeast-1.myhuaweicloud.com'
    },
    {
      name: '华北-北京四（原端点）',
      iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.cn-north-4.myhuaweicloud.com'
    },
    {
      name: '测试无区域端点',
      iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.myhuaweicloud.com'
    }
  ];

  for (const endpoint of endpoints) {
    console.log(`\n🌐 测试端点: ${endpoint.name}`);
    console.log('='.repeat(60));
    console.log(`IAM: ${endpoint.iamEndpoint}`);
    console.log(`IoT: ${endpoint.iotEndpoint}`);

    try {
      // 1. 获取token
      console.log('\n1️⃣ 获取token...');
      const authUrl = `${endpoint.iamEndpoint}/v3/auth/tokens`;
      
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
        console.log('❌ 认证失败');
        continue;
      }

      const token = authResponse.headers['x-subject-token'];
      console.log('✅ Token获取成功');

      // 2. 测试IoT API
      console.log('\n2️⃣ 测试IoT API...');
      
      // 测试设备列表
      try {
        console.log('   测试设备列表...');
        const devicesUrl = `${endpoint.iotEndpoint}/v5/iot/${config.projectId}/devices`;
        
        const devicesResponse = await axios.get(devicesUrl, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          params: { limit: 1 },
          timeout: 15000
        });

        if (devicesResponse.status === 200) {
          console.log('   ✅ 设备列表获取成功');
          const devices = devicesResponse.data.devices || [];
          console.log(`   📱 设备数量: ${devices.length}`);
          
          if (devices.length > 0) {
            console.log(`   📋 第一个设备: ${devices[0].device_id}`);
          }
        }
      } catch (devicesError) {
        console.log('   ❌ 设备列表失败:', devicesError.message);
        if (devicesError.response) {
          console.log(`      状态码: ${devicesError.response.status}`);
          if (devicesError.response.data && devicesError.response.data.error_msg) {
            console.log(`      错误: ${devicesError.response.data.error_msg}`);
          }
        }
      }

      // 测试设备影子
      try {
        console.log('   测试设备影子...');
        const shadowUrl = `${endpoint.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/shadow`;
        
        const shadowResponse = await axios.get(shadowUrl, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 15000
        });

        if (shadowResponse.status === 200) {
          console.log('   ✅ 设备影子获取成功');
          console.log(`   📱 设备ID: ${shadowResponse.data.device_id}`);
          if (shadowResponse.data.shadow && shadowResponse.data.shadow.length > 0) {
            console.log(`   🔧 服务数量: ${shadowResponse.data.shadow.length}`);
            shadowResponse.data.shadow.forEach((service, index) => {
              console.log(`      服务${index + 1}: ${service.service_id}`);
            });
          }
        }
      } catch (shadowError) {
        console.log('   ❌ 设备影子失败:', shadowError.message);
        if (shadowError.response) {
          console.log(`      状态码: ${shadowError.response.status}`);
          if (shadowError.response.data && shadowError.response.data.error_msg) {
            console.log(`      错误: ${shadowError.response.data.error_msg}`);
          }
        }
      }

      // 如果设备影子成功，测试命令下发
      console.log('   测试命令下发...');
      try {
        const commandUrl = `${endpoint.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
        const commandData = {
          service_id: 'IntelligentCockpit',
          command_name: 'light_control',
          paras: {
            onoff: 'ON'
          }
        };

        const commandResponse = await axios.post(commandUrl, commandData, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': token
          },
          timeout: 25000
        });

        if (commandResponse.status === 200 || commandResponse.status === 201) {
          console.log('   ✅ 命令下发成功');
          console.log(`   📤 命令ID: ${commandResponse.data.command_id}`);
          if (commandResponse.data.response) {
            console.log('   📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
          }
          
          // 如果成功，输出配置信息
          console.log('\n🎯 成功配置:');
          console.log(`HUAWEI_IAM_ENDPOINT=${endpoint.iamEndpoint}`);
          console.log(`HUAWEI_IOT_ENDPOINT=${endpoint.iotEndpoint}`);
          console.log(`HUAWEI_PROJECT_ID=${config.projectId}`);
          console.log(`HUAWEI_DEVICE_ID=${config.deviceId}`);
        }
      } catch (commandError) {
        console.log('   ❌ 命令下发失败:', commandError.message);
        if (commandError.response) {
          console.log(`      状态码: ${commandError.response.status}`);
          if (commandError.response.data && commandError.response.data.error_msg) {
            console.log(`      错误: ${commandError.response.data.error_msg}`);
          }
        }
      }

    } catch (error) {
      console.log(`❌ 端点${endpoint.name}测试失败:`, error.message);
      if (error.code === 'ENOTFOUND') {
        console.log('   DNS解析失败，端点不存在');
      }
    }
  }

  console.log('\n📋 总结:');
  console.log('1. 如果某个端点的API调用成功，请使用该配置');
  console.log('2. 如果所有端点都失败，需要在华为云控制台开通IoTDA服务');
  console.log('3. 确保IAM用户有IoTDA服务的访问权限');
  console.log('4. 检查设备是否在正确的区域和项目中');
}

// 运行测试
if (require.main === module) {
  testGlobalEndpoint().catch(console.error);
}

module.exports = testGlobalEndpoint;
