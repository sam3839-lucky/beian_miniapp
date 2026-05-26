#!/usr/bin/env node
/**
 * 微信小程序自动上传脚本
 * 用法: node scripts/upload.js [版本号] [描述]
 *
 * 前提: 从 mp.weixin.qq.com → 开发 → 开发设置 → 下载代码上传密钥
 *       放到项目根目录，命名为 private.key
 */

const ci = require('miniprogram-ci');
const path = require('path');
const fs = require('fs');

const PROJECT_PATH = path.resolve(__dirname, '..');
const APPID = 'wx0c0ca47c02bcd376';
const PRIVATE_KEY = path.join(PROJECT_PATH, 'private.key');

// 检查密钥
if (!fs.existsSync(PRIVATE_KEY)) {
  console.error('❌ 缺少上传密钥!');
  console.error('   请去 mp.weixin.qq.com → 开发 → 开发设置 → 下载代码上传密钥');
  console.error('   将下载的 private.key 放到项目根目录');
  process.exit(1);
}

const version = process.argv[2] || new Date().toISOString().slice(0, 16).replace('T', '.');
const desc    = process.argv[3] || '自动上传 ' + new Date().toLocaleString('zh-CN');

(async () => {
  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_PATH,
    privateKeyPath: PRIVATE_KEY,
    ignores: [
      'node_modules/**/*',
      'sync/**/*.db',
      'sync/**/__pycache__/**',
      'docs/**/*',
      'scripts/**/*',
      '.git/**/*',
      '*.db',
      '*.db-shm',
      '*.db-wal',
      'package.json',
      'package-lock.json',
    ],
  });

  console.log(`📦 上传小程序 ${APPID}`);
  console.log(`   版本: ${version}`);
  console.log(`   描述: ${desc}`);

  const result = await ci.upload({
    project,
    version,
    desc,
    setting: {
      es6: true,
      es7: true,
      minify: true,
      minifyJS: true,
      minifyWXML: true,
      minifyWXSS: true,
      autoPrefixWXSS: true,
    },
    onProgressUpdate: (info) => {
      if (info.status === 'doing') {
        process.stdout.write(`\r   ${info.message || ''}...`);
      }
    },
  });

  console.log('\n✅ 上传成功!');
  console.log('   下一步: mp.weixin.qq.com → 版本管理 → 提交审核 → 发布');
})();
