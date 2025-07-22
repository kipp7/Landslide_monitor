const axios = require('axios');

async function getProjectId() {
  console.log('🔍 获取华为云项目ID...\n');

  const config = {
    iamEndpoint: 'https://iam.cn-north-4.myhuaweicloud.com',
    domainName: 'hid_d-zeks2kzzvtkdc',
    iamUsername: 'k',
    iamPassword: '12345678k'
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

    const token = authResponse.headers['x-subject-token'];
    console.log('✅ IAM token获取成功');

    // 2. 获取项目列表
    console.log('\n2️⃣ 获取项目列表...');
    const projectsUrl = `${config.iamEndpoint}/v3/auth/projects`;
    
    const projectsResponse = await axios.get(projectsUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      timeout: 10000
    });

    if (projectsResponse.status === 200) {
      const projects = projectsResponse.data.projects;
      console.log('✅ 项目列表获取成功');
      console.log(`找到 ${projects.length} 个项目:\n`);

      projects.forEach((project, index) => {
        console.log(`项目 ${index + 1}:`);
        console.log(`  名称: ${project.name}`);
        console.log(`  ID: ${project.id}`);
        console.log(`  描述: ${project.description || '无描述'}`);
        console.log(`  状态: ${project.enabled ? '启用' : '禁用'}`);
        console.log('');
      });

      // 查找cn-north-4项目
      const cnNorth4Project = projects.find(p => p.name === 'cn-north-4');
      if (cnNorth4Project) {
        console.log('🎯 推荐使用的项目ID (cn-north-4):');
        console.log(`HUAWEI_PROJECT_ID=${cnNorth4Project.id}`);
        console.log('\n请将此项目ID添加到 .env 文件中');
      } else {
        console.log('⚠️  未找到cn-north-4项目，请选择合适的项目ID');
      }

    } else {
      throw new Error(`获取项目列表失败，状态码: ${projectsResponse.status}`);
    }

  } catch (error) {
    console.error('❌ 获取项目ID失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行脚本
if (require.main === module) {
  getProjectId().catch(console.error);
}

module.exports = getProjectId;
