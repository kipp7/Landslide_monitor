'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Table } from 'antd';
import useRealtimeAnomalies from '../hooks/useRealtimeAnomalies';

const RealtimeAnomalyTable = () => {
  const { data } = useRealtimeAnomalies(30);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [visibleData, setVisibleData] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageSize = 5;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isHoveredRef = useRef(false);

  // Scroll step to control how much we move on each scroll
  const scrollStep = 1; // Control the step of scroll (1 is a single row)

  // Auto scroll setup
  useEffect(() => {
    const startAutoScroll = () => {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(() => {
          if (!isHoveredRef.current) {
            setScrollIndex((prev) => (prev + 1) % Math.max(1, data.length - pageSize + 1));
          }
        }, 2000); // Scroll every 2 seconds
      }
    };

    startAutoScroll(); // Start the scroll on mount

    // Cleanup the interval when component unmounts
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [data.length]);

  useEffect(() => {
    setVisibleData(data.slice(scrollIndex, scrollIndex + pageSize));
  }, [scrollIndex, data]);

  // Mouse hover event handling for stopping auto scroll
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseEnter = () => {
      isHoveredRef.current = true;
    };

    const handleMouseLeave = () => {
      isHoveredRef.current = false;
    };

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Handle wheel scroll to change scrollIndex with limited sensitivity
  const handleWheel = (e: React.WheelEvent<HTMLElement>) => {
    // Control the scroll increment for less sensitivity
    const isScrollDown = e.deltaY > 0;
    if (isScrollDown) {
      setScrollIndex((prev) => (prev + scrollStep) % Math.max(1, data.length - pageSize + 1));
    } else {
      setScrollIndex((prev) => (prev - scrollStep + Math.max(1, data.length - pageSize + 1)) % Math.max(1, data.length - pageSize + 1));
    }
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'event_time',
      key: 'event_time',
      align: 'center' as const,
      render: (text: string) => <span className="text-cyan-300">{new Date(text).toLocaleString()}</span>,
    },
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      align: 'center' as const,
      render: (text: string) => <span className="text-cyan-300">{text}</span>,
    },
    {
      title: '异常类型',
      dataIndex: 'anomaly_type',
      key: 'anomaly_type',
      align: 'center' as const,
      render: (text: string) => <span className="text-cyan-300">{text}</span>,
    },
    {
      title: '异常值',
      dataIndex: 'value',
      key: 'value',
      align: 'center' as const,
      render: (val: number) => <span className="text-red-500 font-bold">{val}</span>,
    },
  ];

  return (
    <div
      className="h-full bg-[#0d1b2a] p-2 overflow-auto rounded-xl"
      ref={containerRef}
      onWheel={handleWheel} // Handle the wheel scroll to go through data
      style={{ height: '500px', overflow: 'hidden', marginTop: '2     0px', width: '100%' }} // Adjust height to control the table length
    >
      <style>
        {`
        .ant-table-thead > tr > th {
          background-color: #0d1b2a !important;
          color: #00ffff !important;
          border-color: rgba(13, 114, 127, 0.6) !important;
          font-weight: bold;
          text-align: center;
        }

        .ant-table-tbody > tr:hover > td {
          background: #112c42 !important;
          transition: background 0.3s;
        }

        .ant-table-thead > tr > th,
        .ant-table-tbody > tr > td {
          border-right: 1px solid #173b57 !important;
          border-left: none !important;
        }

        .ant-table-thead > tr > th:last-child,
        .ant-table-tbody > tr > td:last-child {
          border-right: none !important;
        }

        .ant-table td, .ant-table th {
          border-color: rgba(13, 114, 127, 0.6) !important;
        }

        .ant-table-wrapper,
        .ant-table,
        .ant-table-container {
          border-radius: 0 !important;
          overflow: hidden !important;
          background-color: transparent !important;
        }

        /* 这里控制每一行的高度 */
        .ant-table-tbody > tr > td {
          height: 0px; /* 修改此值来调整每行的高度 */
        }

        /* ✅ 禁止滚动条显示 */
        .ant-table-body {
          overflow: hidden !important;
        }

        /* 强制隐藏滚动条 */
        .ant-table-wrapper::-webkit-scrollbar {
          display: none;
        }
        `}
      </style>

      <Table
        dataSource={visibleData.map((item) => ({ key: item.id, ...item }))}
        columns={columns}
        pagination={false}
        size="small"
        className="border-3 border-cyan-950 rounded-sm"
        rowClassName={() =>
          'border-b-2 border border-cyan-300 bg-[#0d1b2a] hover:bg-[#112c42] text-white border-b border-[#0cf]'
        }
      />
    </div>
  );
};

export default RealtimeAnomalyTable;
