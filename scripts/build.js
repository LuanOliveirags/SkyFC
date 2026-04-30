#!/usr/bin/env node
/**
 * build.js — Prepara a pasta www/ para o Capacitor
 *
 * Copia apenas os assets web necessários para www/,
 * deixando node_modules, backend, docs e configs fora do APK.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW  = path.join(ROOT, 'www');

const WEB_ASSETS = [
  'index.html',
  'manifest.json',
  'service-worker.js',
  'frontend',
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) {
      copyRecursive(path.join(src, child), path.join(dest, child));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// ─── Limpa www/ ───
if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true, force: true });
}
fs.mkdirSync(WWW);

// ─── Copia assets ───
let ok = 0;
for (const asset of WEB_ASSETS) {
  const src  = path.join(ROOT, asset);
  const dest = path.join(WWW, asset);

  if (!fs.existsSync(src)) {
    console.warn(`  ⚠  não encontrado: ${asset}`);
    continue;
  }

  copyRecursive(src, dest);
  console.log(`  ✓  ${asset}`);
  ok++;
}

console.log(`\n  www/ pronto — ${ok} item(s) copiado(s)`);

// ─── Copia APK (se existir) ───
const APK_SRC  = path.join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk');
const APK_DEST = path.join(WWW, 'skyfc.apk');
if (fs.existsSync(APK_SRC)) {
  fs.copyFileSync(APK_SRC, APK_DEST);
  const sizeMB = (fs.statSync(APK_DEST).size / 1024 / 1024).toFixed(1);
  console.log(`  ✓  skyfc.apk (${sizeMB} MB)\n`);
} else {
  console.warn('  ⚠  APK não encontrado — execute o build Android para incluí-lo\n');
}
