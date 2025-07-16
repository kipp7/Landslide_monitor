import { create } from "zustand";
import { supabase } from "./supabaseClient";

interface IotData {
  id: number;
  event_time: string;
  temperature: number;
  humidity: number;
  illumination: number;
  acceleration_x?: number;
  acceleration_y?: number;
  acceleration_z?: number;
  gyroscope_x?: number;
  gyroscope_y?: number;
  gyroscope_z?: number;
  device_id?: string;
  [key: string]: string | number | undefined;
}

interface IotDataStore {
  data: IotData[];
  loading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  subscribeToRealtime: () => () => void;
  useMockData: () => void;
}

export const useIotDataStore = create<IotDataStore>((set, get) => ({
  data: [],
  loading: false,
  error: null,

  fetchData: async () => {
    set({ loading: true, error: null });

    try {
      // 检查环境变量
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        throw new Error('Supabase 环境变量未配置');
      }

      const { data, error } = await supabase
        .from("iot_data")
        .select("*")
        .order("event_time", { ascending: false })
        .limit(500);

      if (error) {
        set({ error: `数据库查询失败: ${error.message}`, loading: false });
      } else {
        set({ data: data || [], loading: false });
      }
    } catch (networkError) {
      const errorMessage = networkError instanceof Error
        ? `网络连接失败: ${networkError.message}`
        : '未知网络错误';
      set({ error: errorMessage, loading: false });
    }
  },

  subscribeToRealtime: () => {
    const channel = supabase
      .channel('iot_data_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'iot_data'
        },
        (payload) => {
          const currentData = get().data;

          if (payload.eventType === 'INSERT') {
            // 新数据插入到开头，保持降序
            set({
              data: [payload.new as IotData, ...currentData].slice(0, 500)
            });
          } else if (payload.eventType === 'UPDATE') {
            // 更新现有数据
            const updatedData = currentData.map(item =>
              item.id === payload.new.id ? payload.new as IotData : item
            );
            set({ data: updatedData });
          } else if (payload.eventType === 'DELETE') {
            // 删除数据
            const filteredData = currentData.filter(item =>
              item.id !== payload.old.id
            );
            set({ data: filteredData });
          }
        }
      )
      .subscribe();

    // 返回取消订阅函数
    return () => {
      supabase.removeChannel(channel);
    };
  },

  // 添加模拟数据功能，用于网络问题时的备用方案
  useMockData: () => {
    const mockData: IotData[] = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      event_time: new Date(Date.now() - i * 60000).toISOString(),
      temperature: 20 + Math.random() * 15,
      humidity: 40 + Math.random() * 40,
      illumination: Math.random() * 1000,
      acceleration_x: (Math.random() - 0.5) * 2,
      acceleration_y: (Math.random() - 0.5) * 2,
      acceleration_z: (Math.random() - 0.5) * 2,
      gyroscope_x: (Math.random() - 0.5) * 100,
      gyroscope_y: (Math.random() - 0.5) * 100,
      gyroscope_z: (Math.random() - 0.5) * 100,
      device_id: `device_${Math.floor(i / 10) + 1}`,
    }));

    set({
      data: mockData,
      loading: false,
      error: '使用模拟数据 (网络连接问题)'
    });
  }
}));
