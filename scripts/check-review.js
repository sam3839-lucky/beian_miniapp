#!/usr/bin/env node
/**
 * 定时检查审核状态，审核通过后飞书通知
 *
 * 用法:
 *   node scripts/check-review.js           -- 检查一次
 *   node scripts/check-review.js --watch   -- 持续轮询（默认30分钟）
 *
 * 状态文件: .review-state.json  (记录上次状态，避免重复通知)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const APPID = 'wx0c0ca47c02bcd376';
const SECRET = 'e8fa6b52cfdb1d6f7fcaf7a83454423f';
const CHAT_ID = 'oc_d34beb716d5b7f0e9315e968af182fd2';
const STATE_FILE = path.join(__dirname, '..', '.review-state.json');
const POLL_INTERVAL = 30 * 60 * 1000; // 30 分钟

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path: pathname,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch(e) { reject(new Error(buf)); }
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

async function getToken() {
  const r = await request('GET',
    `/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${SECRET}`);
  return r.access_token;
}

async function checkStatus(token) {
  return request('GET', `/wxa/get_latest_auditstatus?access_token=${token}`);
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')); }
  catch (e) { return {}; }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

async function sendLark(msg) {
  const { execSync } = require('child_process');
  try {
    execSync(`cd /tmp && lark-cli im +messages-send --chat-id ${CHAT_ID} --text "${msg.replace(/"/g, '\\"')}"`, {
      stdio: 'pipe', timeout: 10000
    });
    return true;
  } catch (e) {
    console.error('飞书通知失败:', e.message);
    return false;
  }
}

async function main() {
  const watch = process.argv[2] === '--watch';
  const token = await getToken();

  async function check() {
    const s = await checkStatus(token);
    const state = loadState();
    const now = new Date().toLocaleString('zh-CN');

    console.log(`[${now}] 审核状态: ${s.status === 0 ? '通过' : s.status === 1 ? '审核中' : s.status === 2 ? '不通过' : '未知'}`);

    if (s.status === 0 && state.lastStatus !== 0) {
      // 审核通过且上次不是通过 → 发送通知
      const msg = `🎉 小程序 v1.3.2 审核通过！\n审核单号: ${s.auditid}\n可以发布上线了。`;
      await sendLark(msg);
      console.log('已发送审核通过通知');
      saveState({ lastStatus: 0, auditid: s.auditid, notifiedAt: now });
    } else if (s.status === 2 && state.lastStatus !== 2) {
      // 审核不通过
      const reason = s.reason || '未知原因';
      const msg = `⚠️ 小程序审核不通过\n原因: ${reason}\n审核单号: ${s.auditid}\n请登录 mp.weixin.qq.com 查看详情`;
      await sendLark(msg);
      saveState({ lastStatus: 2, auditid: s.auditid, reason, notifiedAt: now });
    } else {
      saveState({ ...state, lastStatus: s.status, auditid: s.auditid });
    }

    return s.status;
  }

  const status = await check();
  if (status === 0) console.log('审核已通过，等待发版指令。');
}

main().catch(e => { console.error(e.message); process.exit(1); });
