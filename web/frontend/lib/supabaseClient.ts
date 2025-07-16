import { createClient } from '@supabase/supabase-js'

// 检查是否使用本地数据库
const useLocalDatabase = process.env.NEXT_PUBLIC_USE_LOCAL_DB === 'true';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!useLocalDatabase && (!supabaseUrl || !supabaseAnonKey)) {
  console.error('Supabase 环境变量缺失:', {
    url: !!supabaseUrl,
    key: !!supabaseAnonKey
  });
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// 本地API端点
export const LOCAL_API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:8080/api'
