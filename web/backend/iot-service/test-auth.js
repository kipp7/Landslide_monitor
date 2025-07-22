const axios = require('axios');

async function testAuth() {
  console.log('🧪 测试华为云IAM认证...\n');

  const config = {
    iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
    iotEndpoint: 'https://iotda.cn-north-4.myhuaweicloud.com',
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k',
    deviceId: '6815a14f9314d118511807c6_rk2206'
  };

  try {
    // 1. 获取domain-scoped token
    console.log('1️⃣ 获取domain-scoped token...');
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
          domain: {
            name: config.domainName
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

    const domainToken = authResponse.headers['x-subject-token'];
    console.log('✅ Domain token获取成功');

    // 2. 获取项目列表
    console.log('\n2️⃣ 获取项目列表...');
    const projectsUrl = `${config.iamEndpoint}/v3/auth/projects`;
    
    const projectsResponse = await axios.get(projectsUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': domainToken
      },
      timeout: 10000
    });

    if (projectsResponse.status !== 200) {
      throw new Error(`获取项目列表失败，状态码: ${projectsResponse.status}`);
    }

    const projects = projectsResponse.data.projects;
    console.log(`✅ 找到 ${projects.length} 个项目`);

    // 查找cn-north-4项目
    const cnNorth4Project = projects.find(p => p.name === 'cn-north-4');
    if (!cnNorth4Project) {
      console.log('可用项目:');
      projects.forEach(p => console.log(`  - ${p.name}: ${p.id}`));
      throw new Error('未找到cn-north-4项目');
    }

    const projectId = cnNorth4Project.id;
    console.log(`✅ 找到cn-north-4项目ID: ${projectId}`);

    // 3. 获取project-scoped token
    console.log('\n3️⃣ 获取project-scoped token...');
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
            name: 'cn-north-4'
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

    // 4. 测试获取设备影子
    console.log('\n4️⃣ 测试获取设备影子...');
    const shadowUrl = `${config.iotEndpoint}/v5/iot/${projectId}/devices/${config.deviceId}/shadow`;
    
    const shadowResponse = await axios.get(shadowUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': projectToken
      },
      timeout: 10000
    });

    if (shadowResponse.status === 200) {
      console.log('✅ 设备影子获取成功');
      console.log('设备ID:', shadowResponse.data.device_id);
      if (shadowResponse.data.shadow && shadowResponse.data.shadow.length > 0) {
        console.log('服务数量:', shadowResponse.data.shadow.length);
      }
    }

    // 5. 测试命令下发
    console.log('\n5️⃣ 测试LED命令下发...');
    const commandUrl = `${config.iotEndpoint}/v5/iot/${projectId}/devices/${config.deviceId}/commands`;
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
        'X-Auth-Token': projectToken
      },
      timeout: 25000
    });

    if (commandResponse.status === 200 || commandResponse.status === 201) {
      console.log('✅ 命令下发成功');
      console.log('命令ID:', commandResponse.data.command_id);
      if (commandResponse.data.response) {
        console.log('设备响应:', commandResponse.data.response);
      }
    }

    // 输出配置信息
    console.log('\n🎯 请将以下配置添加到 .env 文件:');
    console.log(`HUAWEI_DOMAIN_NAME=${config.domainName}`);
    console.log(`HUAWEI_IAM_USERNAME=${config.iamUsername}`);
    console.log(`HUAWEI_IAM_PASSWORD=${config.iamPassword}`);
    console.log(`HUAWEI_PROJECT_ID=${projectId}`);
    console.log(`HUAWEI_DEVICE_ID=${config.deviceId}`);

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
  testAuth().catch(console.error);
}

module.exports = testAuth;
