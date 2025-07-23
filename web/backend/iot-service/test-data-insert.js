// 测试数据插入脚本
const axios = require('axios');

// 模拟华为云IoT推送的数据格式
const testData = {
  "notify_data": {
    "header": {
      "device_id": "6815a14f9314d118511807c6_rk2206",
      "product_id": "6815a14f9314d118511807c6",
      "gateway_id": "6815a14f9314d118511807c6_rk2206",
      "app_id": "your_app_id"
    },
    "body": {
      "services": [
        {
          "service_id": "smartHome",
          "properties": {
            "temperature": 25.5,
            "humidity": 60.2,
            "illumination": 150.0,
            "acceleration_x": 100,
            "acceleration_y": 200,
            "acceleration_z": 800,
            "gyroscope_x": -50,
            "gyroscope_y": 10,
            "gyroscope_z": -30,
            "mpu_temperature": 26.0,
            "latitude": 22.817,
            "longitude": 108.3669,
            "vibration": 0.5,
            "risk_level": 0,
            "alarm_active": false,
            "uptime": 3600,
            "angle_x": 1.5,
            "angle_y": 0.2,
            "angle_z": 1.8,
            "ultrasonic_distance": 100
          },
          "event_time": new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z')
        }
      ]
    }
  },
  "resource": "device.data",
  "event": "report",
  "event_time": new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z/, 'Z')
};

async function testDataInsert() {
  try {
    console.log('发送测试数据到IoT接口...');
    console.log('测试数据:', JSON.stringify(testData, null, 2));
    
    const response = await axios.post('http://localhost:5100/iot/huawei', testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log('响应状态:', response.status);
    console.log('响应数据:', response.data);
    console.log('✅ 测试成功！');
    
  } catch (error) {
    console.error('❌ 测试失败:');
    if (error.response) {
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
    } else if (error.request) {
      console.error('网络错误:', error.message);
    } else {
      console.error('其他错误:', error.message);
    }
  }
}

// 运行测试
testDataInsert();
