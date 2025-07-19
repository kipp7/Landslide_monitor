const { 
  parseDeviceInfo, 
  getDeviceDisplayName, 
  getDeviceShortName,
  createDeviceRegistration,
  createDeviceLocation,
  batchProcessDeviceNames
} = require('./device-registry');

/**
 * 测试设备注册系统
 */
function testDeviceRegistry() {
  console.log('🧪 测试设备注册系统...\n');

  // 测试设备ID列表（包括你的实际设备ID）
  const testDeviceIds = [
    '6815a14f9314d118511807c6_rk2206',  // 你的实际设备
    'abc123_sensor',
    'def456_rk2206', 
    'gateway_001',
    'test_device_123'
  ];

  console.log('📋 设备名称生成测试:');
  testDeviceIds.forEach((deviceId, index) => {
    const info = parseDeviceInfo(deviceId);
    console.log(`${index + 1}. 原始ID: ${deviceId}`);
    console.log(`   友好名称: ${info.friendly_name}`);
    console.log(`   显示名称: ${getDeviceDisplayName(deviceId)}`);
    console.log(`   简短名称: ${getDeviceShortName(deviceId)}`);
    console.log(`   设备类型: ${info.device_type}`);
    console.log(`   短ID: ${info.short_id}`);
    console.log('');
  });

  console.log('📊 批量处理测试:');
  const batchResults = batchProcessDeviceNames(testDeviceIds);
  console.table(batchResults);

  console.log('🏭 设备注册信息测试:');
  const deviceRegistration = createDeviceRegistration('6815a14f9314d118511807c6_rk2206');
  console.log('设备注册信息:', JSON.stringify(deviceRegistration, null, 2));

  console.log('📍 设备位置信息测试:');
  const deviceLocation = createDeviceLocation('6815a14f9314d118511807c6_rk2206', 22.817, 108.3669);
  console.log('设备位置信息:', JSON.stringify(deviceLocation, null, 2));
}

/**
 * 测试地理位置命名
 */
function testLocationNaming() {
  console.log('🗺️  测试地理位置命名...\n');

  const testLocations = [
    { lat: 22.817, lon: 108.3669, name: '防城港实际位置' },
    { lat: 23.0, lon: 108.0, name: '测试位置1' },
    { lat: 22.5, lon: 109.0, name: '测试位置2' },
    { lat: 25.0, lon: 110.0, name: '测试位置3' }
  ];

  testLocations.forEach((location, index) => {
    const deviceLocation = createDeviceLocation(`test_device_${index}`, location.lat, location.lon);
    console.log(`${index + 1}. ${location.name} (${location.lat}, ${location.lon})`);
    console.log(`   生成的位置名称: ${deviceLocation.location_name}`);
    console.log(`   安装点名称: ${deviceLocation.installation_site}`);
    console.log('');
  });
}

/**
 * 测试设备ID解析
 */
function testDeviceIdParsing() {
  console.log('🔍 测试设备ID解析...\n');

  const complexDeviceIds = [
    '6815a14f9314d118511807c6_rk2206',
    'product123_node456_sensor',
    'gateway_main_001',
    'simple_device',
    'very_long_product_id_with_many_parts_node_rk2206'
  ];

  complexDeviceIds.forEach((deviceId, index) => {
    const info = parseDeviceInfo(deviceId);
    console.log(`${index + 1}. 设备ID: ${deviceId}`);
    console.log(`   产品ID: ${info.product_id}`);
    console.log(`   节点ID: ${info.node_id}`);
    console.log(`   设备类型: ${info.device_type}`);
    console.log(`   友好名称: ${info.friendly_name}`);
    console.log('');
  });
}

/**
 * 模拟前端显示效果
 */
function simulateFrontendDisplay() {
  console.log('🖥️  模拟前端显示效果...\n');

  const deviceId = '6815a14f9314d118511807c6_rk2206';
  
  console.log('原始设备ID显示:');
  console.log(`❌ 不友好: ${deviceId}`);
  console.log('');
  
  console.log('优化后的显示:');
  console.log(`✅ 友好名称: ${getDeviceShortName(deviceId)}`);
  console.log(`✅ 完整显示: ${getDeviceDisplayName(deviceId)}`);
  console.log('');
  
  console.log('异常记录中的显示:');
  console.log(`设备 ${getDeviceShortName(deviceId)} 检测到温度异常`);
  console.log(`设备 ${getDeviceDisplayName(deviceId)} 已离线 5 分钟`);
  console.log('');
  
  console.log('设备列表中的显示:');
  const devices = [
    '6815a14f9314d118511807c6_rk2206',
    'abc123_sensor',
    'def456_rk2206'
  ];
  
  devices.forEach(id => {
    const info = parseDeviceInfo(id);
    console.log(`📱 ${info.friendly_name} | ${info.device_type} | 在线`);
  });
}

// 运行测试
if (require.main === module) {
  testDeviceRegistry();
  testLocationNaming();
  testDeviceIdParsing();
  simulateFrontendDisplay();
  
  console.log('✅ 设备注册系统测试完成');
  console.log('');
  console.log('💡 主要改进:');
  console.log('- 设备ID: 6815a14f9314d118511807c6_rk2206');
  console.log('- 友好名称: 会生成类似 "龙门滑坡监测站" 的名称');
  console.log('- 显示名称: "龙门滑坡监测站 (807c6_rk)"');
  console.log('- 前端显示更加友好和易读');
}

module.exports = { 
  testDeviceRegistry, 
  testLocationNaming, 
  testDeviceIdParsing, 
  simulateFrontendDisplay 
};
