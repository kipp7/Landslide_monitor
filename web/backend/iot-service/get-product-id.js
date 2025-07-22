const axios = require('axios');

async function getProductId() {
  console.log('🔍 获取华为云IoT产品ID...\n');

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
    // 1. 获取project-scoped token
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
          project: {
            name: 'cn-north-4'
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

    // 2. 获取产品列表
    console.log('\n2️⃣ 获取产品列表...');
    const productsUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/products`;
    
    const productsResponse = await axios.get(productsUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      timeout: 10000
    });

    if (productsResponse.status === 200) {
      const products = productsResponse.data.products || [];
      console.log(`✅ 找到 ${products.length} 个产品:`);
      
      if (products.length === 0) {
        console.log('⚠️  没有找到任何产品');
      } else {
        products.forEach((product, index) => {
          console.log(`\n产品 ${index + 1}:`);
          console.log(`  产品ID: ${product.product_id}`);
          console.log(`  产品名称: ${product.name}`);
          console.log(`  设备类型: ${product.device_type}`);
          console.log(`  协议类型: ${product.protocol_type}`);
          console.log(`  数据格式: ${product.data_format}`);
          console.log(`  创建时间: ${product.create_time}`);
        });
      }
    }

    // 3. 获取设备详情（从设备信息中获取产品ID）
    console.log('\n3️⃣ 从设备信息获取产品ID...');
    const deviceUrl = `${config.iotEndpoint}/v5/iot/${config.projectId}/devices/${config.deviceId}`;
    
    const deviceResponse = await axios.get(deviceUrl, {
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': token
      },
      timeout: 10000
    });

    if (deviceResponse.status === 200) {
      const device = deviceResponse.data;
      console.log('✅ 设备信息获取成功:');
      console.log(`  设备ID: ${device.device_id}`);
      console.log(`  设备名称: ${device.device_name}`);
      console.log(`  产品ID: ${device.product_id}`);
      console.log(`  设备状态: ${device.status}`);
      console.log(`  节点ID: ${device.node_id}`);
      
      if (device.product_id) {
        console.log('\n🎯 找到设备对应的产品ID:');
        console.log(`HUAWEI_PRODUCT_ID=${device.product_id}`);
        
        // 检查产品ID是否与项目ID相同
        if (device.product_id === config.projectId) {
          console.log('\n⚠️  注意: 产品ID与项目ID相同，这可能是正确的，但通常它们应该不同');
        } else {
          console.log('\n✅ 产品ID与项目ID不同，这是正常的');
        }
        
        console.log('\n📝 请将以下配置更新到 .env 文件:');
        console.log(`HUAWEI_PROJECT_ID=${config.projectId}`);
        console.log(`HUAWEI_PRODUCT_ID=${device.product_id}`);
        console.log(`HUAWEI_DEVICE_ID=${device.device_id}`);
      }
    }

  } catch (error) {
    console.error('❌ 获取产品ID失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', JSON.stringify(error.response.data, null, 2));
    }
    
    if (error.response && error.response.status === 403) {
      console.log('\n💡 提示: 如果遇到403错误，可能是权限问题');
      console.log('   - 请确认IAM用户有IoT设备管理权限');
      console.log('   - 或者直接在华为云IoT控制台查看产品ID');
    }
  }
}

// 运行脚本
if (require.main === module) {
  getProductId().catch(console.error);
}

module.exports = getProductId;
