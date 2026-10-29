#!/usr/bin/env node
/**
 * 极简 .env 加载器（无第三方依赖）
 *
 * 只读取项目根目录的 .env，已存在的环境变量不会被覆盖，
 * 因此 CLI 里显式传的变量优先级高于 .env。
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_ENV_FILE = path.join(__dirname, '..', '.env');

function parseEnv(text) {
  const result = {};
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    const quoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"));
    if (quoted && value.length >= 2) value = value.slice(1, -1);

    result[key] = value;
  }
  return result;
}

function loadEnv(file = DEFAULT_ENV_FILE) {
  if (!fs.existsSync(file)) return {};

  const parsed = parseEnv(fs.readFileSync(file, 'utf8'));
  for (const key of Object.keys(parsed)) {
    if (process.env[key] === undefined) process.env[key] = parsed[key];
  }
  return parsed;
}

function requireEnv(name, hint) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    console.error(`❌ 缺少环境变量 ${name}`);
    if (hint) console.error(`   ${hint}`);
    process.exit(1);
  }
  return value;
}

module.exports = { loadEnv, parseEnv, requireEnv, DEFAULT_ENV_FILE };
