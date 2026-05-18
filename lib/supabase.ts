import { createClient } from '@supabase/supabase-js';

// 先ほど .env.local に書いたURLとキーを読み込む
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// どこからでも使えるように export する
export const supabase = createClient(supabaseUrl, supabaseAnonKey);