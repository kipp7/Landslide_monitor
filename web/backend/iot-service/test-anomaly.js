const { getAnomalyConfig, validateSensorData } = require('./anomaly-config');

/**
 * 测试异常检测逻辑
 */
function testAnomalyDetection() {
  console.log('🧪 测试异常检测逻辑...\n');
  
  const config = getAnomalyConfig();
  console.log('📋 当前异常检测配置:');
  console.log('- 温度范围:', config.thresholds.temperature.min, '°C ~', config.thresholds.temperature.max, '°C');
  console.log('- 湿度范围:', config.thresholds.humidity.min, '% ~', config.thresholds.humidity.max, '%');
  console.log('- 加速度阈值:', config.thresholds.acceleration.total_max, 'mg');
  console.log('- 陀螺仪阈值:', config.thresholds.gyroscope.total_max, '°/s');
  console.log('- 风险等级阈值:', config.thresholds.risk_level.critical);
  console.log('- 振动阈值:', config.thresholds.vibration.max);
  console.log('');

  // 测试数据集
  const testCases = [
    {
      name: '正常数据',
      data: {
        device_id: 'test_device_1',
        temperature: 32.5,
        humidity: 42.9,
        acceleration_total: 864,
        gyroscope_total: 200,
        risk_level: 0,
        vibration: 0.87,
        event_time: new Date().toISOString()
      },
      expectedAnomalies: 0
    },
    {
      name: '高温异常',
      data: {
        device_id: 'test_device_2',
        temperature: 55,
        humidity: 45,
        acceleration_total: 900,
        gyroscope_total: 150,
        risk_level: 0.2,
        vibration: 1.2,
        event_time: new Date().toISOString()
      },
      expectedAnomalies: 1
    },
    {
      name: '高加速度异常',
      data: {
        device_id: 'test_device_3',
        temperature: 28,
        humidity: 65,
        acceleration_total: 2500,
        gyroscope_total: 300,
        risk_level: 0.3,
        vibration: 2.1,
        event_time: new Date().toISOString()
      },
      expectedAnomalies: 1
    },
    {
      name: '多重异常',
      data: {
        device_id: 'test_device_4',
        temperature: 60,
        humidity: 105,
        acceleration_total: 3000,
        gyroscope_total: 1200,
        risk_level: 0.9,
        vibration: 6.5,
        event_time: new Date().toISOString()
      },
      expectedAnomalies: 6
    },
    {
      name: '传感器故障',
      data: {
        device_id: 'test_device_5',
        temperature: -100,
        humidity: -10,
        acceleration_total: 50000,
        gyroscope_total: 5000,
        risk_level: 1.5,
        vibration: 100,
        event_time: new Date().toISOString()
      },
      expectedAnomalies: 6
    }
  ];

  // 执行测试
  testCases.forEach((testCase, index) => {
    console.log(`🔍 测试 ${index + 1}: ${testCase.name}`);
    
    // 数据验证
    const validationIssues = validateSensorData(testCase.data);
    if (validationIssues.length > 0) {
      console.log('  ⚠️  数据验证问题:', validationIssues);
    }
    
    // 模拟异常检测
    const anomalies = detectAnomaliesSync(testCase.data, config);
    
    console.log(`  📊 检测到 ${anomalies.length} 个异常`);
    if (anomalies.length > 0) {
      anomalies.forEach(anomaly => {
        console.log(`    - ${anomaly.anomaly_type}: ${anomaly.value}`);
      });
    }
    
    // 验证结果
    if (anomalies.length === testCase.expectedAnomalies) {
      console.log('  ✅ 测试通过');
    } else {
      console.log(`  ❌ 测试失败: 期望 ${testCase.expectedAnomalies} 个异常，实际 ${anomalies.length} 个`);
    }
    console.log('');
  });
}

/**
 * 同步版本的异常检测（用于测试）
 */
