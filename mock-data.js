// Mock Data for eSports AI Coaching App

// Player Data Structure
const mockPlayerData = {
  id: "player_001",
  username: "ProPlayer2024",
  game: "League of Legends",
  rank: "Diamond II",
  server: "JP",
  stats: {
    winRate: 58.5,
    characterMain: "Luke",
    masterRank: "Platinum",
    gamesPlayed: 256,
    totalPlayTime: 1024,
    peakRank: "Diamond",
    leaguePoints: 1847
  },
  recentMatches: [
    {
      id: 1,
      result: "WIN",
      character: "Luke",
      // キャラクター・ラウンド結果
      playerCharacter: "Luke",
      opponentCharacter: "Ryu",
      roundsWon: 2,
      roundsLost: 0,
      rounds: "2-0",
      duration: 3.5,
      date: "2024-08-29",
      gameMode: "Ranked"
    },
    {
      id: 2,
      result: "LOSS",
      character: "Ryu",
      // キャラクター・ラウンド結果
      playerCharacter: "Ryu",
      opponentCharacter: "Ken",
      roundsWon: 0,
      roundsLost: 2,
      rounds: "0-2",
      duration: 2.8,
      date: "2024-08-29",
      gameMode: "Ranked"
    },
    {
      id: 3,
      result: "WIN",
      character: "Luke",
      // キャラクター・ラウンド結果
      playerCharacter: "Luke",
      opponentCharacter: "Chun-Li",
      roundsWon: 2,
      roundsLost: 1,
      rounds: "2-1",
      duration: 4.2,
      date: "2024-08-28",
      gameMode: "Ranked"
    },
    {
      id: 4,
      result: "WIN",
      character: "Ken",
      // キャラクター・ラウンド結果
      playerCharacter: "Ken",
      opponentCharacter: "Jamie",
      roundsWon: 2,
      roundsLost: 0,
      rounds: "2-0",
      duration: 3.1,
      date: "2024-08-28",
      gameMode: "Ranked"
    },
    {
      id: 5,
      result: "LOSS",
      character: "Chun-Li",
      // キャラクター・ラウンド結果
      playerCharacter: "Chun-Li",
      opponentCharacter: "Guile",
      roundsWon: 1,
      roundsLost: 2,
      rounds: "1-2",
      duration: 3.8,
      date: "2024-08-27",
      gameMode: "Ranked"
    }
  ],
  goals: [
    { 
      id: 1, 
      title: "Master到達", 
      description: "今シーズン中にMasterランクに到達する",
      deadline: "2024-12-31", 
      progress: 65,
      type: "rank",
      priority: "high",
      createdAt: "2024-08-01"
    },
    {
      id: 2,
      title: "ドライブラッシュ成功率80%達成",
      description: "ドライブラッシュの成功率を80%まで向上させる",
      deadline: "2024-11-30",
      progress: 40,
      type: "skill",
      priority: "medium",
      createdAt: "2024-08-15"
    },
    { 
      id: 3, 
      title: "勝率65%達成", 
      description: "直近50試合での勝率65%を維持する",
      deadline: "2024-10-31", 
      progress: 25,
      type: "performance",
      priority: "medium",
      createdAt: "2024-08-20"
    }
  ],
  matchHistory: [],
  preferences: {
    notifications: true,
    autoAnalysis: false,
    dataRetention: 30,
    theme: "dark",
    language: "ja"
  }
};

// Performance Chart Data
const mockPerformanceData = {
  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'],
  datasets: [
    {
      label: 'ドライブラッシュ成功率',
      data: [70, 74, 76, 78, 80, 77, 79, 82],
      borderColor: '#ff6b35',
      backgroundColor: 'rgba(255, 107, 53, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: 'ドライブインパクト成功率',
      data: [60, 65, 68, 70, 72, 68, 71, 75],
      borderColor: '#e94560',
      backgroundColor: 'rgba(233, 69, 96, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: '対空成功率',
      data: [65, 68, 70, 73, 75, 72, 74, 77],
      borderColor: '#0f3460',
      backgroundColor: 'rgba(15, 52, 96, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: '投げ抜け率',
      data: [35, 38, 42, 45, 48, 46, 50, 52],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: 'ジャストパリィ平均回数',
      data: [1.5, 1.8, 2.1, 2.3, 2.5, 2.2, 2.4, 2.7],
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      tension: 0.4,
      fill: true
    },
    {
      label: '勝率 (%)',
      data: [52, 55, 58, 56, 60, 59, 58, 62],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      tension: 0.4,
      fill: true
    }
  ]
};

