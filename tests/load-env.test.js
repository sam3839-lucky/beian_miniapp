const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { parseEnv, loadEnv } = require('../scripts/load-env');

function tempEnvFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'load-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, content);
  return { dir, file };
}

test('parseEnv 解析键值、跳过注释与空行、去掉成对引号', () => {
  const parsed = parseEnv(
    [
      '# 这是注释',
      '',
      'DB_BACKEND=postgres',
      'SQLITE_PATH="sync/property_new.db"',
      "WX_APPSECRET='abc123'",
      'NOT_A_PAIR=abc',
    ].join('\n')
  );

  assert.deepEqual(parsed, {
    DB_BACKEND: 'postgres',
    SQLITE_PATH: 'sync/property_new.db',
    WX_APPSECRET: 'abc123',
    NOT_A_PAIR: 'abc',
  });
});

test('parseEnv 对含等号的值只按第一个等号切分', () => {
  const parsed = parseEnv('DATABASE_URL=postgres://u:p@host:5432/db?a=1');
  assert.equal(parsed.DATABASE_URL, 'postgres://u:p@host:5432/db?a=1');
});

test('parseEnv 忽略没有等号的行与空键', () => {
  const parsed = parseEnv('JUST_A_WORD\n=novalue\nOK=1');
  assert.deepEqual(parsed, { OK: '1' });
});

test('parseEnv 保留显式空值', () => {
  const parsed = parseEnv('EMPTY=');
  assert.equal(parsed.EMPTY, '');
});

test('loadEnv 写入 process.env 但不覆盖已有变量', () => {
  const { dir, file } = tempEnvFile('WX_TEST_PRESET=from-file\nWX_TEST_FRESH=fresh\n');
  process.env.WX_TEST_PRESET = 'from-process';
  delete process.env.WX_TEST_FRESH;

  try {
    loadEnv(file);
    assert.equal(process.env.WX_TEST_PRESET, 'from-process');
    assert.equal(process.env.WX_TEST_FRESH, 'fresh');
  } finally {
    delete process.env.WX_TEST_PRESET;
    delete process.env.WX_TEST_FRESH;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadEnv 在文件不存在时返回空对象且不抛错', () => {
  const missing = path.join(os.tmpdir(), 'load-env-does-not-exist', '.env');
  assert.deepEqual(loadEnv(missing), {});
});
