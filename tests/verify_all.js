#!/usr/bin/env node
/* v3 校验：产物最新、语法、规则安全边界、关键脚本行为。 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const build = require('../scripts/build.js');

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    console.error(`✗ ${name}\n    ${e.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const files = build.buildAll();
const CONFS = ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf'];
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
function sectionOf(text, name) {
  const m = text.split(/\n(?=\[)/).find((s) => s.startsWith(`[${name}]`));
  return m ? m.split('\n').slice(1) : [];
}
const body = (lines) => lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

// ---------------------------------------------------------------- 产物
test('构建产物与 src/ 同步（请运行 npm run build）', () => {
  for (const [rel, content] of Object.entries(files)) {
    assert(fs.existsSync(path.join(ROOT, rel)) && read(rel) === content, `${rel} 已过期`);
  }
});
test('构建幂等', () => {
  const again = build.buildAll();
  for (const k of Object.keys(files)) assert(again[k] === files[k], `${k} 两次构建结果不同`);
});

const allTexts = Object.entries(files);

// ---------------------------------------------------------------- 通用语法
for (const [rel, text] of allTexts) {
  const rules = body(sectionOf(text, 'Rule'));
  const rewrites = body(sectionOf(text, 'URL Rewrite'));
  const scripts = body(sectionOf(text, 'Script'));

  test(`${rel}: 重写正则可编译且格式正确`, () => {
    for (const l of rewrites) {
      const m = l.match(/^(\S+) (- (reject|reject-200|reject-dict|reject-array|reject-img)|\S+ (302|307))$/);
      assert(m, `格式错误: ${l}`);
      new RegExp(m[1]);
    }
  });
  test(`${rel}: 脚本参数安全`, () => {
    for (const l of scripts) {
      const pat = (l.match(/pattern=(.*?),script-path=/) || [])[1];
      assert(pat, `缺少 pattern: ${l}`);
      new RegExp(pat);
      assert(!/max-size=-1/.test(l), `禁止 max-size=-1: ${l}`);
      const size = Number((l.match(/max-size=(\d+)/) || [])[1] || 0);
      assert(size <= 5242880, `max-size 过大: ${l}`);
      assert(/script-update-interval=86400/.test(l), `更新间隔应为 86400: ${l}`);
      assert(/timeout=(10|30)\b/.test(l), `timeout 应为 10/30: ${l}`);
      const file = (l.match(/script-path=\S+?\/modules\/scripts\/([^,]+)/) || [])[1];
      assert(file && fs.existsSync(path.join(ROOT, 'modules/scripts', file)), `脚本不存在: ${l}`);
    }
  });
  test(`${rel}: 规则格式`, () => {
    for (const l of rules) {
      assert(/^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6|IP-ASN|GEOIP|USER-AGENT|URL-REGEX|RULE-SET|AND|OR|NOT|FINAL|DST-PORT),/.test(l), `未知规则: ${l}`);
      if (/^(IP-CIDR6?|IP-ASN),/.test(l) && !/^IP-CIDR,(127|10|192\.168|172\.16|100\.64|17)\./.test(l)) {
        // IP 规则放在前面但不带 no-resolve 会让每个域名都先做一次 DNS 查询
        assert(/no-resolve$/.test(l), `IP 规则缺少 no-resolve: ${l}`);
      }
      assert(!/^DOMAIN-KEYWORD,(muse|colab|developerprofiles|gtimg|qpic),/.test(l), `过宽的关键词规则: ${l}`);
    }
  });
  test(`${rel}: 规则无重复`, () => {
    const seen = new Set();
    for (const l of rules) {
      assert(!seen.has(l), `重复: ${l}`);
      seen.add(l);
    }
  });
}

// ---------------------------------------------------------------- 安全边界
const PROTECTED = /(^|\.)(apple\.com|apple\.com\.cn|icloud\.com|icloud\.com\.cn|icloud-content\.com|mzstatic\.com|cdn-apple\.com|aaplimg\.com|itunes\.com|apple-cloudkit\.com|push\.apple\.com|alipay\.com|95516\.com|unionpay\.com|10086\.cn|12306\.cn|icbc\.com\.cn|ccb\.com|cmbchina\.com|wechat\.com|weixin\.qq\.com)$/;
// 这些只禁止通配（整站解密会拖慢且易触发证书校验），精确主机允许
const NO_WILDCARD = /^(qq\.com|taobao\.com|jd\.com|gtimg\.cn|alicdn\.com|meituan\.net|xmcdn\.com|hupucdn\.com|hupu\.com|baidu\.com|163\.com|weibo\.com|wanmei\.com|pwesports\.cn|coolapk\.com|goofish\.com|google\.cn)$/;
const NEVER_REJECT = ['gtimg.cn', 'qzs.qq.com', 'u.jd.com', 'union-click.jd.com', 'click.union.jd.com', 's.click.taobao.com', 'uland.taobao.com',
  'gepush.com', 'sf6-ttcdn-tos.pstatp.com', 'bytegecko.com', 'bytegoofy.com', 'bytegos.com', 'umeng.com', 'umengcloud.com', 'apple.com', 'icloud.com', 'mzstatic.com'];

for (const [rel, text] of allTexts) {
  const mitmLine = body(sectionOf(text, 'MITM')).find((l) => l.startsWith('hostname')) || '';
  const hosts = mitmLine.replace(/^hostname\s*=\s*(%APPEND%|%INSERT%)?/, '').split(',').map((h) => h.trim()).filter(Boolean);
  const rules = body(sectionOf(text, 'Rule'));
  test(`${rel}: MITM 不包含 Apple / 银行 / 运营商 / 大 CDN 通配`, () => {
    for (const h of hosts) {
      const bare = h.replace(/^\*\./, '');
      assert(!PROTECTED.test(bare), `禁止解密: ${h}`);
      assert(!(h.startsWith('*.') && NO_WILDCARD.test(bare)), `禁止通配解密: ${h}`);
      assert(!/^\*\.[^.]+\.(com|cn|net)$/.test(h) || /^\*\.(ximalaya|mobileapi\.hupu|uve\.weibo)\./.test(h) || h === '*.ximalaya.com', `通配过宽: ${h}`);
      assert(h !== '*' && h !== '-*', `禁止全量解密: ${h}`);
    }
  });
  test(`${rel}: 每个被解密主机都有 QUIC→TCP 回落规则`, () => {
    if (!hosts.length) return;
    for (const h of hosts) assert(rules.includes(build.quicRule(h)), `缺少 QUIC 规则: ${h}`);
  });
  test(`${rel}: 不误杀关键域名`, () => {
    for (const l of rules) {
      const p = l.split(',');
      if (/^REJECT/.test(p[2] || '') && /^DOMAIN(-SUFFIX)?$/.test(p[0])) {
        assert(!NEVER_REJECT.includes(p[1]), `误杀风险: ${l}`);
        assert(!/(^|\.)(apple\.com|icloud\.com|mzstatic\.com|cdn-apple\.com)$/.test(p[1]) || /^(iad|iadsdk|iadcontent|iadmoo|advertising|api-adservices)\./.test(p[1]), `禁止拒绝 Apple: ${l}`);
      }
    }
  });
  test(`${rel}: HTTPS 重写 / 脚本主机均已解密`, () => {
    if (!hosts.length) return;
    const toRe = (h) => new RegExp('^' + h.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
    const hostRes = hosts.map(toRe);
    const lines = [...body(sectionOf(text, 'URL Rewrite')).map((l) => l.split(' ')[0]),
      ...body(sectionOf(text, 'Script')).map((l) => (l.match(/pattern=(.*?),script-path=/) || [])[1])];
    // 用样例 URL 验证：从正则中提取字面主机
    for (const pat of lines) {
      if (!/^\^https(\?)?:/.test(pat) && !/^\^https\?/.test(pat)) continue;
      const literal = pat.replace(/^\^https\??:\\\/\\\//, '').match(/^((?:[a-z0-9-]+|\\\.)+)\\\//i);
      if (!literal) continue;
      const h = literal[1].replace(/\\\./g, '.');
      assert(hostRes.some((re) => re.test(h)), `未解密主机: ${h} (${pat})`);
    }
  });
}

for (const rel of CONFS) {
  const text = files[rel];
  const rules = body(sectionOf(text, 'Rule'));
  test(`${rel}: 纯分流（不含任何去广告内容）`, () => {
    assert(!rules.some((l) => /,REJECT/.test(l)), '主配置不应包含 REJECT 规则');
    for (const sec of ['URL Rewrite', 'Script', 'MITM']) assert(!sectionOf(text, sec).length, `主配置不应包含 [${sec}]`);
    assert(text.includes('modules/adblock-ultimate.sgmodule'), '头部应提示添加去广告模块');
  });
  test(`${rel}: Apple 保护规则最先匹配`, () => {
    const firstApple = rules.findIndex((l) => l.startsWith('DOMAIN-SUFFIX,apple.com,'));
    assert(firstApple >= 0 && firstApple < 10, 'Apple 保护顺序错误');
  });
  test(`${rel}: 兜底顺序 GEOIP,CN → FINAL`, () => {
    const n = rules.length;
    assert(rules[n - 1].startsWith('FINAL,'), '最后一条应为 FINAL');
    assert(rules[n - 2] === 'GEOIP,CN,DIRECT', '倒数第二条应为 GEOIP,CN,DIRECT');
    assert(rules.filter((l) => l.startsWith('FINAL,')).length === 1, 'FINAL 只能有一条');
  });
  test(`${rel}: 引用的策略都存在`, () => {
    const groups = body(sectionOf(text, 'Proxy Group')).map((l) => l.split('=')[0].trim());
    const ok = new Set(['DIRECT', 'PROXY', 'REJECT', 'REJECT-IMG', 'REJECT-DICT', 'REJECT-200', ...groups]);
    for (const l of rules) {
      if (/^(AND|OR|NOT),/.test(l)) continue;
      const p = l.split(',');
      const pol = p[0] === 'FINAL' ? p[1] : p[2];
      assert(ok.has(pol), `未知策略 ${pol}: ${l}`);
    }
  });
  test(`${rel}: General 关键项`, () => {
    const g = sectionOf(text, 'General').join('\n');
    for (const k of ['dns-server = 223.5.5.5, 119.29.29.29', 'ipv6 = false', 'block-quic = all-proxy', 'dns-direct-system = true', 'compatibility-mode = 1', 'update-url = ']) {
      assert(g.includes(k), `缺少 ${k}`);
    }
  });
}

// ---------------------------------------------------------------- 脚本
const scriptDir = path.join(ROOT, 'modules/scripts');
for (const f of fs.readdirSync(scriptDir).filter((x) => x.endsWith('.js'))) {
  test(`scripts/${f}: 语法`, () => {
    execFileSync(process.execPath, ['--check', path.join(scriptDir, f)], { stdio: 'pipe' });
  });
}
test('header.js 已移除（无效脚本）', () => assert(!fs.existsSync(path.join(scriptDir, 'header.js')), 'header.js 仍存在'));

function run(file, { url, headers, responseBody }) {
  const code = fs.readFileSync(path.join(scriptDir, file), 'utf8');
  let result;
  let calls = 0;
  const ctx = {
    $request: { url, headers: headers || {} },
    $done: (v) => { calls++; if (calls === 1) result = v; },
    console,
  };
  if (responseBody !== undefined) ctx.$response = { body: responseBody, headers: {} };
  vm.runInNewContext(code, ctx, { timeout: 2000 });
  assert(calls >= 1, `${file} 没有调用 $done`);
  return result;
}
const fixture = (n) => fs.readFileSync(path.join(__dirname, 'fixtures', n), 'utf8');

test('酷安 init：删除 imageCard 开屏卡并关闭 SplashAd', () => {
  const out = run('coolapk.js', { url: 'https://api.coolapk.com/v6/main/init', responseBody: fixture('coolapk_init.json') });
  const data = JSON.parse(out.body).data;
  assert(!data.some((x) => x.entityTemplate === 'imageCard'), 'imageCard 仍在');
  const cfg = data.find((x) => String(x.entityId) === '6390');
  assert(cfg, '配置卡被误删');
  assert(cfg.extraDataArr['SplashAd.Type'] === '', 'SplashAd.Type 未清空');
  assert(cfg.extraDataArr['SplashAd.timeout'] === '0', 'SplashAd.timeout 未置 0');
  assert(cfg.extraDataArr['SplashAd.Expires'] >= 2147483647, 'Expires 未拉满');
  assert(cfg.extraDataArr['SplashAd.onResume'] === '0', 'onResume 未关闭');
  assert(cfg.entities.length === 2, 'Tab 配置被误删');
  assert(data.some((x) => x.entityTemplate === 'configCard' && String(x.entityId) === '20131'), '发现页 Tab 配置被误删');
});
test('酷安 init 请求：去掉 304 缓存头', () => {
  const out = run('coolapk.js', { url: 'https://api.coolapk.com/v6/main/init', headers: { 'If-None-Match': 'x', 'User-Agent': 'u' } });
  assert(out.headers && !out.headers['If-None-Match'] && out.headers['User-Agent'] === 'u', '缓存头未移除');
});
test('酷安首页：只删广告卡，不删正常动态', () => {
  const out = run('coolapk.js', { url: 'https://api.coolapk.com/v6/main/indexV8?page=1', responseBody: fixture('coolapk_index.json') });
  const data = JSON.parse(out.body).data;
  assert(data.length === 2 && data.every((x) => x.entityType === 'feed'), JSON.stringify(data.map((x) => x.entityTemplate)));
});
test('酷安：非 JSON 原样放行', () => {
  const out = run('coolapk.js', { url: 'https://api.coolapk.com/v6/main/indexV8', responseBody: '<html>' });
  assert(out && out.body === undefined, '应原样放行');
});
test('闲鱼首页：去广告 / 运营卡，保留商品', () => {
  const out = run('goofish.js', { url: 'https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/1.0/?data=x', responseBody: fixture('goofish_nextfresh.json') });
  const d = JSON.parse(out.body).data;
  assert(!d.bannerReturnDO && !d.widgetReturnDO, 'banner / widget 未删');
  assert(d.homeTopList.length === 0, 'homeTopList 未清空');
  assert(d.sections.length === 2 && d.sections.every((s) => s.data.cardTypeValue === 'Item'), JSON.stringify(d.sections));
});
test('闲鱼悬浮球：保留发布按钮', () => {
  const out = run('goofish.js', { url: 'https://acs.m.goofish.com/gw/mtop.taobao.idle.user.strategy.list/1.0/', responseBody: JSON.stringify({ data: { strategies: [{ type: 'POPUP' }, { type: 'BIZ_PUBLISH_BALL' }, { type: 'FLOAT_LAYER' }] } }) });
  const s = JSON.parse(out.body).data.strategies;
  assert(s.length === 1 && s[0].type === 'BIZ_PUBLISH_BALL', JSON.stringify(s));
});
test('闲鱼搜索：去阿里妈妈广告与底纹（search.shade 不被 search 抢先）', () => {
  const out = run('goofish.js', { url: 'https://g-acs.m.goofish.com/gw/mtop.taobao.idlemtopsearch.search/1.0/', responseBody: JSON.stringify({ data: { resultList: [
    { data: { item: { main: { exContent: { isAliMaMaAD: 'true' } } }, template: { name: 'a' } } },
    { data: { item: { main: { exContent: { isAliMaMaAD: 'false' } } }, template: { name: 'b' } } },
    { data: { template: { name: 'idlefish_search_card_category_select' } } }], topList: [1], resultPrefixBar: {} } }) });
  const d = JSON.parse(out.body).data;
  assert(d.resultList.length === 1 && d.topList.length === 0 && !d.resultPrefixBar, JSON.stringify(d));
  const shade = run('goofish.js', { url: 'https://acs.m.goofish.com/gw/mtop.taobao.idlemtopsearch.search.shade/1.0/', responseBody: JSON.stringify({ data: { words: [1] } }) });
  assert(JSON.stringify(JSON.parse(shade.body).data) === '{}', '底纹未清空');
});
test('闲鱼：异常响应原样放行', () => {
  for (const b of ['', 'not json', '{"data":null}', '{"data":{"sections":"x"}}']) {
    const out = run('goofish.js', { url: 'https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/1.0/', responseBody: b });
    assert(out !== undefined, `未调用 $done: ${b}`);
  }
});
test('闲鱼：AMDC 调度按 UA 拒绝', () => {
  for (const rel of ['modules/adblock-ultimate.sgmodule', 'modules/goofish.sgmodule']) {
    const rules = body(sectionOf(files[rel], 'Rule'));
    assert(rules.some((l) => l.includes('amdc') && l.includes('%E9%97%B2%E9%B1%BC')), `${rel} 缺少闲鱼 AMDC 规则`);
  }
});
test('去广告总模块包含全部 App 的重写 / 脚本 / MITM', () => {
  const text = files['modules/adblock-ultimate.sgmodule'];
  for (const u of build.loadApps()) {
    for (const r of u.rewrites || []) assert(text.includes(r), `${u.id} 重写缺失: ${r}`);
    for (const sc of u.scripts || []) assert(text.includes(`${sc.name} = `), `${u.id} 脚本缺失: ${sc.name}`);
    for (const h of u.mitm || []) assert(text.includes(h), `${u.id} MITM 缺失: ${h}`);
  }
});

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