// ドライブラッシュ成功率分布チャートデータ
const mockDriveRushData = {
  labels: ['0-20%', '20-40%', '40-60%', '60-80%', '80-100%'],
  datasets: [{
    label: 'ドライブラッシュ成功率分布',
    data: [2, 8, 25, 45, 20],
    backgroundColor: [
      '#ef4444',
      '#f59e0b',
      '#10b981',
      '#0f3460',
      '#e94560'
    ],
    borderColor: '#ffffff',
    borderWidth: 2
  }]
};

// Mock AI Analysis Results
const mockAIAnalysis = {
  analysis: "プレイヤーは安定したパフォーマンスを示していますが、ドライブゲージ管理と対空の精度に改善の余地があります。特に、バーンアウト頻度の改善と投げ抜けの意識向上が必要です。ドライブインパクトの成功率は良好ですが、カウンターされるリスクも抱えています。",
  strengths: [
    "高いドライブインパクト成功率（平均68.2%）を維持している",
    "優れたニュートラルゲームの立ち回り",
    "安定した対空意識（平均72.5%）",
    "キャラクター対策の理解が深い",
    "コンボ精度と安定性"
  ],
  weaknesses: [
    "バーンアウト頻度が高い（平均0.8回/試合）",
    "投げ抜け率が低い（平均45.8%）",
    "ドライブインパクトのカウンター被害",
    "プレッシャー状況での判断ミス",
    "ゲージ管理の甘さ"
  ],
  improvements: [
    "ドライブゲージの節約意識を高める",
    "投げ抜けのタイミング練習を強化する",
    "ドライブインパクトの使い所を最適化する",
    "対空の安定性をさらに向上させる",
    "バーンアウト回避の練習を実施する"
  ],
  training: [
    "トレーニングモードでドライブゲージ管理練習（毎日30分）",
    "プロの試合VOD分析（週3回、各1時間）",
    "投げ抜け専用トレーニング（週5回）",
    "対空コンボの安定性向上練習",
    "バーンアウト回避シナリオ練習"
  ],
  priority: "ドライブゲージ管理の改善 - バーンアウト回数をゼロにすることを最優先目標に設定",
  estimatedImprovement: "2週間の集中練習で勝率5-8%向上、1ヶ月でバーンアウト頻度50%減少・投げ抜け率15%向上が期待できます",
  confidence: 0.85,
  lastUpdated: "2024-08-30T10:30:00Z"
};

// Mock AI Recommendations
const mockRecommendations = [
  {
    id: 1,
    title: "ドライブゲージ管理向上",
    type: "economy",
    priority: "high",
    text: "ドライブゲージの効率的な使用とバーンアウト回避を重視してください。現在の平均0.8回/試合のバーンアウトを0回に減らすことで、大幅な勝率向上が期待できます。",
    actionItems: [
      "トレーニングモードでのゲージ管理練習（毎日30分）",
      "ドライブインパクトの使用タイミング最適化",
      "バーンアウト回避シナリオの練習"
    ],
    estimatedTime: "2-3週間",
    difficulty: "中"
  },
  {
    id: 2,
    title: "投げ抜け率向上",
    type: "defense",
    priority: "medium",
    text: "投げ抜けのタイミングとリズムを習得してください。現在の45.8%から60%以上への向上で、近距離の攻防が大幅に改善されます。",
    actionItems: [
      "投げ抜け専用トレーニングモード練習",
      "相手の投げタイミングの研究",
      "投げ抜け後の確反コンボ練習"
    ],
    estimatedTime: "1-2週間",
    difficulty: "易"
  },
  {
    id: 3,
    title: "対空精度の安定化",
    type: "defense",
    priority: "medium",
    text: "対空技の成功率をさらに向上させ、相手のジャンプ攻撃を封じてください。現在の72.5%から85%以上への向上で、試合の主導権をより確実に握れます。",
    actionItems: [
      "各キャラクター別対空技の最適化練習",
      "ジャンプタイミング読みの向上",
      "対空後のコンボ確定練習"
    ],
    estimatedTime: "3-4週間",
    difficulty: "難"
  }
];

