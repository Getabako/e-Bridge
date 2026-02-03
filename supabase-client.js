// supabase-client.js - Supabase クライアント初期化

const SUPABASE_URL = 'https://gbxtarqfynmimphzoftj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieHRhcnFmeW5taW1waHpvZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM2MjMsImV4cCI6MjA4NDQxOTYyM30.9RmoU4xbS8rqVlQ00oecxKSzaNBzNP2-r2LMqE14Oz0';

// Supabase接続状態フラグ
window.supabaseConnectionError = false;

// Supabaseクライアントを初期化
function initSupabaseClient() {
  try {
    // Supabase SDK v2 CDN版の様々なアクセス方法を試す
    let createClient = null;

    if (window.supabase && typeof window.supabase.createClient === 'function') {
      createClient = window.supabase.createClient;
      console.log('Using window.supabase.createClient');
    } else if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      createClient = supabase.createClient;
      console.log('Using supabase.createClient');
    } else if (window.Supabase && typeof window.Supabase.createClient === 'function') {
      createClient = window.Supabase.createClient;
      console.log('Using window.Supabase.createClient');
    }

    if (createClient) {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false, // 接続エラー時のリトライを防ぐ
          persistSession: true,
          detectSessionInUrl: true
        }
      });
      window.supabaseClient = client;
      console.log('Supabase client initialized successfully');

      // 接続テスト（タイムアウト付き）
      testSupabaseConnection(client);

      return client;
    } else {
      console.error('Supabase SDK not found. Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('supa')));
      window.supabaseConnectionError = true;
      return null;
    }
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    window.supabaseConnectionError = true;
    return null;
  }
}

// Supabase接続をテスト（タイムアウト付き）
async function testSupabaseConnection(client) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒タイムアウト

    const { data, error } = await Promise.race([
      client.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);

    clearTimeout(timeoutId);

    if (error) {
      console.warn('Supabase connection test failed:', error.message);
      window.supabaseConnectionError = true;
    } else {
      console.log('Supabase connection OK');
      window.supabaseConnectionError = false;
    }
  } catch (error) {
    console.warn('Supabase connection unavailable:', error.message);
    window.supabaseConnectionError = true;
  }
}

// 即座に初期化を試みる
const supabaseClient = initSupabaseClient();

// DOMContentLoadedでも再試行
if (!supabaseClient) {
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.supabaseClient) {
      console.log('Retrying Supabase initialization on DOMContentLoaded...');
      initSupabaseClient();
    }
  });
}
