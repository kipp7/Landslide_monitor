const axios = require('axios');

/**
 * 华为云IoT服务类
 * 提供身份鉴权、设备影子查询、命令下发等功能
 */
class HuaweiIoTService {
  constructor(config = {}) {
    // 华为云IoT配置参数
    this.config = {
      // IAM认证相关 - 根据官方文档，推荐使用全局端点
      iamEndpoint: config.iamEndpoint || process.env.HUAWEI_IAM_ENDPOINT || 'https://iam.myhuaweicloud.com',

      // IoT平台相关
      iotEndpoint: config.iotEndpoint || process.env.HUAWEI_IOT_ENDPOINT || 'https://iotda.cn-north-4.myhuaweicloud.com',
      projectId: config.projectId || process.env.HUAWEI_PROJECT_ID,
      projectName: config.projectName || process.env.HUAWEI_PROJECT_NAME || 'cn-north-4',

      // 认证信息
      domainName: config.domainName || process.env.HUAWEI_DOMAIN_NAME,
      iamUsername: config.iamUsername || process.env.HUAWEI_IAM_USERNAME,
      iamPassword: config.iamPassword || process.env.HUAWEI_IAM_PASSWORD,

      // 设备信息
      deviceId: config.deviceId || process.env.HUAWEI_DEVICE_ID || '6815a14f9314d118511807c6_rk2206',
      productId: config.productId || process.env.HUAWEI_PRODUCT_ID,

      ...config
    };

    // 缓存的token
    this.cachedToken = null;
    this.tokenExpireTime = null;
    
    console.log('🔧 华为云IoT服务初始化完成');
    console.log('📍 IoT端点:', this.config.iotEndpoint);
    console.log('📱 设备ID:', this.config.deviceId);
  }

