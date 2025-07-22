const axios = require('axios');

async function verifyService() {
  console.log('✅ 验证IoT设备接入服务是否已开通...\n');

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
    console.log('1️⃣ 获取认证token...');
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
    console.log('✅ 认证成功');

    // 2. 测试设备列表API
    console.log('\n2️⃣ 测试设备列表API...');
    const devicesUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices`;
    
    try {
      const devicesResponse = await axios.get(devicesUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        params: { limit: 10 },
        timeout: 15000
      });

      if (devicesResponse.status === 200) {
        console.log('🎉 IoT设备接入服务已成功开通！');
        const devices = devicesResponse.data.devices || [];
        console.log(`📱 设备总数: ${devices.length}`);
        
        if (devices.length > 0) {
          console.log('\n📋 设备列表:');
          devices.forEach((device, index) => {
            console.log(`   ${index + 1}. ${device.device_id} (${device.device_name || '无名称'})`);
            console.log(`      状态: ${device.status}`);
            console.log(`      产品ID: ${device.product_id}`);
          });

          // 检查目标设备是否存在
          const targetDevice = devices.find(d => d.device_id === config.deviceId);
          if (targetDevice) {
            console.log(`\n✅ 找到目标设备: ${config.deviceId}`);
            console.log(`   设备名称: ${targetDevice.device_name || '无名称'}`);
            console.log(`   设备状态: ${targetDevice.status}`);
            console.log(`   产品ID: ${targetDevice.product_id}`);
          } else {
            console.log(`\n⚠️  未找到目标设备: ${config.deviceId}`);
            console.log('   请检查设备ID是否正确，或设备是否在该项目中');
          }
        }
      }
    } catch (devicesError) {
      if (devicesError.response && devicesError.response.status === 403) {
        console.log('❌ IoT设备接入服务尚未开通');
        console.log('   错误信息:', devicesError.response.data.error_msg);
        console.log('\n📝 请按以下步骤开通服务:');
        console.log('   1. 访问: https://console.huaweicloud.com/iotdm/');
        console.log('   2. 选择区域: 华北-北京四(cn-north-4)');
        console.log('   3. 点击"立即开通"或"免费试用"');
        console.log('   4. 完成实名认证（如需要）');
        return;
      } else {
        throw devicesError;
      }
    }

    // 3. 测试设备影子API
    console.log('\n3️⃣ 测试设备影子API...');
    const shadowUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/shadow`;
    
    try {
      const shadowResponse = await axios.get(shadowUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 15000
      });

      if (shadowResponse.status === 200) {
        console.log('✅ 设备影子获取成功');
        console.log(`📱 设备ID: ${shadowResponse.data.device_id}`);
        
        if (shadowResponse.data.shadow && shadowResponse.data.shadow.length > 0) {
          console.log(`🔧 服务数量: ${shadowResponse.data.shadow.length}`);
          shadowResponse.data.shadow.forEach((service, index) => {
            console.log(`   服务${index + 1}: ${service.service_id}`);
            if (service.reported && service.reported.properties) {
              const props = Object.keys(service.reported.properties);
              console.log(`      属性: ${props.slice(0, 3).join(', ')}${props.length > 3 ? '...' : ''}`);
            }
          });
        }
      }
    } catch (shadowError) {
      if (shadowError.response && shadowError.response.status === 404) {
        console.log('⚠️  设备不存在或设备影子为空');
      } else {
        console.log('❌ 设备影子获取失败:', shadowError.message);
      }
    }

    // 4. 测试命令下发API
    console.log('\n4️⃣ 测试命令下发API...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/commands`;
    const testCommand = {
      service_id: 'IntelligentCockpit',
      command_name: 'light_control',
      paras: {
        onoff: 'ON'
      }
    };

    try {
      const commandResponse = await axios.post(commandUrl, testCommand, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000
      });

      if (commandResponse.status === 200 || commandResponse.status === 201) {
        console.log('🎉 命令下发测试成功！');
        console.log(`📤 命令ID: ${commandResponse.data.command_id}`);
        
        if (commandResponse.data.response) {
          console.log('📥 设备响应:', JSON.stringify(commandResponse.data.response, null, 2));
        } else {
          console.log('⏳ 设备暂无响应（可能设备离线或处理中）');
        }

        // 输出最终配置
        console.log('\n🎯 服务验证成功！可以使用以下配置:');
        console.log('=====================================');
        console.log(`HUAWEI_DOMAIN_NAME=${config.domainName}`);
        console.log(`HUAWEI_IAM_USERNAME=${config.iamUsername}`);
        console.log(`HUAWEI_IAM_PASSWORD=${config.iamPassword}`);
        console.log(`HUAWEI_PROJECT_ID=${config.projectId}`);
        console.log(`HUAWEI_DEVICE_ID=${config.deviceId}`);
        console.log(`HUAWEI_IAM_ENDPOINT=${config.iamEndpoint}`);
        console.log(`HUAWEI_IOT_ENDPOINT=${config.iotEndpoint}`);
        console.log('=====================================');
      }
    } catch (commandError) {
      if (commandError.response && commandError.response.status === 404) {
        console.log('⚠️  设备不存在，无法下发命令');
      } else if (commandError.response && commandError.response.status === 400) {
        console.log('⚠️  命令格式错误或设备不支持该命令');
      } else {
        console.log('❌ 命令下发失败:', commandError.message);
        if (commandError.response) {
          console.log('   状态码:', commandError.response.status);
        }
      }
    }

  } catch (error) {
    console.error('❌ 验证失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// 运行验证
if (require.main === module) {
  verifyService().catch(console.error);
}

module.exports = verifyService;
