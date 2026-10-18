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
  test(`${rel}: Body Rewrite 格式正确（http-response-jq + 单引号 jq，每步 try/catch）`, () => {
    for (const l of body(sectionOf(text, 'Body Rewrite'))) {
      const m = l.match(/^http-response-jq (\S+) '([^']+)'$/);
      assert(m, `格式错误: ${l.slice(0, 120)}`);
      new RegExp(m[1]);
      assert(m[2].startsWith('(. as $o | try ('), `jq 未包裹 try/catch: ${l.slice(0, 120)}`);
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
  const allHosts = mitmLine.replace(/^hostname\s*=\s*(%APPEND%|%INSERT%)?/, '').split(',').map((h) => h.trim()).filter(Boolean);
  const hosts = allHosts.filter((h) => !h.startsWith('-'));
  const excludes = allHosts.filter((h) => h.startsWith('-'));
  const rules = body(sectionOf(text, 'Rule'));
  test(`${rel}: MITM 不包含 Apple / 银行 / 运营商 / 大 CDN 通配`, () => {
    for (const h of hosts) {
      const bare = h.replace(/^\*\./, '');
      // 唯一例外：公众号文章 mp.weixin.qq.com（精确主机，不含聊天 / 支付）
      assert(!PROTECTED.test(bare) || h === 'mp.weixin.qq.com', `禁止解密: ${h}`);
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
      ...body(sectionOf(text, 'Script')).map((l) => (l.match(/pattern=(.*?),script-path=/) || [])[1]),
      ...body(sectionOf(text, 'Body Rewrite')).map((l) => l.split(' ')[1])];
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
    for (const sec of ['URL Rewrite', 'Body Rewrite', 'Script', 'MITM']) assert(!sectionOf(text, sec).length, `主配置不应包含 [${sec}]`);
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

// ---------------------------------------------------------------- 分流（用户应用清单 / 冲突 / 遮蔽）
function ipInCidr(ip, cidr) {
  const [net, bits] = cidr.split('/');
  const n = (s) => s.split('.').reduce((a, x) => a * 256 + Number(x), 0);
  const size = 2 ** (32 - Number(bits));
  return Math.floor(n(ip) / size) === Math.floor(n(net) / size);
}
// 只模拟能离线判断的规则；RULE-SET（远程）/ IP-ASN / GEOIP 之类都跳过，所以命中的一定是我们自己写的显式规则
function routeOf(rules, host) {
  const h = host.toLowerCase();
  const isIp = /^\d+\.\d+\.\d+\.\d+$/.test(h);
  for (const l of rules) {
    const p = l.split(',');
    const [type, value, policy] = [p[0], (p[1] || '').toLowerCase(), p[2]];
    if (isIp) {
      if (type === 'IP-CIDR' && ipInCidr(h, value)) return { policy, rule: l };
      continue;
    }
    if ((type === 'DOMAIN' && h === value) || (type === 'DOMAIN-SUFFIX' && (h === value || h.endsWith(`.${value}`))) || (type === 'DOMAIN-KEYWORD' && h.includes(value))) {
      return { policy, rule: l };
    }
  }
  return null;
}
const appRouting = JSON.parse(read('tests/fixtures/app-routing.json'));
{
  const rules = body(sectionOf(files['Shadowrocket_AllInOne_Ultimate.conf'], 'Rule'));
  for (const { app, expect, hosts } of appRouting.apps) {
    test(`应用分流：${app} → ${expect}`, () => {
      for (const host of hosts) {
        const r = routeOf(rules, host);
        assert(r, `${host} 没有命中任何显式规则`);
        assert(r.policy === expect, `${host} 命中 ${r.rule}，应为 ${expect}`);
      }
    });
  }
  test('应用分流：GEOIP 兜底名单只用于没有固定域名的国内 App', () => {
    const named = new Set(appRouting.apps.map((a) => a.app));
    for (const a of appRouting.geoipOnly) assert(!named.has(a), `${a} 同时出现在显式清单和 GEOIP 名单`);
    assert(rules.includes('GEOIP,CN,DIRECT'), '缺少 GEOIP,CN,DIRECT');
  });
}
for (const rel of CONFS) {
  const rules = body(sectionOf(files[rel], 'Rule'));
  test(`${rel}: 同一域名 / IP 不出现互相矛盾的策略`, () => {
    const seen = new Map();
    for (const l of rules) {
      const p = l.split(',');
      if (!/^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6|IP-ASN)$/.test(p[0])) continue;
      const k = `${p[0]},${p[1].toLowerCase()}`;
      if (seen.has(k)) assert(seen.get(k).split(',')[2] === p[2], `冲突: ${l} ↔ ${seen.get(k)}`);
      else seen.set(k, l);
    }
  });
  test(`${rel}: 没有被前面更宽的后缀规则遮蔽的不同策略规则`, () => {
    const suffixes = [];
    for (const l of rules) {
      const p = l.split(',');
      if (p[0] !== 'DOMAIN' && p[0] !== 'DOMAIN-SUFFIX') continue;
      const d = p[1].toLowerCase();
      const parent = suffixes.find((s) => d === s.d || d.endsWith(`.${s.d}`));
      assert(!parent || parent.policy === p[2], `${l} 永远不会生效（被 ${parent && parent.line} 先命中）`);
      if (p[0] === 'DOMAIN-SUFFIX') suffixes.push({ d, policy: p[2], line: l });
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
test('阿里系 AMDC：全局阻断明文调度与调度域名，支付宝不受影响', () => {
  for (const rel of ['modules/adblock-ultimate.sgmodule', 'modules/adblock.sgmodule', 'modules/goofish.sgmodule']) {
    const rules = body(sectionOf(files[rel], 'Rule'));
    const amdc = rules.indexOf('URL-REGEX,"^http:\\/\\/.+\\/amdc\\/mobileDispatch",REJECT');
    assert(amdc >= 0, `${rel} 缺少 AMDC 全局规则`);
    assert(rules.includes('DOMAIN,amdc.m.taobao.com,REJECT'), `${rel} 缺少 amdc.m.taobao.com`);
    assert(!rules.some((l) => l.includes('amdc') && l.includes('USER-AGENT')), `${rel} 仍有按 UA 的 AMDC 规则（UA 匹配不可靠）`);
    assert(!rules.some((l) => /amdc\.alipay\.com/.test(l) && /REJECT/.test(l)), `${rel} 不应拒绝支付宝 AMDC`);
    if (rel !== 'modules/goofish.sgmodule') {
      const ali = rules.indexOf('DOMAIN-SUFFIX,alipay.com,DIRECT');
      assert(ali >= 0 && ali < amdc, `${rel} 支付宝直连保护应在 AMDC 规则之前`);
    }
  }
});
test('去广告总模块包含全部 App 的重写 / 脚本 / MITM', () => {
  const text = files['modules/adblock-ultimate.sgmodule'];
  for (const u of build.loadApps()) {
    for (const r of u.rewrites || []) assert(text.includes(r), `${u.id} 重写缺失: ${r}`);
    for (const sc of u.scripts || []) assert(text.includes(`${sc.name} = `), `${u.id} 脚本缺失: ${sc.name}`);
    for (const b of u.bodyRewrites || []) assert(text.includes(build.bodyLine(b)), `${u.id} Body Rewrite 缺失: ${b.pattern}`);
    for (const h of u.mitm || []) assert(text.includes(h), `${u.id} MITM 缺失: ${h}`);
  }
});

// ---------------------------------------------------------------- Body Rewrite（jq）
let JQ = null;
try {
  execFileSync('jq', ['--version'], { stdio: 'pipe' });
  JQ = 'jq';
} catch (e) {
  console.warn('⚠ 未安装 jq，跳过 jq 语法与行为测试');
}
function jq(expr, inputs) {
  const out = execFileSync(JQ, ['-c', expr], { input: inputs.map((x) => JSON.stringify(x)).join('\n'), stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  return out ? out.split('\n').map((l) => JSON.parse(l)) : [];
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const allBodies = build.loadApps().flatMap((u) => (u.bodyRewrites || []).map((b) => ({ unit: u.id, ...b })));
function bodyOf(unit, includes) {
  const b = allBodies.find((x) => x.unit === unit && x.pattern.includes(includes));
  assert(b, `找不到 ${unit} 的 Body Rewrite: ${includes}`);
  return build.jqExpr(b.jq);
}
test('Body Rewrite：同一接口只有一条（避免重复改写）', () => {
  const seen = new Set();
  for (const b of allBodies) {
    assert(!seen.has(b.pattern), `重复的 Body Rewrite: ${b.pattern}`);
    seen.add(b.pattern);
  }
});
if (JQ) {
  test('Body Rewrite：jq 语法有效；异常 / 无关输入原样返回且只输出一个结果', () => {
    const inputs = [{ foo: 1 }, [], 'x', { data: null, result: 1, respData: 'x' }];
    for (const b of allBodies) {
      const steps = Array.isArray(b.jq) ? b.jq : [b.jq];
      const constant = steps.length === 1 && steps[0].trim().startsWith('{');
      let out;
      try {
        out = jq(build.jqExpr(b.jq), inputs);
      } catch (e) {
        throw new Error(`${b.unit} jq 执行失败: ${b.pattern}\n    ${String(e.stderr || e.message).trim()}`);
      }
      assert(out.length === inputs.length, `${b.unit} 输出数量异常: ${b.pattern}`);
      // 前三个输入与任何接口都无关，必须原样返回；第四个只要求不报错
      if (!constant) inputs.slice(0, 3).forEach((x, i) => assert(same(out[i], x), `${b.unit} 无关输入被改动: ${b.pattern} → ${JSON.stringify(out[i])}`));
    }
  });
  const cases = [
    ['闲鱼 magic 首页：删除 topList', 'goofish', 'magic', { data: { topList: [1], sections: [2] } }, { data: { sections: [2] } }],
    ['网盘金刚区：去掉小说 / 短剧，保留文件入口', 'baidunetdisk', 'kingkong', { data: { data: [{ type: 'novel' }, { type: 'file' }, { type: 'shortplay' }] } }, { data: { data: [{ type: 'file' }] } }],
    ['京东首页：去悬浮 / 通栏 / 二楼，保留推荐', 'jd', 'welcomeHome', { floorList: [{ type: 'float' }, { type: 'recommend' }, { type: 'topRotate' }], webViewFloorList: [1] }, { floorList: [{ type: 'recommend' }], webViewFloorList: [] }],
    ['京东开屏：清空素材', 'jd', 'start(', { images: [1], showTimesDaily: 3, other: 1 }, { images: [], showTimesDaily: 0, other: 1 }],
    ['拼多多订单列表：去成长提示，异常订单原样', 'pdd', 'order_list_v4', { orders: [{ order_buttons: [{ order_growth_tip: 1, text: 'a' }] }, { x: 1 }] }, { orders: [{ order_buttons: [{ text: 'a' }] }, { x: 1 }] }],
    ['转转更多工具：去活动 / 金融分组与免流量特权', 'zhuanzhuan', 'getmymoretools', { respData: { groupList: [{ groupName: '活动参与' }, { groupName: '常用', items: [{ name: '免流量特权' }, { name: '设置' }] }] } }, { respData: { groupList: [{ groupName: '常用', items: [{ name: '设置' }] }] } }],
    ['滴滴个人中心：只留基础卡片与优惠卡券', 'didi', 'usercenter', { data: { instances: { center_base_info_card: {}, ad_card: {}, center_wallet_finance_card: { data: { view_info: [{ title: '优惠卡券' }, { title: '借钱' }] } } } } }, { data: { instances: { center_base_info_card: {}, center_wallet_finance_card: { data: { view_info: [{ title: '优惠卡券' }] } } } } }],
    ['斗鱼云控：只改已存在的开关', 'douyu', 'venus', { bringGoodsSwitch: 1, other: 1 }, { bringGoodsSwitch: 0, other: 1 }],
    ['夸克云控：删广告字段，保留功能字段', 'quark', 'open-cms', { result: { cms_lottery_banner: 1, cms_search_page_config: 2 } }, { result: { cms_search_page_config: 2 } }],
    ['贴吧搜索首页：返回成功空结果', 'tieba', 'startPage', { data: { hot: [1] } }, { no: 0, error: 'success' }],
  ];
  for (const [name, unit, inc, input, expected] of cases) {
    test(`Body Rewrite 行为：${name}`, () => {
      const [out] = jq(bodyOf(unit, inc), [input]);
      assert(same(out, expected), JSON.stringify(out));
    });
  }
  test('Body Rewrite 行为：贴吧我的页面（部分字段缺失时其余步骤照常生效）', () => {
    const input = { vip_banner: {}, user: { consume_info: 1, shake_ad_switch: { is_show: 1 }, name: 'a' }, custom_grid: [{ title: '游戏大厅' }, { title: '我的收藏' }],
      zone_info: [{ type: 'commerce' }, { type: 'normal', common_func: { common_func_noraml: [{ name: '创建智能体' }, { name: '历史' }] } }] };
    const [out] = jq(bodyOf('tieba', 'profile'), [input]);
    assert(!('vip_banner' in out) && !('consume_info' in out.user) && out.user.name === 'a' && out.user.shake_ad_switch.is_show === 0, JSON.stringify(out));
    assert(same(out.custom_grid, [{ title: '我的收藏' }]), JSON.stringify(out.custom_grid));
    assert(same(out.zone_info, [{ type: 'normal', common_func: { common_func_noraml: [{ name: '历史' }] } }]), JSON.stringify(out.zone_info));
    const [partial] = jq(bodyOf('tieba', 'profile'), [{ vip_banner: 1, custom_grid: 'x' }]);
    assert(same(partial, { custom_grid: 'x' }), JSON.stringify(partial));
  });
  test('Body Rewrite 行为：淘宝开屏素材失效，其它区块不动', () => {
    const input = { data: { containers: { splash_home_base: { base: { sections: [
      { bizData: { 'taobao-splash': { data: [{ imgUrl: 'u', waitTime: '3', coldStart: 'true', id: 7 }] } } }, { bizData: { other: 1 } }] } } } } };
    const [out] = jq(bodyOf('taobao', 'splash'), [input]);
    const [a, b] = out.data.containers.splash_home_base.base.sections;
    const item = a.bizData['taobao-splash'].data[0];
    assert(item.imgUrl === '' && item.waitTime === '0' && item.coldStart === 'false' && item.hotStart === 'false' && item.gmtStart.startsWith('2090') && item.id === 7, JSON.stringify(item));
    assert(same(b, { bizData: { other: 1 } }), JSON.stringify(b));
  });
}

test('贴吧 sync：删除开屏 / 悬浮 / 弹窗配置，广告条数置 0，只改已有键', () => {
  const input = { error_code: 0, next_start: { a: 1 }, floating_icon: {}, scheme_whitelist: [1], user_growth_task_list: [1],
    wl_config: { home_ad_num: 5, frs_ad_num: 3, download_edge_float: 1, keep: 1 },
    config: { switch: [{ name: 'platform_csj_init', type: '1' }, { name: 'x', type: '1' }] } };
  const out = JSON.parse(run('tieba-json.js', { url: 'https://tiebac.baidu.com/c/s/sync', responseBody: JSON.stringify(input) }).body);
  for (const k of ['next_start', 'floating_icon', 'scheme_whitelist', 'user_growth_task_list']) assert(!(k in out), `${k} 未删除`);
  assert(out.error_code === 0, 'error_code 被误删');
  assert(out.wl_config.home_ad_num === 0 && out.wl_config.frs_ad_num === 0 && out.wl_config.keep === 1, JSON.stringify(out.wl_config));
  assert(!('download_edge_float' in out.wl_config) && !('pb_comment_ad_num' in out.wl_config), JSON.stringify(out.wl_config));
  assert(out.config.switch[0].type === '0' && out.config.switch[1].type === '1', JSON.stringify(out.config.switch));
});

// ---------------------------------------------------------------- 关键服务保护
const CRITICAL_MUST = ['12306.cn', 'gov.cn', 'alipay.com', 'tenpay.com', 'unionpay.com', 'icbc.com.cn', 'ccb.com', 'cmbchina.com', '10086.cn', '3gppnetwork.org', 'anticheatexpert.com'];
test('关键服务：主配置在 Apple 规则之后、任何分流规则之前直连', () => {
  for (const rel of ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf']) {
    const rules = body(sectionOf(files[rel], 'Rule'));
    const firstRouting = rules.findIndex((l) => l.startsWith('DOMAIN-SUFFIX,jsdelivr.net'));
    for (const d of CRITICAL_MUST) {
      const i = rules.indexOf(`DOMAIN-SUFFIX,${d},DIRECT`);
      assert(i >= 0 && i < firstRouting + 80, `${rel} 缺少或过晚: ${d}`);
    }
    assert(rules.includes('DOMAIN,pay.weixin.qq.com,DIRECT'), `${rel} 缺少微信支付`);
  }
});
test('关键服务：写入 skip-proxy，QQ 快捷登录 / Wi-Fi 通话 / 游戏使用真实 IP', () => {
  for (const rel of ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf']) {
    const skip = (files[rel].match(/^skip-proxy = (.*)$/m) || [])[1].split(', ');
    const real = (files[rel].match(/^always-real-ip = (.*)$/m) || [])[1].split(', ');
    for (const d of CRITICAL_MUST) assert(skip.includes(`*.${d}`), `${rel} skip-proxy 缺少 *.${d}`);
    for (const d of ['localhost.ptlogin2.qq.com', '*.3gppnetwork.org', '*.xboxlive.com', 'stun.*.*']) assert(real.includes(d), `${rel} always-real-ip 缺少 ${d}`);
  }
});
test('关键服务：去广告模块中保护段先于 AWAvenue，且之后不再有针对关键域名的拒绝规则', () => {
  for (const rel of ['modules/adblock-ultimate.sgmodule', 'modules/adblock.sgmodule', 'modules/awavenue.sgmodule']) {
    const rules = body(sectionOf(files[rel], 'Rule'));
    const aw = rules.findIndex((l) => l.startsWith('RULE-SET,') && l.includes('AWAvenue'));
    const guard = rules.indexOf('DOMAIN-SUFFIX,12306.cn,DIRECT');
    assert(guard >= 0 && guard < aw, `${rel} 保护段不在 AWAvenue 之前`);
    const suffixes = rules.slice(0, aw).filter((l) => /,DIRECT$/.test(l)).map((l) => l.split(','));
    for (const l of rules.slice(guard)) {
      const p = l.split(',');
      if (!/^DOMAIN(-SUFFIX)?$/.test(p[0]) || !/^REJECT/.test(p[2] || '')) continue;
      const hit = suffixes.some(([t, d]) => (t === 'DOMAIN' ? p[1] === d : p[1] === d || p[1].endsWith(`.${d}`)));
      assert(!hit, `${rel} 拒绝规则被保护段遮蔽（应提前）: ${l}`);
    }
  }
  const ult = body(sectionOf(files['modules/adblock-ultimate.sgmodule'], 'Rule'));
  assert(ult.indexOf('DOMAIN,ad.12306.cn,REJECT') >= 0 && ult.indexOf('DOMAIN,ad.12306.cn,REJECT') < ult.indexOf('DOMAIN-SUFFIX,12306.cn,DIRECT'), '12306 广告拒绝应在保护段之前');
});
test('关键服务：去广告总模块 MITM 排除关键域名，且解密列表不与之冲突', () => {
  const line = body(sectionOf(files['modules/adblock-ultimate.sgmodule'], 'MITM')).find((l) => l.startsWith('hostname'));
  const all = line.replace(/^hostname\s*=\s*%APPEND%\s*/, '').split(', ');
  const ex = all.filter((h) => h.startsWith('-')).map((h) => h.slice(1));
  for (const d of CRITICAL_MUST) assert(ex.includes(`*.${d}`), `缺少 MITM 排除: -*.${d}`);
  assert(ex.includes('pay.weixin.qq.com'), '缺少 MITM 排除: -pay.weixin.qq.com');
  const toRe = (h) => new RegExp('^' + h.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
  for (const h of all.filter((x) => !x.startsWith('-'))) {
    const sample = h.replace(/\*/g, 'x');
    assert(!ex.some((e) => toRe(e).test(sample)), `解密主机落入排除范围: ${h}`);
  }
});

console.log(`\n${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
