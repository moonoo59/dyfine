import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase URL and Anon Key are required environment variables.');
}

/**
 * 프론트엔드 전용 Supabase 클라이언트 싱글톤 인스턴스
 * (RLS 제어를 받기 위한 익명키 기반 연결)
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