function detectAnomaliesSync(record, config) {
  const thresholds = config.thresholds;
  const anomalies = [];

  // 温度异常检测
  if (record.temperature !== undefined && 
      (record.temperature > thresholds.temperature.max || 
       record.temperature < thresholds.temperature.min)) {
    anomalies.push({
      device_id: record.device_id,
      anomaly_type: config.types.TEMPERATURE_EXTREME,
      value: record.temperature
    });
  }

  // 湿度异常检测
  if (record.humidity !== undefined && 
      (record.humidity > thresholds.humidity.max || 
       record.humidity < thresholds.humidity.min)) {
    anomalies.push({
      device_id: record.device_id,
      anomaly_type: config.types.HUMIDITY_SENSOR_ERROR,
      value: record.humidity
    });
  }

  // 加速度异常检测
  if (record.acceleration_total !== undefined && 
      record.acceleration_total > thresholds.acceleration.total_max) {
    anomalies.push({
      device_id: record.device_id,
      anomaly_type: config.types.ACCELERATION_HIGH,
      value: record.acceleration_total
    });
  }

  // 陀螺仪异常检测
  if (record.gyroscope_total !== undefined && 
      record.gyroscope_total > thresholds.gyroscope.total_max) {
    anomalies.push({
      device_id: record.device_id,
      anomaly_type: config.types.GYROSCOPE_HIGH,
      value: record.gyroscope_total
    });
  }

  // 风险等级异常检测
  if (record.risk_level !== undefined && 
      record.risk_level > thresholds.risk_level.critical) {
    anomalies.push({
      device_id: record.device_id,
      anomaly_type: config.types.RISK_CRITICAL,
      value: record.risk_level
    });
  }

  // 振动异常检测
  if (record.vibration !== undefined && 
      record.vibration > thresholds.vibration.max) {
    anomalies.push({
      device_id: record.device_id,
      anomaly_type: config.types.VIBRATION_HIGH,
      value: record.vibration
    });
  }

  return anomalies;
}

/**
 * 测试风险评估
 */
function testRiskAssessment() {
  console.log('🎯 测试风险评估逻辑...\n');
  
  const testData = {
    device_id: 'test_device',
    acceleration_total: 1800,  // 会增加0.3风险
    gyroscope_total: 900,      // 会增加0.2风险
    vibration: 4.0,            // 会增加0.2风险
    humidity: 95,              // 会增加0.1风险
    risk_level: 0.1            // 设备自身风险
  };
  
  console.log('📊 测试数据:', testData);
  
  // 模拟风险计算
  let calculatedRisk = 0;
  
  if (testData.acceleration_total > 1500) calculatedRisk += 0.3;
  if (testData.gyroscope_total > 800) calculatedRisk += 0.2;
  if (testData.vibration > 3.0) calculatedRisk += 0.2;
  if (testData.humidity > 90) calculatedRisk += 0.1;
  
  calculatedRisk = Math.max(calculatedRisk, testData.risk_level);
  calculatedRisk = Math.min(1.0, calculatedRisk);
  
  let riskLevel;
  if (calculatedRisk > 0.8) riskLevel = 'critical_risk';
  else if (calculatedRisk > 0.6) riskLevel = 'high_risk';
  else if (calculatedRisk > 0.3) riskLevel = 'medium_risk';
  else riskLevel = 'low_risk';
  
  console.log(`🎯 计算风险等级: ${calculatedRisk.toFixed(2)} (${riskLevel})`);
  console.log('');
}

// 运行测试
if (require.main === module) {
  testAnomalyDetection();
  testRiskAssessment();
  
  console.log('✅ 异常检测测试完成');
  console.log('');
  console.log('💡 提示:');
  console.log('- 如果需要调整阈值，请修改 anomaly-config.js 文件');
  console.log('- 当前配置适合滑坡监测的户外环境');
  console.log('- 异常检测主要关注设备故障和极端情况');
}

module.exports = { testAnomalyDetection, testRiskAssessment };
