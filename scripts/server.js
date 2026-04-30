#!/usr/bin/env node
/**
 * server.js — Servidor de desenvolvimento do Sky FC
 *
 * Serve a pasta www/ estaticamente e expõe /api/apk-info
 * com o IP da rede local para que o celular consiga baixar o APK via Wi-Fi.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const WWW  = path.join(__dirname, '..', 'www');
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.svg':   'image/svg+xml',
  '.ico':   'image/x-icon',
  '.webp':  'image/webp',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.apk':   'application/vnd.android.package-archive',
};

function getLanIp() {
  // Prefer common private ranges (Wi-Fi/Ethernet) over virtual/VPN adapters
  const candidates = [];
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      const ip = iface.address;
      if (ip.startsWith('192.168.') || ip.startsWith('10.')) candidates.unshift(ip);
      else if (ip.startsWith('172.')) candidates.push(ip);
      else candidates.push(ip);
    }
  }
  return candidates[0] || 'localhost';
}

const server = http.createServer((req, res) => {
  const url      = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // ─── API ───
  if (pathname === '/api/apk-info') {
    const ip      = getLanIp();
    const apkUrl  = `http://${ip}:${PORT}/skyfc.apk`;
    const exists  = fs.existsSync(path.join(WWW, 'skyfc.apk'));
    res.writeHead(200, {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ ip, port: Number(PORT), apkUrl, apkExists: exists }));
    return;
  }

  // ─── Static files ───
  let filePath = path.normalize(path.join(WWW, pathname === '/' ? 'index.html' : pathname));

  if (!filePath.startsWith(WWW)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  if (!fs.existsSync(filePath)) {
    // SPA fallback
    filePath = path.join(WWW, 'index.html');
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end('Not Found'); return; }
  }

  const ext     = path.extname(filePath).toLowerCase();
  const mime    = MIME[ext] || 'application/octet-stream';
  const stat    = fs.statSync(filePath);
  const headers = { 'Content-Type': mime, 'Content-Length': stat.size };
  if (ext === '.apk') headers['Content-Disposition'] = 'attachment; filename="skyfc.apk"';

  res.writeHead(200, headers);
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLanIp();
  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║           Sky FC · Dev Server        ║');
  console.log('  ╚══════════════════════════════════════╝');
  console.log(`\n  Local   → http://localhost:${PORT}`);
  console.log(`  Celular → http://${ip}:${PORT}`);
  console.log(`  APK     → http://${ip}:${PORT}/skyfc.apk`);
  console.log('\n  Ctrl+C para parar\n');
});
