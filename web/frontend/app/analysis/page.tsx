'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { Spin, Alert } from 'antd';
import BaseCard from '../components/BaseCard';
import MapSwitchPanel from '../components/MapSwitchPanel';
import HoverSidebar from '../components/HoverSidebar';
import useRealtimeData from '../hooks/useRealtimeData';
import usePerformanceMonitor from '../hooks/usePerformanceMonitor';
import useDeviceNames from '../hooks/useDeviceNames';
import { supabase } from '../../lib/supabaseClient';

// 懒加载组件
import {
  LazyTemperatureChart,
  LazyHumidityChart,
  LazyAccelerationChart,
  LazyGyroscopeChart,
  LazyMapContainer,
  LazyMap3DContainer,
  LazyBarChart,
  LazyLiquidFillChart,
  LazyDeviceErrorChart,
  LazyAIPredictionComponent,
  LazyRealtimeAnomalyTable,

} from '../components/LazyComponents';
import { generateDeviceName, getRiskByLocation, getDetailedLocationInfo } from '../utils/location-naming';

export default function AnalysisPage() {
  const [mapType, setMapType] = useState<'2D' | '3D' | '卫星图' | '视频'>('卫星图');
  const [alert, setAlert] = useState(false);
  const [deviceMappings, setDeviceMappings] = useState<any[]>([]);

  // 使用统一的实时数据源
  const { loading, error, deviceStats, data } = useRealtimeData();

  // 获取设备映射信息
  useEffect(() => {
    const fetchDeviceMappings = async () => {
      try {
        const { data: mappings, error } = await supabase
          .from('device_mapping')
          .select('simple_id, device_name, location_name');

        if (!error && mappings) {
          setDeviceMappings(mappings);
        }
      } catch (error) {
        console.error('获取设备映射失败:', error);
      }
    };

    fetchDeviceMappings();
  }, []);

  // 从实时数据中提取设备位置信息 - 大屏页面只显示真实数据
  const getDevicesForMap = useMemo(() => {
    // 大屏页面：如果没有实时数据，返回空数组，不显示假数据
    if (!data || data.length === 0) {
      console.log('大屏模式：没有实时数据，不显示任何监测点');
      return [];
    }

    // 按设备ID分组，获取每个设备的最新数据
    const deviceMap = new Map();
    data.forEach(record => {
      if (record.device_id && record.latitude && record.longitude) {
        const existing = deviceMap.get(record.device_id);
        if (!existing || new Date(record.event_time) > new Date(existing.event_time)) {
          deviceMap.set(record.device_id, record);
        }
      }
    });

    // 只使用有真实坐标数据的设备
    const realDevices = Array.from(deviceMap.values())
      .filter(record => record.latitude && record.longitude) // 必须有真实坐标
      .map((record, index) => {
        const lat = parseFloat(record.latitude);
        const lng = parseFloat(record.longitude);

        // 获取详细的位置信息
        const locationInfo = getDetailedLocationInfo(lat, lng);

        // 从设备映射中获取真实的设备名称，如果没有则使用地名生成
        const mapping = deviceMappings.find(m => m.simple_id === record.device_id);
        const deviceName = mapping?.device_name || mapping?.location_name || generateDeviceName(lat, lng, record.device_id);

        return {
          device_id: record.device_id,
          name: deviceName,
          coord: [lng, lat] as [number, number],
          temp: parseFloat(record.temperature) || 0,
          hum: parseFloat(record.humidity) || 0,
          status: 'online' as const, // 有数据说明在线
          risk: getRiskByLocation(lat, lng), // 根据地理位置计算风险值
          location: locationInfo.description
        };
      });

    console.log('大屏模式：真实监测点数据:', realDevices);
    return realDevices;
  }, [data, deviceMappings]);

  // 计算真实数据的地理中心点 - 使用useMemo避免重复计算
  const mapCenter = useMemo((): [number, number] => {
    if (getDevicesForMap.length === 0) return [110.1805, 22.6263]; // 默认中心点

    const totalLng = getDevicesForMap.reduce((sum, device) => sum + device.coord[0], 0);
    const totalLat = getDevicesForMap.reduce((sum, device) => sum + device.coord[1], 0);

    return [totalLng / getDevicesForMap.length, totalLat / getDevicesForMap.length];
  }, [getDevicesForMap]);

  // 性能监控
  const { warnings, isPerformanceGood } = usePerformanceMonitor();

  const simulatedRiskValue = 0.7; // 示例值，大于 0.7 就触发警报

  useEffect(() => {
    if (simulatedRiskValue > 0.7) {
      setAlert(true);
    } else {
      setAlert(false);
    }
  }, [simulatedRiskValue]);

  // 性能优化：根据性能情况动态调整组件显示
  useEffect(() => {
    if (!isPerformanceGood) {
      console.warn('性能较差，建议减少组件显示');
    }
  }, [isPerformanceGood]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#001529]">
        <Alert
          message="数据加载失败"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-[#001529]">
      {/* 🚀 悬浮菜单栏 */}
      <HoverSidebar />

      {/* 红色警报光晕特效（如果警报） */}
      {alert && (
        <div className="absolute inset-0 pointer-events-none z-50 animate-pulse">
          <div className="absolute top-0 left-0 w-full h-4 bg-red-500 blur-xl opacity-100" />
          <div className="absolute bottom-0 left-0 w-full h-4 bg-red-500 blur-xl opacity-100" />
          <div className="absolute top-0 left-0 w-4 h-full bg-red-500 blur-xl opacity-100" />
          <div className="absolute top-0 right-0 w-4 h-full bg-red-500 blur-xl opacity-100" />
        </div>
      )}

      {/* 顶部标题 + 蓝光条 */}
      <div className="relative w-full flex justify-center items-center py-0 z-10">
        <div className="absolute w-[600px] h-[6px] bg-cyan-400 blur-md opacity-30 rounded-full" />
        <div
          className="text-[35px] font-extrabold text-cyan-300 tracking-[10px] z-10"
          style={{
            textShadow: '0 0 10px rgba(0,255,255,0.7), 0 0 20px rgba(0,255,255,0.4)',
            letterSpacing: '0.25em',
          }}
        >
          山体滑坡数据监测大屏
        </div>
      </div>

      {/* 性能警告 */}
      {warnings.length > 0 && (
        <div className="absolute top-20 right-4 z-50">
          <Alert
            message="性能警告"
            description={warnings.join(', ')}
            type="warning"
            closable
            style={{ maxWidth: '300px' }}
          />
        </div>
      )}

      {/* 数据状态显示 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-40">
          <Spin size="large" />
        </div>
      )}

      {/* 内容区域，占满剩余空间，不可滚动 */}
      <div className="flex-1 overflow-hidden p-2 z-10">
        <div className="grid grid-cols-4 grid-rows-4 gap-2 h-full">
          {/* 左侧图表列 */}
          <div className="col-span-1 row-span-4 h-full flex flex-col gap-2">
            <BaseCard title={`温度趋势图/°C (${deviceStats.deviceCount}设备)`}>
              <Suspense fallback={<Spin />}>
                <LazyTemperatureChart />
              </Suspense>
            </BaseCard>
            <BaseCard title="湿度趋势图/%">
              <Suspense fallback={<Spin />}>
                <LazyHumidityChart />
              </Suspense>
            </BaseCard>
            <BaseCard title="加速度趋势图/mg">
              <Suspense fallback={<Spin />}>
                <LazyAccelerationChart />
              </Suspense>
            </BaseCard>
            <BaseCard title="陀螺仪趋势图/°/s">
              <Suspense fallback={<Spin />}>
                <LazyGyroscopeChart />
              </Suspense>
            </BaseCard>
          </div>

          {/* 中间地图区域 */}
          <div className="col-start-2 col-span-2 row-span-4">
            <BaseCard
              title={`滑坡监测地图与预警 (最新: ${deviceStats.lastUpdateTime ? new Date(deviceStats.lastUpdateTime).toLocaleTimeString() : '无数据'})`}
              extra={<MapSwitchPanel selected={mapType} onSelect={(type) => setMapType(type as '2D' | '3D' | '卫星图' | '视频')} />}
            >
              <div className="h-full flex flex-col gap-2">
                <div className="basis-[65%] min-h-0">
                  <Suspense fallback={<Spin />}>
                    {mapType === '3D' ? (
                      <LazyMap3DContainer />
                    ) : mapType === '视频' ? (
                      <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
                        <img
                          src={`http://192.168.43.55/stream?t=${Date.now()}`}
                          className="max-w-full max-h-full object-contain"
                          alt="ESP32-CAM 实时视频流"
                          onError={(e) => {
                            console.error('ESP32-CAM视频流加载失败');
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('ESP32-CAM视频流加载成功');
                          }}
                        />
                      </div>
                    ) : (
                      getDevicesForMap.length > 0 ? (
                        <LazyMapContainer
                          mode={mapType as '2D' | '卫星图'}
                          devices={getDevicesForMap}
                          // 大屏模式：使用缓存的地理中心点，避免重复计算
                          center={mapCenter}
                          // 设置更大的缩放级别，让定位更精确
                          zoom={16}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                          <div className="text-center text-gray-500">
                            <div className="text-lg font-medium mb-2">暂无监测点数据</div>
                            <div className="text-sm">等待传感器数据上传中...</div>
                          </div>
                        </div>
                      )
                    )}
                  </Suspense>
                </div>
                <div className="basis-[35%] min-h-0 overflow-hidden">
                  <Suspense fallback={<Spin />}>
                    <LazyRealtimeAnomalyTable />
                  </Suspense>
                </div>
              </div>
            </BaseCard>
          </div>

          {/* 右侧功能区域 */}
          <div className="col-start-4 row-start-1">
            <BaseCard title="雨量图/ml">
              <Suspense fallback={<Spin />}>
                <LazyBarChart />
              </Suspense>
            </BaseCard>
          </div>

          <div className="col-start-4 row-span-2 row-start-2">
            <BaseCard title="AI 分析与预测">
              <Suspense fallback={<Spin />}>
                <LazyAIPredictionComponent />
              </Suspense>
            </BaseCard>
          </div>

          <div className="col-start-4 row-start-4">
            <BaseCard title="设备异常情况与滑坡概率">
              <div className="flex flex-row items-center justify-between h-full w-full">
                <div className="w-1/2 h-full">
                  <Suspense fallback={<Spin />}>
                    <LazyDeviceErrorChart />
                  </Suspense>
                </div>
                <div className="w-1/2 h-full">
                  <Suspense fallback={<Spin />}>
                    <LazyLiquidFillChart />
                  </Suspense>
                </div>
              </div>
            </BaseCard>
          </div>
        </div>
      </div>
    </div>
  );
}
