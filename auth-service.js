// auth-service.js - Supabase認証サービス

class AuthService {
  constructor() {
    this.currentUser = null;
    this.currentProfile = null;
    this.isGuest = false;
    this.guestData = {};
    this.supabase = null;
    this.initialized = false;
  }

  // Supabaseクライアントを初期化
  async init() {
    if (this.initialized) return;

    // window.supabaseClientが利用可能になるまで待機
    if (window.supabaseClient) {
      this.supabase = window.supabaseClient;
      this.initialized = true;

      // 既存セッションをチェック
      await this.checkSession();
    } else {
      console.warn('Supabase client not available yet');
    }
  }

  // 既存セッションをチェック
  async checkSession() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (session && session.user) {
        this.currentUser = session.user;
        await this.loadProfile();
        console.log('Session restored for:', this.currentUser.email);
      }
    } catch (error) {
      console.error('Session check error:', error);
    }
  }

  // プロフィールを読み込み
  async loadProfile() {
    if (!this.currentUser) return null;

    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error) {
        console.error('Profile load error:', error);
        return null;
      }

      this.currentProfile = data;
      return data;
    } catch (error) {
      console.error('Profile load error:', error);
      return null;
    }
  }

  // ユーザー登録
  async register(username, password, email, riotId = null) {
    if (!this.supabase) {
      return { success: false, message: 'データベースに接続できません' };
    }

    // Riot IDをパース
    let riotIdName = null;
    let riotIdTag = null;
    if (riotId) {
      const parts = riotId.split('#');
      if (parts.length === 2) {
        riotIdName = parts[0].trim();
        riotIdTag = parts[1].trim();
      }
    }

    try {
      // Supabase Authでユーザー登録
      const { data, error } = await this.supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username,
            riot_id_name: riotIdName,
            riot_id_tag: riotIdTag
          }
        }
      });

      if (error) {
        console.error('Registration error:', error);
        if (error.message.includes('already registered')) {
          return { success: false, message: 'このメールアドレスは既に登録されています' };
        }
        return { success: false, message: error.message };
      }

      if (data.user) {
        // メール確認が必要かどうか（セッションがない場合は確認が必要）
        const needsEmailConfirmation = !data.session;

        // プロフィールテーブルを更新（メール確認不要の場合のみ）
        if (!needsEmailConfirmation) {
          const { error: profileError } = await this.supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              username: username,
              riot_id_name: riotIdName,
              riot_id_tag: riotIdTag,
              updated_at: new Date().toISOString()
            });

          if (profileError) {
            console.error('Profile update error:', profileError);
          }

          this.currentUser = data.user;
          this.currentProfile = {
            id: data.user.id,
            username: username,
            riot_id_name: riotIdName,
            riot_id_tag: riotIdTag
          };
        }

        return {
          success: true,
          userId: data.user.id,
          riotId: riotIdName && riotIdTag ? { name: riotIdName, tag: riotIdTag } : null,
          needsEmailConfirmation: needsEmailConfirmation,
          message: needsEmailConfirmation ? '確認メールを送信しました' : '登録が完了しました'
        };
      }

      return { success: false, message: '登録に失敗しました' };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: error.message };
    }
  }

  // ログイン
  async login(emailOrUsername, password) {
    if (!this.supabase) {
      return { success: false, message: 'データベースに接続できません' };
    }

    try {
      // メールアドレスでログイン
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: emailOrUsername,
        password: password
      });

      if (error) {
        console.error('Login error:', error);
        return { success: false, message: 'メールアドレスまたはパスワードが正しくありません' };
      }

      if (data.user) {
        this.currentUser = data.user;
        await this.loadProfile();

        // 旧形式との互換性のためにuserオブジェクトを作成
        const user = {
          id: data.user.id,
          username: this.currentProfile?.username || data.user.email,
          email: data.user.email,
          riotId: this.currentProfile?.riot_id_name && this.currentProfile?.riot_id_tag
            ? { name: this.currentProfile.riot_id_name, tag: this.currentProfile.riot_id_tag }
            : null,
          data: {
            valorant_settings: this.currentProfile?.riot_id_name ? {
              riotId: {
                name: this.currentProfile.riot_id_name,
                tag: this.currentProfile.riot_id_tag
              },
              region: 'ap',
              platform: 'pc'
            } : null
          }
        };

        return { success: true, user: user };
      }

      return { success: false, message: 'ログインに失敗しました' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: error.message };
    }
  }

  // ログアウト
  async logout() {
    if (this.supabase) {
      await this.supabase.auth.signOut();
    }

    this.currentUser = null;
    this.currentProfile = null;
    this.isGuest = false;
    this.guestData = {};
    sessionStorage.removeItem('currentUser');
    sessionStorage.removeItem('isGuest');
  }

  // ゲストログイン
  loginAsGuest() {
    this.isGuest = true;
    this.currentUser = {
      id: 'guest',
      username: 'ゲストユーザー',
      isGuest: true
    };
    this.guestData = {};
    sessionStorage.setItem('isGuest', 'true');
    sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
    return { success: true, user: this.currentUser };
  }

  // 現在のユーザーを取得
  getCurrentUser() {
    if (this.isGuest) {
      return this.currentUser;
    }

    if (this.currentUser && this.currentProfile) {
      return {
        id: this.currentUser.id,
        username: this.currentProfile.username || this.currentUser.email,
        email: this.currentUser.email,
        riotId: this.currentProfile.riot_id_name && this.currentProfile.riot_id_tag
          ? { name: this.currentProfile.riot_id_name, tag: this.currentProfile.riot_id_tag }
          : null,
        data: {
          valorant_settings: this.currentProfile.riot_id_name ? {
            riotId: {
              name: this.currentProfile.riot_id_name,
              tag: this.currentProfile.riot_id_tag
            },
            region: 'ap',
            platform: 'pc'
          } : null
        }
      };
    }

    // ゲストセッションをチェック
    const isGuestStored = sessionStorage.getItem('isGuest');
    if (isGuestStored === 'true') {
      this.isGuest = true;
      this.currentUser = {
        id: 'guest',
        username: 'ゲストユーザー',
        isGuest: true
      };
      return this.currentUser;
    }

    return null;
  }

  // ゲストユーザーかどうか
  isGuestUser() {
    return this.isGuest;
  }

  // ユーザーデータを保存
  async saveUserData(key, data) {
    if (!this.currentUser) return false;

    if (this.isGuest) {
      this.guestData[key] = data;
      return true;
    }

    // Supabaseのプロフィールには保存しない（拡張が必要な場合は別テーブルを使用）
    // 現時点ではlocalStorageにフォールバック
    try {
      const storageKey = `user_data_${this.currentUser.id}_${key}`;
      localStorage.setItem(storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('Save user data error:', error);
      return false;
    }
  }

  // ユーザーデータを取得
  getUserData(key) {
    if (!this.currentUser) return null;

    if (this.isGuest) {
      return this.guestData[key] || null;
    }

    try {
      const storageKey = `user_data_${this.currentUser.id}_${key}`;
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Get user data error:', error);
      return null;
    }
  }

  // Valorant API設定を保存
  saveValorantSettings(settings) {
    if (!this.currentUser) return false;

    const valorantData = {
      riotId: settings.riotId || null,
      apiKey: settings.apiKey || '',
      region: settings.region || 'ap',
      platform: settings.platform || 'pc',
      lastUpdated: new Date().toISOString()
    };

    return this.saveUserData('valorant_settings', valorantData);
  }

  // Valorant API設定を取得
  getValorantSettings() {
    if (!this.currentUser) return null;

    // プロフィールからRiot IDを優先
    if (this.currentProfile && this.currentProfile.riot_id_name) {
      const savedSettings = this.getUserData('valorant_settings') || {};
      return {
        riotId: {
          name: this.currentProfile.riot_id_name,
          tag: this.currentProfile.riot_id_tag
        },
        apiKey: savedSettings.apiKey || '',
        region: savedSettings.region || 'ap',
        platform: savedSettings.platform || 'pc',
        lastUpdated: savedSettings.lastUpdated
      };
    }

    return this.getUserData('valorant_settings');
  }

  // Riot IDを保存
  async saveRiotId(name, tag) {
    if (!this.currentUser || this.isGuest) return false;

    try {
      const { error } = await this.supabase
        .from('profiles')
        .update({
          riot_id_name: name.trim(),
          riot_id_tag: tag.trim().replace('#', ''),
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentUser.id);

      if (error) {
        console.error('Save Riot ID error:', error);
        return false;
      }

      // ローカルのプロフィールも更新
      if (this.currentProfile) {
        this.currentProfile.riot_id_name = name.trim();
        this.currentProfile.riot_id_tag = tag.trim().replace('#', '');
      }

      return true;
    } catch (error) {
      console.error('Save Riot ID error:', error);
      return false;
    }
  }

  // Riot IDを取得
  getRiotId() {
    if (this.currentProfile && this.currentProfile.riot_id_name && this.currentProfile.riot_id_tag) {
      return {
        name: this.currentProfile.riot_id_name,
        tag: this.currentProfile.riot_id_tag
      };
    }

    const settings = this.getValorantSettings();
    return settings?.riotId || null;
  }

  // Valorant APIキーを保存
  saveValorantApiKey(apiKey) {
    if (!this.currentUser) return false;

    const currentSettings = this.getValorantSettings() || {};
    currentSettings.apiKey = apiKey.trim();
    currentSettings.lastUpdated = new Date().toISOString();

    return this.saveUserData('valorant_settings', currentSettings);
  }

  // Valorant APIキーを取得
  getValorantApiKey() {
    const settings = this.getValorantSettings();
    return settings?.apiKey || '';
  }

  // ログイン時にValorant API設定を復元
  restoreValorantSettings() {
    const settings = this.getValorantSettings();
    if (settings && window.valorantAPIService) {
      if (settings.apiKey) {
        window.valorantAPIService.apiKey = settings.apiKey;
      }
      if (settings.riotId) {
        window.valorantAPIService.riotId = settings.riotId;
      }
      if (settings.region) {
        window.valorantAPIService.region = settings.region;
      }
      if (settings.platform) {
        window.valorantAPIService.platform = settings.platform;
      }
      window.valorantAPIService.saveSettings();
      console.log('Valorant settings restored for user:', this.currentProfile?.username || this.currentUser?.email);
      return true;
    }
    return false;
  }
}

// グローバルインスタンスを作成
const authService = new AuthService();

// Supabaseクライアントが準備できたら初期化
document.addEventListener('DOMContentLoaded', async () => {
  // Supabaseクライアントが利用可能になるまで待機（最大5秒）
  let attempts = 0;
  const maxAttempts = 50;

  const waitForSupabase = async () => {
    while (!window.supabaseClient && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }

    if (window.supabaseClient) {
      await authService.init();
      console.log('AuthService initialized with Supabase');
    } else {
      console.error('Supabase client not available after timeout');
    }
  };

  await waitForSupabase();
});
