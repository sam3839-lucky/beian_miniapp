#!/usr/bin/env node
/**
 * 微信小程序审核管理
 *
 * 用法:
 *   node scripts/review.js submit  [版本描述]     → 提交审核
 *   node scripts/review.js release                 → 发布已审核版本
 *   node scripts/review.js status                   → 查询审核状态
 */

const https = require('https');
const APPID = 'wx0c0ca47c02bcd376';
const SECRET = 'e8fa6b52cfdb1d6f7fcaf7a83454423f';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = https.request({
      hostname: 'api.weixin.qq.com',
      path,
      method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        const r = JSON.parse(buf);
        if (r.errcode && r.errcode !== 0) reject(new Error(`[${r.errcode}] ${r.errmsg}`));
        else resolve(r);
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

async function submit(token, desc) {
  // 提交审核：默认提交所有页面
  const body = {
    item_list: [{
      address: 'pages/home/home',
      tag: '房地产 信息查询',
      first_class: '房地产',
      second_class: '信息查询',
      title: desc || '功能更新'
    }]
  };
  const r = await request('POST',
    `/wxa/submit_audit?access_token=${token}`, body);
  return r.auditid;
}

async function release(token) {
  return request('POST', `/wxa/release?access_token=${token}`, {});
}

async function status(token) {
  return request('GET', `/wxa/get_latest_auditstatus?access_token=${token}`);
}

(async () => {
  const cmd = process.argv[2] || 'status';
  const desc = process.argv[3];

  try {
    const token = await getToken();
    console.log(`Token: ${token.slice(0, 10)}...`);

    if (cmd === 'submit') {
      const auditid = await submit(token, desc);
      console.log(`✅ 已提交审核，审核单号: ${auditid}`);
      console.log('   审核通常需要 1-7 个工作日');
    } else if (cmd === 'release') {
      await release(token);
      console.log('✅ 已发布，用户可在微信中搜到最新版本');
    } else {
      const s = await status(token);
      console.log(`审核状态: ${s.status === 0 ? '审核通过' : s.status === 1 ? '审核中' : s.status === 2 ? '审核不通过' : '未知'}`);
      if (s.status === 2) console.log(`不通过原因: ${s.reason}`);
      if (s.auditid) console.log(`审核单号: ${s.auditid}`);
    }
  } catch (e) {
    console.error(`❌ ${e.message}`);
    process.exit(1);
  }
})();
