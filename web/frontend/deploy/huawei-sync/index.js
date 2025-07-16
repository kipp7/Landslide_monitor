const axios = require('axios');
const { Client } = require('pg');
const redis = require('redis');
const cron = require('node-cron');
const winston = require('winston');
require('dotenv').config();

// 日志配置
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console()
  ]
});

// 数据库连接
const dbClient = new Client({
  connectionString: process.env.DATABASE_URL
});

// Redis 连接
const redisClient = redis.createClient({
  url: process.env.REDIS_URL
});

// 华为云IoT配置
const huaweiConfig = {
  endpoint: process.env.HUAWEI_IOT_ENDPOINT,
  appId: process.env.HUAWEI_IOT_APP_ID,
  secret: process.env.HUAWEI_IOT_SECRET
};

class HuaweiIoTSync {
  constructor() {
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // 获取华为云访问令牌
  async getAccessToken() {
    try {
      if (this.accessToken && this.tokenExpiry > Date.now()) {
        return this.accessToken;
      }

      const response = await axios.post(`${huaweiConfig.endpoint}/v5/iot/auth/token`, {
        appId: huaweiConfig.appId,
        secret: huaweiConfig.secret
      });

      this.accessToken = response.data.accessToken;
      this.tokenExpiry = Date.now() + (response.data.expiresIn * 1000) - 60000; // 提前1分钟刷新

      logger.info('华为云访问令牌获取成功');
      return this.accessToken;
    } catch (error) {
      logger.error('获取华为云访问令牌失败:', error.message);
      throw error;
    }
  }

  // 获取设备数据
  async getDeviceData() {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${huaweiConfig.endpoint}/v5/iot/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          limit: 1000,
          marker: 0
        }
      });

      return response.data.devices || [];
    } catch (error) {
      logger.error('获取设备数据失败:', error.message);
      throw error;
    }
  }

  // 获取设备历史数据
  async getDeviceHistoryData(deviceId, startTime, endTime) {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.get(`${huaweiConfig.endpoint}/v5/iot/devices/${deviceId}/history-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          startTime,
          endTime,
          limit: 1000
        }
      });

      return response.data.data || [];
    } catch (error) {
      logger.error(`获取设备${deviceId}历史数据失败:`, error.message);
      return [];
    }
  }

  // 同步数据到本地数据库
  async syncDataToDatabase(devices) {
    const client = await dbClient.connect();
    
    try {
      await client.query('BEGIN');

      for (const device of devices) {
        // 插入或更新设备信息
        await client.query(`
          INSERT INTO devices (device_id, device_name, status, last_active_time)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (device_id) 
          DO UPDATE SET 
            device_name = EXCLUDED.device_name,
            status = EXCLUDED.status,
            last_active_time = EXCLUDED.last_active_time
        `, [device.deviceId, device.deviceName, device.status, new Date()]);

        // 获取并插入传感器数据
        if (device.services) {
          for (const service of device.services) {
            if (service.properties) {
              await client.query(`
                INSERT INTO iot_data (
                  device_id, event_time, temperature, humidity, illumination,
                  acceleration_x, acceleration_y, acceleration_z,
                  gyroscope_x, gyroscope_y, gyroscope_z
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (device_id, event_time) DO NOTHING
              `, [
                device.deviceId,
                new Date(),
                service.properties.temperature || null,
                service.properties.humidity || null,
                service.properties.illumination || null,
                service.properties.acceleration_x || null,
                service.properties.acceleration_y || null,
                service.properties.acceleration_z || null,
                service.properties.gyroscope_x || null,
                service.properties.gyroscope_y || null,
                service.properties.gyroscope_z || null
              ]);
            }
          }
        }
      }

      await client.query('COMMIT');
      logger.info(`成功同步 ${devices.length} 个设备的数据`);
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('数据同步失败:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  // 主同步方法
  async sync() {
    try {
      logger.info('开始同步华为云IoT数据...');
      
      const devices = await this.getDeviceData();
      if (devices.length > 0) {
        await this.syncDataToDatabase(devices);
        
        // 更新Redis缓存
        await redisClient.setEx('last_sync_time', 3600, new Date().toISOString());
        await redisClient.setEx('device_count', 3600, devices.length.toString());
      }
      
      logger.info('华为云IoT数据同步完成');
    } catch (error) {
      logger.error('数据同步过程中发生错误:', error.message);
    }
  }
}

// 初始化服务
async function init() {
  try {
    await dbClient.connect();
    await redisClient.connect();
    
    logger.info('华为云IoT同步服务启动成功');
    
    const syncService = new HuaweiIoTSync();
    
    // 立即执行一次同步
    await syncService.sync();
    
    // 设置定时任务：每5分钟同步一次
    cron.schedule('*/5 * * * *', async () => {
      await syncService.sync();
    });
    
    // 设置定时任务：每小时清理旧数据
    cron.schedule('0 * * * *', async () => {
      try {
        const result = await dbClient.query(`
          DELETE FROM iot_data 
          WHERE event_time < NOW() - INTERVAL '30 days'
        `);
        logger.info(`清理了 ${result.rowCount} 条过期数据`);
      } catch (error) {
        logger.error('清理过期数据失败:', error.message);
      }
    });
    
  } catch (error) {
    logger.error('服务初始化失败:', error.message);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭服务...');
  await dbClient.end();
  await redisClient.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，正在关闭服务...');
  await dbClient.end();
  await redisClient.quit();
  process.exit(0);
});

// 启动服务
init();
