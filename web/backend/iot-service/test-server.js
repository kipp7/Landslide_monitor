// 测试华为IoT数据接收功能

const testData = {
  "resource": "device.property",
  "event": "report",
  "event_time": "20240117T120000Z",
  "notify_data": {
    "header": {
      "device_id": "test-device-001",
      "product_id": "landslide-monitor-001",
      "app_id": "test-app",
      "gateway_id": "gateway-001"
    },
    "body": {
      "services": [
        {
          "service_id": "sensor_data",
          "properties": {
            "temperature": 25.5,
            "humidity": 60.2,
            "acceleration_x": 0.1,
            "acceleration_y": 0.2,
            "acceleration_z": 9.8,
            "gyroscope_x": 0.01,
            "gyroscope_y": 0.02,
            "gyroscope_z": 0.03,
            "rainfall": 0.0
          },
          "event_time": "20240117T120000Z"
        },
        {
          "service_id": "environmental_data",
          "properties": {
            "pressure": 1013.25,
            "altitude": 100.5,
            "battery_level": 85
          },
          "event_time": "20240117T120000Z"
        }
      ]
    }
  }
};

async function testServer() {
  console.log('🧪 测试华为IoT数据接收服务...\n');

  try {
    // 测试健康检查
    console.log('1. 测试健康检查...');
    const healthResponse = await fetch('http://localhost:5100/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ 健康检查通过:', healthData.status);
    } else {
      console.log('❌ 健康检查失败');
      return;
    }

    // 测试服务信息
    console.log('\n2. 测试服务信息...');
    const infoResponse = await fetch('http://localhost:5100/info');
    if (infoResponse.ok) {
      const infoData = await infoResponse.json();
      console.log('✅ 服务信息:', infoData.name);
    }

    // 测试IoT数据接收
    console.log('\n3. 测试IoT数据接收...');
    console.log('发送测试数据:', JSON.stringify(testData, null, 2));
    
    const iotResponse = await fetch('http://localhost:5100/iot/huawei', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });

    if (iotResponse.ok) {
      const iotData = await iotResponse.json();
      console.log('✅ IoT数据接收成功:');
      console.log('  状态码:', iotData['Status Code']);
      console.log('  消息:', iotData.message);
      console.log('  设备ID:', iotData.device_id);
      console.log('  处理服务数:', iotData.processed_services);
      console.log('  处理时间:', iotData.processing_time_ms + 'ms');
    } else {
      const errorData = await iotResponse.json();
      console.log('❌ IoT数据接收失败:', errorData);
    }

    console.log('\n🎉 测试完成!');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
    console.log('\n💡 请确保服务已启动: ./start.sh');
  }
}

// 检查是否有fetch函数（Node.js 18+）
if (typeof fetch === 'undefined') {
  console.log('❌ 需要Node.js 18+版本或安装node-fetch');
  console.log('当前Node.js版本:', process.version);
  process.exit(1);
}

testServer();
