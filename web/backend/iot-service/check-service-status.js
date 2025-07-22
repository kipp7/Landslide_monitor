const axios = require('axios');

async function checkServiceStatus() {
  console.log('🔍 检查华为云服务开通状态...\n');

  const config = {
    iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k',
    projectId: '41a2637bc1ba4889bc3b49c4e2ab9e77'
  };

  try {
    // 1. 获取domain-scoped token
    console.log('1️⃣ 获取domain-scoped token...');
    const authUrl = `${config.iamEndpoint}/v3/auth/tokens`;
    const domainAuthData = {
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
          domain: {
            name: config.domainName
          }
        }
      }
    };

    const domainAuthResponse = await axios.post(authUrl, domainAuthData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (domainAuthResponse.status !== 201) {
      throw new Error(`域认证失败，状态码: ${domainAuthResponse.status}`);
    }

    const domainToken = domainAuthResponse.headers['x-subject-token'];
    console.log('✅ Domain token获取成功');

    // 2. 获取用户权限信息
    console.log('\n2️⃣ 检查用户权限...');
    try {
      const userUrl = `${config.iamEndpoint}/v3/users`;
      const userResponse = await axios.get(userUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': domainToken
        },
        params: {
          name: config.iamUsername
        },
        timeout: 10000
      });

      if (userResponse.status === 200) {
        console.log('✅ 用户信息获取成功');
        const users = userResponse.data.users || [];
        if (users.length > 0) {
          console.log(`   用户ID: ${users[0].id}`);
          console.log(`   用户名: ${users[0].name}`);
          console.log(`   状态: ${users[0].enabled ? '启用' : '禁用'}`);
        }
      }
    } catch (userError) {
      console.log('⚠️  用户信息获取失败:', userError.message);
    }

    // 3. 检查项目信息
    console.log('\n3️⃣ 检查项目信息...');
    try {
      const projectsUrl = `${config.iamEndpoint}/v3/auth/projects`;
      const projectsResponse = await axios.get(projectsUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': domainToken
        },
        timeout: 10000
      });

      if (projectsResponse.status === 200) {
        console.log('✅ 项目列表获取成功');
        const projects = projectsResponse.data.projects || [];
        console.log(`   总项目数: ${projects.length}`);
        
        const targetProject = projects.find(p => p.id === config.projectId);
        if (targetProject) {
          console.log(`   ✅ 找到目标项目:`);
          console.log(`      项目ID: ${targetProject.id}`);
          console.log(`      项目名: ${targetProject.name}`);
          console.log(`      状态: ${targetProject.enabled ? '启用' : '禁用'}`);
          console.log(`      描述: ${targetProject.description || '无'}`);
        } else {
          console.log(`   ❌ 未找到项目ID: ${config.projectId}`);
          console.log('   可用项目:');
          projects.slice(0, 5).forEach(p => {
            console.log(`      - ${p.name}: ${p.id}`);
          });
        }
      }
    } catch (projectError) {
      console.log('❌ 项目信息获取失败:', projectError.message);
    }

    // 4. 获取project-scoped token并检查服务
    console.log('\n4️⃣ 获取project-scoped token...');
    const projectAuthData = {
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

    const projectAuthResponse = await axios.post(authUrl, projectAuthData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (projectAuthResponse.status !== 201) {
      throw new Error(`项目认证失败，状态码: ${projectAuthResponse.status}`);
    }

    const projectToken = projectAuthResponse.headers['x-subject-token'];
    console.log('✅ Project token获取成功');

    // 5. 检查可用的服务端点
    console.log('\n5️⃣ 检查服务端点可用性...');
    const serviceEndpoints = [
      'https://iotda.cn-north-4.myhuaweicloud.com',
      'https://iotda.ap-southeast-1.myhuaweicloud.com',
      'https://iotda.cn-north-1.myhuaweicloud.com'
    ];

    for (const endpoint of serviceEndpoints) {
      try {
        console.log(`   测试端点: ${endpoint}`);
        
        // 简单的健康检查 - 尝试获取设备列表
        const healthUrl = `${endpoint}/v5/iot/${config.projectId}/devices`;
        const healthResponse = await axios.get(healthUrl, {
          headers: {
            'Content-Type': 'application/json',
            'X-Auth-Token': projectToken
          },
          params: { limit: 1 },
          timeout: 5000
        });

        if (healthResponse.status === 200) {
          console.log(`   ✅ 端点可用: ${endpoint}`);
          console.log(`      响应正常，服务已开通`);
        }
      } catch (endpointError) {
        console.log(`   ❌ 端点不可用: ${endpoint}`);
        if (endpointError.response) {
          console.log(`      状态码: ${endpointError.response.status}`);
          if (endpointError.response.status === 403) {
            console.log(`      权限错误: 可能是服务未开通或权限不足`);
          } else if (endpointError.response.status === 404) {
            console.log(`      服务不存在: API版本或端点错误`);
          }
        } else if (endpointError.code === 'ENOTFOUND') {
          console.log(`      DNS解析失败: 端点不存在`);
        } else {
          console.log(`      连接错误: ${endpointError.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('\n📋 建议:');
  console.log('1. 如果所有端点都返回403错误，请在华为云控制台开通IoT设备接入服务');
  console.log('2. 确保在正确的区域（如cn-north-4）开通服务');
  console.log('3. 为IAM用户分配IoTDA相关权限');
  console.log('4. 检查项目ID是否正确');
  console.log('\n🔗 华为云IoT设备接入控制台:');
  console.log('   https://console.huaweicloud.com/iotdm/');
}

// 运行检查
if (require.main === module) {
  checkServiceStatus().catch(console.error);
}

module.exports = checkServiceStatus;