  /**
   * 获取IAM Token (project-scoped)
   * @returns {Promise<string>} 返回token
   */
  async getToken() {
    try {
      // 检查缓存的token是否还有效（提前5分钟刷新）
      if (this.cachedToken && this.tokenExpireTime &&
          Date.now() < this.tokenExpireTime - 5 * 60 * 1000) {
        console.log('🔑 使用缓存的token');
        return this.cachedToken;
      }

      console.log('🔑 获取新的IAM token...');

      const authUrl = `${this.config.iamEndpoint}/v3/auth/tokens`;

      // 按照官方文档格式构建认证数据
      const authData = {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                domain: {
                  name: this.config.domainName  // IAM用户所属帐号名
                },
                name: this.config.iamUsername,     // IAM用户名
                password: this.config.iamPassword  // IAM用户密码
              }
            }
          },
          scope: {
            project: {
              name: this.config.projectName  // 使用项目名称，如 "cn-north-4"
            }
          }
        }
      };

      const response = await axios.post(authUrl, authData, {
        headers: {
          'Content-Type': 'application/json;charset=utf8'  // 按照官方文档格式
        },
        timeout: 15000
      });

      if (response.status === 201) {
        const token = response.headers['x-subject-token'];
        if (!token) {
          throw new Error('未能从响应头中获取到token');
        }

        // 缓存token（默认24小时有效期）
        this.cachedToken = token;
        this.tokenExpireTime = Date.now() + 24 * 60 * 60 * 1000;

        // 从响应中获取实际的项目ID
        if (response.data && response.data.token && response.data.token.project) {
          this.config.projectId = response.data.token.project.id;
          console.log('✅ 从token响应中获取项目ID:', this.config.projectId);
        }

        console.log('✅ IAM token获取成功');
        return token;
      } else {
        throw new Error(`认证失败，状态码: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ 获取IAM token失败:', error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', error.response.data);
      }
      throw new Error(`IAM认证失败: ${error.message}`);
    }
  }

  /**
   * 获取项目ID
   * @returns {Promise<string>} 返回项目ID
   */
  async getProjectId() {
    try {
      console.log('🔍 获取项目ID...');

      // 先获取domain-scoped token
      const authUrl = `${this.config.iamEndpoint}/v3/auth/tokens`;
      const domainAuthData = {
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: this.config.iamUsername,
                password: this.config.iamPassword,
                domain: {
                  name: this.config.domainName
                }
              }
            }
          },
          scope: {
            domain: {
              name: this.config.domainName
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

      // 获取项目列表
      const projectsUrl = `${this.config.iamEndpoint}/v3/auth/projects`;
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
      const cnNorth4Project = projects.find(p => p.name === 'cn-north-4');

      if (!cnNorth4Project) {
        throw new Error('未找到cn-north-4项目');
      }

      this.config.projectId = cnNorth4Project.id;
      console.log('✅ 项目ID获取成功:', this.config.projectId);

      return this.config.projectId;
    } catch (error) {
      console.error('❌ 获取项目ID失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取设备影子信息
   * @param {string} deviceId 设备ID，可选，默认使用配置中的设备ID
   * @returns {Promise<Object>} 设备影子数据
   */
  async getDeviceShadow(deviceId = null) {
    try {
      const targetDeviceId = deviceId || this.config.deviceId;
      console.log(`🔍 获取设备影子信息: ${targetDeviceId}`);
      
      const token = await this.getToken();
      const shadowUrl = `${this.config.iotEndpoint}/v5/iot/${this.config.projectId}/devices/${targetDeviceId}/shadow`;
      
      const response = await axios.get(shadowUrl, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 10000
      });

      if (response.status === 200) {
        console.log('✅ 设备影子获取成功');
        return response.data;
      } else {
        throw new Error(`获取设备影子失败，状态码: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ 获取设备影子失败:', error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', error.response.data);
      }
      throw new Error(`获取设备影子失败: ${error.message}`);
    }
  }

  /**
   * 向设备下发命令
   * @param {Object} commandData 命令数据
   * @param {string} commandData.service_id 服务ID
   * @param {string} commandData.command_name 命令名称
   * @param {Object} commandData.paras 命令参数
   * @param {string} deviceId 设备ID，可选，默认使用配置中的设备ID
   * @returns {Promise<Object>} 命令执行结果
   */
  async sendCommand(commandData, deviceId = null) {
    try {
      const targetDeviceId = deviceId || this.config.deviceId;
      console.log(`📤 向设备发送命令: ${targetDeviceId}`);
      console.log('命令数据:', JSON.stringify(commandData, null, 2));
      
      const token = await this.getToken();
      const commandUrl = `${this.config.iotEndpoint}/v5/iot/${this.config.projectId}/devices/${targetDeviceId}/commands`;
      
      const response = await axios.post(commandUrl, commandData, {
        headers: {
          'Content-Type': 'application/json',
          'X-Auth-Token': token
        },
        timeout: 25000  // 华为云IoT平台超时时间是20秒，我们设置25秒
      });

      if (response.status === 200 || response.status === 201) {
        console.log('✅ 命令下发成功');
        console.log('响应数据:', JSON.stringify(response.data, null, 2));
        return response.data;
      } else {
        throw new Error(`命令下发失败，状态码: ${response.status}`);
      }
    } catch (error) {
      console.error('❌ 命令下发失败:', error.message);
      if (error.response) {
        console.error('响应状态:', error.response.status);
        console.error('响应数据:', error.response.data);
      }
      throw new Error(`命令下发失败: ${error.message}`);
    }
  }

  /**
   * 预定义的命令模板（基于实际设备支持的命令）
   */
  getCommandTemplates() {
    return {
      // 电机控制命令
      motorControl: (enable = false, speed = 100, direction = 1, duration = 5) => ({
        service_id: 'smartHome',
        command_name: 'control_motor',
        paras: {
          enable: enable,      // 是否启用电机
          speed: speed,        // 速度 (0-255)
          direction: direction, // 方向 (1=正转, -1=反转)
          duration: duration   // 持续时间 (秒)
        }
      }),

      // 蜂鸣器控制命令
      buzzerControl: (enable = false, frequency = 1000, duration = 2000, pattern = 1) => ({
        service_id: 'smartHome',
        command_name: 'control_buzzer',
        paras: {
          enable: enable,      // 是否启用蜂鸣器
          frequency: frequency, // 频率 (Hz)
          duration: duration,  // 持续时间 (毫秒)
          pattern: pattern     // 模式 (1=连续, 2=间断, 3=快速)
        }
      }),

      // 电机启动快捷命令
      motorStart: (speed = 100, direction = 1, duration = 5) => ({
        service_id: 'smartHome',
        command_name: 'control_motor',
        paras: {
          enable: true,
          speed: speed,
          direction: direction,
          duration: duration
        }
      }),

      // 电机停止快捷命令
      motorStop: () => ({
        service_id: 'smartHome',
        command_name: 'control_motor',
        paras: {
          enable: false,
          speed: 0,
          direction: 1,
          duration: 0
        }
      }),

      // 蜂鸣器报警快捷命令
      buzzerAlarm: (duration = 3000) => ({
        service_id: 'smartHome',
        command_name: 'control_buzzer',
        paras: {
          enable: true,
          frequency: 2000,  // 高频报警音
          duration: duration,
          pattern: 2        // 间断模式
        }
      }),

      // 蜂鸣器停止快捷命令
      buzzerStop: () => ({
        service_id: 'smartHome',
        command_name: 'control_buzzer',
        paras: {
          enable: false,
          frequency: 0,
          duration: 0,
          pattern: 1
        }
      }),

      // 系统测试命令 - 电机和蜂鸣器测试
      systemTest: () => ({
        service_id: 'smartHome',
        command_name: 'control_buzzer',
        paras: {
          enable: true,
          frequency: 1000,
          duration: 1000,
          pattern: 1
        }
      })
    };
  }

  /**
   * 检查配置是否完整
   * @returns {Object} 检查结果
   */
  checkConfig() {
    const required = ['projectId', 'domainName', 'iamUsername', 'iamPassword', 'deviceId'];
    const missing = required.filter(key => !this.config[key]);
    
    return {
      isValid: missing.length === 0,
      missing: missing,
      config: {
        iamEndpoint: this.config.iamEndpoint,
        iotEndpoint: this.config.iotEndpoint,
        projectId: this.config.projectId ? '已配置' : '未配置',
        domainName: this.config.domainName ? '已配置' : '未配置',
        iamUsername: this.config.iamUsername ? '已配置' : '未配置',
        iamPassword: this.config.iamPassword ? '已配置' : '未配置',
        deviceId: this.config.deviceId || '未配置'
      }
    };
  }
}

module.exports = HuaweiIoTService;
