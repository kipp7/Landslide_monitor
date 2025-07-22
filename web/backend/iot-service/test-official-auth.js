const axios = require('axios');

async function testOfficialAuth() {
  console.log('🧪 基于官方文档测试华为云IoT认证...\n');

  const config = {
    // 根据官方文档，可以使用全局端点或区域端点
    iamEndpoint: 'https://iam.myhuaweicloud.com',  // 全局端点
    iotEndpoint: 'https://iotda.cn-north-4.myhuaweicloud.com',
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k',
    projectId: '41a2637bc1ba4889bc3b49c4e2ab9e77',
    deviceId: '6815a14f9314d118511807c6_rk2206'
  };

  try {
    // 1. 按照官方文档格式获取project-scoped token
    console.log('1️⃣ 使用官方文档格式获取project-scoped token...');
    const authUrl = `${config.iamEndpoint}/v3/auth/tokens`;
    
    // 完全按照官方文档的请求格式
    const authData = {
      auth: {
        identity: {
          methods: ["password"],
          password: {
            user: {
              domain: {
                name: config.domainName  // IAM用户所属帐号名
              },
              name: config.iamUsername,     // IAM用户名
              password: config.iamPassword  // IAM用户密码
            }
          }
        },
        scope: {
          project: {
            name: "cn-north-4"  // 项目名称，按照官方文档使用项目名而不是ID
          }
        }
      }
    };

    console.log('认证请求数据:', JSON.stringify(authData, null, 2));

    const authResponse = await axios.post(authUrl, authData, {
      headers: {
        'Content-Type': 'application/json;charset=utf8'  // 按照官方文档的格式
      },
      timeout: 15000
    });

    if (authResponse.status !== 201) {
      throw new Error(`认证失败，状态码: ${authResponse.status}`);
    }

    const token = authResponse.headers['x-subject-token'];
    if (!token) {
      throw new Error('未能从响应头中获取到token');
    }

    console.log('✅ Token获取成功');
    console.log('Token长度:', token.length);
    
    // 显示token信息
    if (authResponse.data && authResponse.data.token) {
      const tokenInfo = authResponse.data.token;
      console.log('Token过期时间:', tokenInfo.expires_at);
      console.log('Token下发时间:', tokenInfo.issued_at);
      if (tokenInfo.project) {
        console.log('项目信息:', tokenInfo.project.name, tokenInfo.project.id);
      }
    }

    // 2. 测试IoT API
    console.log('\n2️⃣ 测试IoT设备接入API...');
    
    // 使用获取到的项目ID（从token响应中获取）
    let actualProjectId = config.projectId;
    if (authResponse.data && authResponse.data.token && authResponse.data.token.project) {
      actualProjectId = authResponse.data.token.project.id;
      console.log('使用token中的项目ID:', actualProjectId);
    }

    // 测试设备列表
    console.log('\n   测试设备列表API...');
    try {
      const devicesUrl = `${config.iotEndpoint}/v5/iot/${actualProjectId}/devices`;
      console.log('   请求URL:', devicesUrl);
      
      const devicesResponse = await axios.get(devicesUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        params: { limit: 5 },
        timeout: 15000
      });

      if (devicesResponse.status === 200) {
        console.log('   ✅ 设备列表获取成功');
        const devices = devicesResponse.data.devices || [];
        console.log(`   📱 设备数量: ${devices.length}`);
        
        if (devices.length > 0) {
          console.log('   📋 设备列表:');
          devices.forEach((device, index) => {
            console.log(`      ${index + 1}. ${device.device_id} (${device.device_name || '无名称'})`);
            console.log(`         状态: ${device.status}, 产品ID: ${device.product_id}`);
          });

          // 检查目标设备
          const targetDevice = devices.find(d => d.device_id === config.deviceId);
          if (targetDevice) {
            console.log(`\n   🎯 找到目标设备: ${config.deviceId}`);
            console.log(`      设备名称: ${targetDevice.device_name || '无名称'}`);
            console.log(`      设备状态: ${targetDevice.status}`);
            console.log(`      产品ID: ${targetDevice.product_id}`);
          } else {
            console.log(`\n   ⚠️  未找到目标设备: ${config.deviceId}`);
          }
        }
      }
    } catch (devicesError) {
      console.log('   ❌ 设备列表获取失败:', devicesError.message);
      if (devicesError.response) {
        console.log(`      状态码: ${devicesError.response.status}`);
        if (devicesError.response.data) {
          console.log('      错误详情:', JSON.stringify(devicesError.response.data, null, 2));
        }
      }
    }

    // 测试设备影子
    console.log('\n   测试设备影子API...');
    try {
      const shadowUrl = `${config.iotEndpoint}/v5/iot/${actualProjectId}/devices/${config.deviceId}/shadow`;
      console.log('   请求URL:', shadowUrl);
      
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
            if (service.reported && service.reported.properties) {
              const props = Object.keys(service.reported.properties);
              console.log(`         属性: ${props.slice(0, 3).join(', ')}${props.length > 3 ? '...' : ''}`);
            }
          });
        }
      }
    } catch (shadowError) {
      console.log('   ❌ 设备影子获取失败:', shadowError.message);
      if (shadowError.response) {
        console.log(`      状态码: ${shadowError.response.status}`);
        if (shadowError.response.data) {
          console.log('      错误详情:', JSON.stringify(shadowError.response.data, null, 2));
        }
      }
    }

    // 测试命令下发
    console.log('\n   测试命令下发API...');
    try {
      const commandUrl = `${config.iotEndpoint}/v5/iot/${actualProjectId}/devices/${config.deviceId}/commands`;
      console.log('   请求URL:', commandUrl);
      
      const testCommand = {
        service_id: 'IntelligentCockpit',
        command_name: 'light_control',
        paras: {
          onoff: 'ON'
        }
      };

      console.log('   命令数据:', JSON.stringify(testCommand, null, 2));

      const commandResponse = await axios.post(commandUrl, testCommand, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (commandResponse.status === 200 || commandResponse.status === 201) {
        console.log('   🎉 命令下发成功！');
        console.log(`   📤 命令ID: ${commandResponse.data.command_id}`);
        
        if (commandResponse.data.response) {
          console.log('   📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
        } else {
          console.log('   ⏳ 设备暂无响应（可能设备离线或处理中）');
        }

        // 输出成功配置
        console.log('\n🎯 测试成功！推荐配置:');
        console.log('=====================================');
        console.log(`HUAWEI_IAM_ENDPOINT=${config.iamEndpoint}`);
        console.log(`HUAWEI_IOT_ENDPOINT=${config.iotEndpoint}`);
        console.log(`HUAWEI_DOMAIN_NAME=${config.domainName}`);
        console.log(`HUAWEI_IAM_USERNAME=${config.iamUsername}`);
        console.log(`HUAWEI_IAM_PASSWORD=${config.iamPassword}`);
        console.log(`HUAWEI_PROJECT_ID=${actualProjectId}`);
        console.log(`HUAWEI_DEVICE_ID=${config.deviceId}`);
        console.log('=====================================');
      }
    } catch (commandError) {
      console.log('   ❌ 命令下发失败:', commandError.message);
      if (commandError.response) {
        console.log(`      状态码: ${commandError.response.status}`);
        if (commandError.response.data) {
          console.log('      错误详情:', JSON.stringify(commandError.response.data, null, 2));
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

  console.log('\n📋 说明:');
  console.log('1. 本测试完全按照华为云官方IAM文档格式进行');
  console.log('2. 使用全局IAM端点和项目名称进行认证');
  console.log('3. 如果仍然失败，可能需要在华为云控制台开通IoT设备接入服务');
}

// 运行测试
if (require.main === module) {
  testOfficialAuth().catch(console.error);
}

module.exports = testOfficialAuth;
