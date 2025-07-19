const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://sdssoyyjhunltmcjoxtg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkc3NveXlqaHVubHRtY2pveHRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0MzY3NTIsImV4cCI6MjA1NzAxMjc1Mn0.FisL8HivC_g-cnq4o7BNqHQ8vKDUpgfW3lUINfDXMSA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testDeviceListAPI() {
  console.log('🧪 测试设备列表API...\n');

  try {
    // 1. 直接查询数据库
    console.log('1️⃣ 直接查询数据库:');
    const { data: devices, error } = await supabase
      .from('iot_devices')
      .select('device_id, friendly_name, last_active')
      .order('device_id');

    if (error) {
      console.error('❌ 数据库查询失败:', error);
      return;
    }

    console.log('数据库结果:', devices);

    // 2. 处理数据
    console.log('\n2️⃣ 处理数据:');
    const now = new Date();
    const deviceList = devices.map(device => {
      const lastActive = new Date(device.last_active);
      const diffMinutes = Math.floor((now.getTime() - lastActive.getTime()) / 60000);
      
      return {
        device_id: device.device_id,
        friendly_name: device.friendly_name,
        display_name: device.friendly_name === '后山监测设备' ? '龙门滑坡监测站' : device.friendly_name,
        location_name: '防城港华石镇龙门村',
        device_type: 'rk2206',
        status: diffMinutes > 5 ? 'offline' : 'online',
        last_active: device.last_active
      };
    });

    console.log('处理后的结果:', JSON.stringify(deviceList, null, 2));

    // 3. 测试API调用
    console.log('\n3️⃣ 测试API调用:');
    try {
      const response = await fetch('http://localhost:5100/devices/list');
      const result = await response.json();
      console.log('API响应:', JSON.stringify(result, null, 2));
    } catch (apiError) {
      console.error('❌ API调用失败:', apiError.message);
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }
}

testDeviceListAPI();
