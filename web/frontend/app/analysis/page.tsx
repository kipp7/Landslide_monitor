'use client';

import { useEffect, useState, Suspense } from 'react';
import { Spin, Alert } from 'antd';
import BaseCard from '../components/BaseCard';
import MapSwitchPanel from '../components/MapSwitchPanel';
import HoverSidebar from '../components/HoverSidebar';
import useRealtimeData from '../hooks/useRealtimeData';
import usePerformanceMonitor from '../hooks/usePerformanceMonitor';

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

export default function AnalysisPage() {
  const [mapType, setMapType] = useState<'2D' | '3D' | '卫星图' | '视频'>('卫星图');
  const [alert, setAlert] = useState(false);

  // 使用统一的实时数据源
  const { loading, error, deviceStats } = useRealtimeData();

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
                      <div className="text-white text-center">视频功能开发中...</div>
                    ) : (
                      <LazyMapContainer mode={mapType as '2D' | '卫星图'} />
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
