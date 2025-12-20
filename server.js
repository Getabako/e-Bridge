const http = require('http');
const fs = require('fs');
const path = require('path');

// MIMEタイプマッピング
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  // URLからファイルパスを取得
  let filePath = '.' + req.url;
  if (filePath === './') {
    filePath = './index.html';
  }

  // ファイルの拡張子を取得
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';

  // ファイルを読み込み
  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // ファイルが見つからない場合
        console.log(`File not found: ${filePath}`);
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>404 - ファイルが見つかりません</h1>', 'utf-8');
      } else {
        // その他のサーバーエラー
        console.log(`Server error: ${error.code}`);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>500 - サーバーエラー</h1><p>${error.code}</p>`, 'utf-8');
      }
    } else {
      // 正常にファイルを提供
      res.writeHead(200, { 
        'Content-Type': mimeType,
        'Cache-Control': 'no-cache'
      });
      res.end(content, 'utf-8');
    }
  });
});

const PORT = process.env.PORT || 8000;
const HOST = 'localhost';

server.listen(PORT, HOST, () => {
  console.log(`🚀 e-Bridge サーバーが起動しました`);
  console.log(`📍 URL: http://${HOST}:${PORT}`);
  console.log(`📁 静的ファイル提供中: ${path.resolve('.')}`);
  console.log(`🛑 停止するには Ctrl+C を押してください`);
});

// エラーハンドリング
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ ポート ${PORT} は既に使用されています`);
    console.log(`💡 他のポートを試すか、既存のプロセスを停止してください`);
  } else {
    console.error('❌ サーバーエラー:', err);
  }
});

process.on('SIGINT', () => {
  console.log('\n🛑 サーバーを停止しています...');
  server.close(() => {
    console.log('✅ サーバーが正常に停止しました');
    process.exit(0);
  });
});