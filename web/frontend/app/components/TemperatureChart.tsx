'use client';

import React, { useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import useTemperature from '../hooks/useTemperature';
import useDeviceNames from '../hooks/useDeviceNames';

const deviceColors = ['#0783FA', '#FF2E2E', '#07D1FA', '#FFD15C', '#20E6A4'];
const areaColors = [
  { from: 'rgba(7, 131, 250, 0.3)', to: 'rgba(7, 131, 250, 0)' },
  { from: 'rgba(255, 46, 46, 0.3)', to: 'rgba(255, 46, 46, 0)' },
  { from: 'rgba(7, 209, 250, 0.3)', to: 'rgba(7, 209, 250, 0)' },
  { from: 'rgba(255, 209, 92, 0.3)', to: 'rgba(255, 209, 92, 0)' },
  { from: 'rgba(32, 230, 164, 0.3)', to: 'rgba(32, 230, 164, 0)' },
];

export default function TemperatureChart() {
  const chartRef = useRef<ReactECharts | null>(null);
  const { data, loading, error } = useTemperature();
  const { getFriendlyName } = useDeviceNames();

  const isEmpty = !data || Object.keys(data).length === 0;

  if (loading) return <div className="text-white text-sm">加载中...</div>;
  if (error) return <div className="text-red-500 text-sm">加载失败: {error.message}</div>;
  if (isEmpty) return <div className="text-white text-sm">暂无数据</div>;

  const deviceKeys = Object.keys(data);

  const xLabels = data[deviceKeys[0]].map((d: { time: string; value: number }) =>
    new Date(d.time).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  );

  const series = deviceKeys.map((key, index) => ({
    name: getFriendlyName(key),
    type: 'line' as const,
    smooth: true,
    showSymbol: false,
    data: data[key].map((d: { time: string; value: number }) => d.value),
    lineStyle: {
      width: 1.5,
      shadowColor: deviceColors[index % deviceColors.length],
      shadowBlur: 8,
    },
    areaStyle: {
      opacity: 0.4,
      color: {
        type: 'linear' as const,
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [
          { offset: 0, color: areaColors[index % areaColors.length].from },
          { offset: 1, color: areaColors[index % areaColors.length].to },
        ],
      },
    },
  }));

  const option = {
    backgroundColor: 'transparent',
    color: deviceColors,
    animationDuration: 1000,
    animationEasing: 'cubicOut' as const,
    legend: {
      icon: 'circle',
      itemWidth: 15,
      itemHeight: 20,
      left: 30,
      type: 'scroll',
      orient: 'horizontal' as const,
      top: '0%',
      textStyle: { color: '#94A7BD' },
      pageIconColor: '#0891b2',
      pageTextStyle: { color: '#ffffff', fontWeight: 'bold' as const },
    },
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#1b263b',
      borderColor: '#20E6A4',
      textStyle: { color: '#fff' },
      position: function (point: number[], params: unknown, dom: any, rect: unknown, size: { contentSize: number[]; viewSize: number[] }) {
        if (!dom) return [point[0] + 10, point[1] - 10];
        const tooltipWidth = size.contentSize[0];
        const tooltipHeight = size.contentSize[1];
        const chartWidth = size.viewSize[0];
        let x = point[0] + 10;
        let y = point[1] - tooltipHeight - 10;

        if (x + tooltipWidth > chartWidth) x = point[0] - tooltipWidth - 10;
        if (y < 0) y = point[1] + 10;
        return [x, y];
      },
    },
    grid: {
      left: '0%',
      right: '0%',
      bottom: '8%',
      top: '25%',
      containLabel: true,
    },
    dataZoom: [
      {
        type: 'inside',
        start: 90,
        end: 100,
      },
      {
        type: 'slider',
        show: true,
        start: 90,
        end: 100,
        height: 8,
        bottom: 6,
        borderColor: 'transparent',
        backgroundColor: 'transparent',
        fillerColor: 'rgba(32,230,164,0.2)',
        handleStyle: {
          color: '#20E6A4',
          shadowColor: '#20E6A4',
          shadowBlur: 6,
        },
        textStyle: {
          color: '#94A7BD',
        },
      },
    ],
    xAxis: {
      type: 'category' as const,
      data: xLabels,
      axisLine: { lineStyle: { color: '#94A7BD' } },
      axisLabel: { color: '#94A7BD' },
    },
    yAxis: {
      type: 'value' as const,
      nameTextStyle: { color: '#94A7BD', padding: [0, 0, 0, -20] },
      axisLine: { lineStyle: { color: '#94A7BD' } },
      splitLine: {
        lineStyle: {
          color: '#182D46',
          type: 'dashed' as const,
        },
      },
      axisLabel: { color: '#94A7BD' },
    },
    series,
  };

  return <ReactECharts ref={chartRef} option={option} style={{ height: '100%', width: '100%' }} />;
}
