// 本地数据库客户端
import { LOCAL_API_BASE } from './supabaseClient';

interface IotData {
  id: number;
  event_time: string;
  temperature: number;
  humidity: number;
  illumination: number;
  acceleration_x?: number;
  acceleration_y?: number;
  acceleration_z?: number;
  acceleration_total?: number;
  gyroscope_x?: number;
  gyroscope_y?: number;
  gyroscope_z?: number;
  gyroscope_total?: number;
  device_id?: string;
  [key: string]: string | number | undefined;
}

interface Device {
  device_id: string;
  device_name: string;
  status: string;
  location_lat?: number;
  location_lng?: number;
  location_name?: string;
  last_active_time: string;
}

interface ApiResponse<T> {
  data: T;
  error?: string;
  count?: number;
}

class LocalDatabaseClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = LOCAL_API_BASE;
  }

  // 通用请求方法
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error('API请求失败:', error);
      return { 
        data: [] as unknown as T, 
        error: error instanceof Error ? error.message : '未知错误' 
      };
    }
  }

  // 获取IoT数据
  async getIotData(options: {
    limit?: number;
    offset?: number;
    deviceId?: string;
    startTime?: string;
    endTime?: string;
  } = {}): Promise<ApiResponse<IotData[]>> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.offset) params.append('offset', options.offset.toString());
    if (options.deviceId) params.append('device_id', options.deviceId);
    if (options.startTime) params.append('start_time', options.startTime);
    if (options.endTime) params.append('end_time', options.endTime);

    const queryString = params.toString();
    const endpoint = `/iot-data${queryString ? `?${queryString}` : ''}`;
    
    return this.request<IotData[]>(endpoint);
  }

  // 获取设备列表
  async getDevices(): Promise<ApiResponse<Device[]>> {
    return this.request<Device[]>('/devices');
  }

  // 获取设备状态概览
  async getDeviceStatusOverview(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('/devices/status-overview');
  }

  // 发送设备命令
  async sendDeviceCommand(deviceId: string, command: {
    command_type: string;
    command_data: any;
  }): Promise<ApiResponse<any>> {
    return this.request<any>(`/devices/${deviceId}/commands`, {
      method: 'POST',
      body: JSON.stringify(command),
    });
  }

  // 获取设备命令历史
  async getDeviceCommands(deviceId: string): Promise<ApiResponse<any[]>> {
    return this.request<any[]>(`/devices/${deviceId}/commands`);
  }

  // 获取告警信息
  async getAlerts(options: {
    limit?: number;
    status?: string;
    deviceId?: string;
  } = {}): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.status) params.append('status', options.status);
    if (options.deviceId) params.append('device_id', options.deviceId);

    const queryString = params.toString();
    const endpoint = `/alerts${queryString ? `?${queryString}` : ''}`;
    
    return this.request<any[]>(endpoint);
  }

  // 创建告警
  async createAlert(alert: {
    device_id: string;
    alert_type: string;
    alert_level: string;
    message: string;
    threshold_value?: number;
    actual_value?: number;
  }): Promise<ApiResponse<any>> {
    return this.request<any>('/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    });
  }

  // 确认告警
  async acknowledgeAlert(alertId: number, acknowledgedBy: string): Promise<ApiResponse<any>> {
    return this.request<any>(`/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged_by: acknowledgedBy }),
    });
  }

  // 获取统计数据
  async getStatistics(): Promise<ApiResponse<{
    total_devices: number;
    online_devices: number;
    active_alerts: number;
    data_points_today: number;
  }>> {
    return this.request<any>('/statistics');
  }

  // 实时数据订阅（WebSocket）
  subscribeToRealtime(callback: (data: IotData) => void): () => void {
    const wsUrl = this.baseUrl.replace('http', 'ws') + '/ws/realtime';
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        callback(data);
      } catch (error) {
        console.error('WebSocket消息解析失败:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket连接错误:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
    };

    // 返回取消订阅函数
    return () => {
      ws.close();
    };
  }
}

export const localDbClient = new LocalDatabaseClient();
export default localDbClient;