// Settings Mock Data
const mockSettings = {
  api: {
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4',
    isConfigured: false,
    lastVerified: null
  },
  application: {
    notifications: true,
    autoAnalysis: false,
    dataRetention: 30,
    theme: 'dark',
    language: 'ja'
  }
};

// Sample API Responses for different providers
const mockAPIResponses = {
  performanceAnalysis: {
    openai: {
      analysis: "Based on your recent performance data, you show strong mechanical skills but need improvement in macro game decision-making.",
      strengths: ["High KDA maintenance", "Excellent laning phase", "Good item builds"],
      weaknesses: ["Mid-game positioning", "CS efficiency", "Map awareness"],
      improvements: ["Focus on CS drills", "Improve minimap checking", "Practice team fight positioning"],
      training: ["30min CS practice daily", "VOD review 3x/week", "Positioning drills"],
      priority: "CS improvement - target 8.0 CS/min",
      estimatedImprovement: "5-8% winrate increase in 2 weeks"
    }
  }
};

// Helper Functions
const mockDataHelpers = {
  // Get player statistics
  getPlayerStats: () => {
    return { ...mockPlayerData.stats };
  },

  // Get recent matches with calculated stats
  getRecentMatches: (limit = 5) => {
    return mockPlayerData.recentMatches.slice(0, limit).map(match => ({
      ...match,
      driveRushRate: match.driveRushLanded ? (match.driveRushLanded / 10 * 100).toFixed(1) : '0.0',
      antiAirRate: match.antiAirSuccess ? (match.antiAirSuccess / 8 * 100).toFixed(1) : '0.0'
    }));
  },

  // Get goals with progress calculation
  getGoals: () => {
    return mockPlayerData.goals.map(goal => {
      const now = new Date();
      const deadline = new Date(goal.deadline);
      const created = new Date(goal.createdAt);
      const totalDays = Math.ceil((deadline - created) / (1000 * 60 * 60 * 24));
      const daysPassed = Math.ceil((now - created) / (1000 * 60 * 60 * 24));
      const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      
      return {
        ...goal,
        daysRemaining,
        timeProgress: Math.min(100, (daysPassed / totalDays) * 100)
      };
    });
  },

  // Calculate performance metrics
  calculatePerformanceMetrics: () => {
    const matches = mockPlayerData.recentMatches;
    const totalMatches = matches.length;
    const wins = matches.filter(m => m.result === 'WIN').length;

    // ドライブゲージ経済指標
    const totalDriveRushAttempts = matches.reduce((sum, m) => sum + (m.driveRushAttempts || 0), 0);
    const totalDriveRushSuccess = matches.reduce((sum, m) => sum + (m.driveRushSuccess || 0), 0);
    const totalDriveImpactSuccess = matches.reduce((sum, m) => sum + (m.driveImpactSuccess || 0), 0);
    const totalDriveImpactCounter = matches.reduce((sum, m) => sum + (m.driveImpactCounter || 0), 0);
    const totalBurnoutCount = matches.reduce((sum, m) => sum + (m.burnoutCount || 0), 0);
    const totalBurnoutDuration = matches.reduce((sum, m) => sum + (m.burnoutDuration || 0), 0);

    // 対空・投げ指標
    const totalOpponentJumps = matches.reduce((sum, m) => sum + (m.opponentJumps || 0), 0);
    const totalAntiAirSuccess = matches.reduce((sum, m) => sum + (m.antiAirSuccess || 0), 0);
    const totalThrowAttempts = matches.reduce((sum, m) => sum + (m.throwAttempts || 0), 0);
    const totalThrowTechSuccess = matches.reduce((sum, m) => sum + (m.throwTechSuccess || 0), 0);

    // ジャストパリィ・キャラクター指標
    const totalJustParryCount = matches.reduce((sum, m) => sum + (m.justParryCount || 0), 0);
    const totalRoundsWon = matches.reduce((sum, m) => sum + (m.roundsWon || 0), 0);
    const totalRoundsLost = matches.reduce((sum, m) => sum + (m.roundsLost || 0), 0);

    return {
      winRate: ((wins / totalMatches) * 100).toFixed(1),
      avgDriveRushAttempts: (totalDriveRushAttempts / totalMatches).toFixed(1),
      driveRushSuccessRate: totalDriveRushAttempts > 0 ?
        ((totalDriveRushSuccess / totalDriveRushAttempts) * 100).toFixed(1) : '0.0',
      driveImpactSuccessRate: totalDriveImpactSuccess > 0 ?
        ((totalDriveImpactSuccess / (totalDriveImpactSuccess + totalDriveImpactCounter)) * 100).toFixed(1) : '0.0',
      burnoutFrequency: (totalBurnoutCount / totalMatches).toFixed(1),
      avgBurnoutDuration: totalBurnoutCount > 0 ?
        (totalBurnoutDuration / totalBurnoutCount).toFixed(1) : '0.0',
      antiAirSuccessRate: totalOpponentJumps > 0 ?
        ((totalAntiAirSuccess / totalOpponentJumps) * 100).toFixed(1) : '0.0',
      throwTechRate: totalThrowAttempts > 0 ?
        ((totalThrowTechSuccess / totalThrowAttempts) * 100).toFixed(1) : '0.0',
      avgJustParryCount: (totalJustParryCount / totalMatches).toFixed(1),
      roundWinRate: (totalRoundsWon + totalRoundsLost) > 0 ?
        ((totalRoundsWon / (totalRoundsWon + totalRoundsLost)) * 100).toFixed(1) : '0.0',
      totalMatches,
      wins,
      losses: totalMatches - wins
    };
  },

  // Generate chart data for different time periods
  generateChartData: (period = 'week') => {
    // This would normally calculate real data based on match history
    return period === 'week' ? mockPerformanceData : mockPerformanceData;
  },

  // Add new match data
  addMatch: (matchData) => {
    const newMatch = {
      id: mockPlayerData.recentMatches.length + 1,
      ...matchData,
      date: new Date().toISOString().split('T')[0],
      gameMode: "Ranked Solo"
    };
    mockPlayerData.recentMatches.unshift(newMatch);
    if (mockPlayerData.recentMatches.length > 10) {
      mockPlayerData.recentMatches = mockPlayerData.recentMatches.slice(0, 10);
    }
    return newMatch;
  },

  // Add new goal
  addGoal: (goalData) => {
    const newGoal = {
      id: mockPlayerData.goals.length + 1,
      ...goalData,
      progress: 0,
      type: goalData.type || 'custom',
      priority: goalData.priority || 'medium',
      createdAt: new Date().toISOString().split('T')[0]
    };
    mockPlayerData.goals.push(newGoal);
    return newGoal;
  },

  // Update goal progress
  updateGoalProgress: (goalId, progress) => {
    const goal = mockPlayerData.goals.find(g => g.id === goalId);
    if (goal) {
      goal.progress = Math.max(0, Math.min(100, progress));
      return goal;
    }
    return null;
  },

  // Get AI analysis with dynamic data
  getAIAnalysis: (playerData = mockPlayerData) => {
    // This would normally call the AI service
    // For now, return mock data with some dynamic elements
    const metrics = mockDataHelpers.calculatePerformanceMetrics();
    
    return {
      ...mockAIAnalysis,
      analysis: `現在の勝率${metrics.winRate}%、ドライブインパクト成功率${metrics.driveImpactSuccessRate}%、バーンアウト頻度${metrics.burnoutFrequency}回/試合のパフォーマンスを分析しました。${mockAIAnalysis.analysis}`,
      lastUpdated: new Date().toISOString()
    };
  },

  // Get recommendations based on current performance
  getRecommendations: () => {
    return mockRecommendations.map(rec => ({
      ...rec,
      lastUpdated: new Date().toISOString()
    }));
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mockPlayerData,
    mockPerformanceData,
    mockDriveRushData,
    mockAIAnalysis,
    mockRecommendations,
    mockSettings,
    mockAPIResponses,
    mockDataHelpers
  };
} else if (typeof window !== 'undefined') {
  // Browser environment
  window.mockPlayerData = mockPlayerData;
  window.mockPerformanceData = mockPerformanceData;
  window.mockDriveRushData = mockDriveRushData;
  window.mockAIAnalysis = mockAIAnalysis;
  window.mockRecommendations = mockRecommendations;
  window.mockSettings = mockSettings;
  window.mockAPIResponses = mockAPIResponses;
  window.mockDataHelpers = mockDataHelpers;
}