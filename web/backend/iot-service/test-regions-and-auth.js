const axios = require('axios');

async function testRegionsAndAuth() {
  console.log('🧪 测试不同区域和认证方式...\n');

  const config = {
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k',
    projectId: '41a2637bc1ba4889bc3b49c4e2ab9e77',
    deviceId: '6815a14f9314d118511807c6_rk2206'
  };

  // 测试不同区域
  const regions = [
    {
      name: 'cn-north-4 (北京四)',
      iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.cn-north-4.myhuaweicloud.com'
    },
    {
      name: 'cn-north-1 (北京一)',
      iamEndpoint: 'https://iam.cn-north-1.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.cn-north-1.myhuaweicloud.com'
    },
    {
      name: 'cn-east-3 (上海一)',
      iamEndpoint: 'https://iam.cn-east-3.myhuaweicloud.com',
      iotEndpoint: 'https://iotda.cn-east-3.myhuaweicloud.com'
    }
  ];

  for (const region of regions) {
    console.log(`\n🌍 测试区域: ${region.name}`);
    console.log('='.repeat(60));

    try {
      // 1. 获取token
      console.log('1️⃣ 获取token...');
      const authUrl = `${region.iamEndpoint}/v3/auth/tokens`;
      
      // 尝试不同的认证scope
      const scopes = [
        {
          name: 'project-id',
          scope: { project: { id: config.projectId } }
        },
        {
          name: 'project-name',
          scope: { project: { name: 'cn-north-4' } }
        },
        {
          name: 'domain',
          scope: { domain: { name: config.domainName } }
        }
      ];

      let validToken = null;
      let validScope = null;

      for (const scopeConfig of scopes) {
        try {
          console.log(`   尝试${scopeConfig.name}认证...`);
          
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
              scope: scopeConfig.scope
            }
          };

          const authResponse = await axios.post(authUrl, authData, {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 10000
          });

          if (authResponse.status === 201) {
            validToken = authResponse.headers['x-subject-token'];
            validScope = scopeConfig.name;
            console.log(`   ✅ ${scopeConfig.name}认证成功`);
            break;
          }
        } catch (authError) {
          console.log(`   ❌ ${scopeConfig.name}认证失败:`, authError.message);
        }
      }

      if (!validToken) {
        console.log('❌ 所有认证方式都失败');
        continue;
      }

      console.log(`✅ 使用${validScope}认证成功`);

      // 2. 测试IoT API
      console.log('\n2️⃣ 测试IoT API...');
      
      // 测试v5版本
      const testUrls = [
        {
          name: '设备列表(v5)',
          url: `${region.iotEndpoint}/v5/iot/${config.projectId}/devices`,
          method: 'GET',
          params: { limit: 1 }
        },
        {
          name: '设备影子(v5)',
          url: `${region.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}/shadow`,
          method: 'GET'
        },
        {
          name: '设备列表(v3)',
          url: `${region.iotEndpoint}/v3/iot/${config.projectId}/devices`,
          method: 'GET',
          params: { limit: 1 }
        },
        {
          name: '设备影子(v3)',
          url: `${region.iotEndpoint}/v3/iot/${config.projectId}/devices/${config.deviceId}/shadow`,
          method: 'GET'
        }
      ];

      for (const testUrl of testUrls) {
        try {
          console.log(`   测试${testUrl.name}...`);
          
          const requestConfig = {
            headers: {
              'Content-Type': 'application/json',
              'X-Auth-Token': validToken
            },
            timeout: 10000
          };

          if (testUrl.params) {
            requestConfig.params = testUrl.params;
          }

          const response = await axios.get(testUrl.url, requestConfig);

          if (response.status === 200) {
            console.log(`   ✅ ${testUrl.name} 成功`);
            
            // 如果是设备影子，显示详细信息
            if (testUrl.name.includes('设备影子') && response.data) {
              console.log(`      设备ID: ${response.data.device_id || '未知'}`);
              if (response.data.shadow && response.data.shadow.length > 0) {
                console.log(`      服务数量: ${response.data.shadow.length}`);
              }
            }
            
            // 如果是设备列表，显示设备数量
            if (testUrl.name.includes('设备列表') && response.data) {
              const devices = response.data.devices || [];
              console.log(`      设备数量: ${devices.length}`);
            }
          }
        } catch (testError) {
          console.log(`   ❌ ${testUrl.name} 失败:`, testError.message);
          if (testError.response) {
            console.log(`      状态码: ${testError.response.status}`);
            if (testError.response.status === 403) {
              console.log(`      权限错误: ${testError.response.data.error_msg || '未知'}`);
            } else if (testError.response.status === 404) {
              console.log(`      资源不存在或API版本不支持`);
            }
          }
        }
      }

    } catch (error) {
      console.log(`❌ 区域${region.name}测试失败:`, error.message);
    }
  }

  console.log('\n📋 测试建议:');
  console.log('1. 如果某个区域的某个API版本成功，请使用该配置');
  console.log('2. 如果所有测试都返回403，请检查IAM权限配置');
  console.log('3. 如果返回404，说明API版本或端点不正确');
  console.log('4. 确保在华为云控制台中已开通IoT设备接入服务');
}

// 运行测试
if (require.main === module) {
  testRegionsAndAuth().catch(console.error);
}

module.exports = testRegionsAndAuth;
