// supabase-client.js - Supabase クライアント初期化

const SUPABASE_URL = 'https://gbxtarqfynmimphzoftj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdieHRhcnFmeW5taW1waHpvZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM2MjMsImV4cCI6MjA4NDQxOTYyM30.9RmoU4xbS8rqVlQ00oecxKSzaNBzNP2-r2LMqE14Oz0';

// Supabaseクライアントを初期化
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// グローバルに公開
window.supabaseClient = supabase;

console.log('Supabase client initialized');
