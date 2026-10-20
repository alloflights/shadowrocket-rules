#!/usr/bin/env node
/**
 * v3 构建脚本：src/ 是唯一数据源，生成两个主配置与全部模块。
 *   node scripts/build.js          生成
 *   node scripts/build.js --check  只校验产物是否最新（CI / npm test 用）
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const meta = require(path.join(SRC, 'meta.js'));
const profile = require(path.join(SRC, 'profile.js'));
const apple = require(path.join(SRC, 'apple.js'));
const loon = require(path.join(SRC, 'loon.js'));
const buildLoon = require('./loon.js');

const SCRIPT_BASE = `${meta.cdn}/modules/scripts`;
const AWAVENUE_RULE = `RULE-SET,${meta.awavenue},REJECT`;

// ---------------------------------------------------------------- 读取数据源
function readList(name) {
  return fs.readFileSync(path.join(SRC, 'rules', name), 'utf8').replace(/\r/g, '').split('\n').map((l) => l.trimEnd());
}
function listFiles() {
  return fs.readdirSync(path.join(SRC, 'rules')).filter((f) => f.endsWith('.list')).sort();
}
function loadApps() {
  const dir = path.join(SRC, 'apps');
  const units = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js')).sort()) {
    delete require.cache[require.resolve(path.join(dir, f))];
    const mod = require(path.join(dir, f));
    for (const u of Array.isArray(mod) ? mod : [mod]) units.push(u);
  }
  const ids = new Set();
  const names = new Set();
  for (const u of units) {
    if (ids.has(u.id)) throw new Error(`重复的 app id: ${u.id}`);
    ids.add(u.id);
    for (const s of u.scripts || []) {
      if (names.has(s.name)) throw new Error(`重复的脚本名: ${s.name}`);
      names.add(s.name);
    }
  }
  return units;
}

// ---------------------------------------------------------------- 行生成
function scriptLine(s) {
  const parts = [`type=http-${s.type}`, `pattern=${s.pattern}`, `script-path=${SCRIPT_BASE}/${s.script}`];
  if (s.type === 'response') {
    parts.push('requires-body=1', `max-size=${s.maxSize || 1048576}`);
    if (s.binary) parts.push('binary-body-mode=1');
  } else {
    parts.push('requires-body=0');
  }
  parts.push(`timeout=${s.timeout || 10}`, 'script-update-interval=86400');
  return `${s.name} = ${parts.join(',')}`;
}

// 被解密的主机若走 QUIC(UDP/443) 会绕过重写与脚本；直连连接不受 block-quic=all-proxy 影响，
// 所以只对这些主机拒绝 UDP/443，让 App 立即回落到 TCP，不影响其它任何直连流量的 QUIC。
function quicRule(host) {
  let matcher;
  if (host.startsWith('*.')) matcher = `DOMAIN-SUFFIX,${host.slice(2)}`;
  else if (host.includes('*')) matcher = `DOMAIN-SUFFIX,${host.slice(host.indexOf('.', host.indexOf('*')) + 1)}`;
  else matcher = `DOMAIN,${host}`;
  return `AND,((PROTOCOL,UDP),(DST-PORT,443),(${matcher})),REJECT`;
}

function uniq(arr) {
  return [...new Set(arr)];
}

function mitmHosts(units) {
  return uniq(units.flatMap((u) => u.mitm || []));
}

function quicRules(units) {
  return uniq(mitmHosts(units).map(quicRule));
}

// 去重：同一条规则只保留第一次出现（注释与空行原样保留）
function dedupe(lines) {
  const seen = new Set();
  const out = [];
  for (const l of lines) {
    const t = l.trim();
    if (t && !t.startsWith('#')) {
      if (seen.has(t)) continue;
      seen.add(t);
    }
    out.push(l);
  }
  // 折叠多余空行
  return out.filter((l, i) => !(l === '' && (i === 0 || out[i - 1] === '')));
}

function mapPolicy(line, map) {
  const t = line.trim();
  if (!t || t.startsWith('#')) return line;
  if (/^(AND|OR|NOT),/.test(t)) return line;
  const p = t.split(',');
  if (p[0] === 'FINAL') return map[p[1]] ? `FINAL,${map[p[1]]}` : line;
  if (p.length >= 3 && map[p[2]]) {
    p[2] = map[p[2]];
    return p.join(',');
  }
  return line;
}

function section(title) {
  return [`# ==================== ${title} ====================`];
}

// ---------------------------------------------------------------- [Rule]
function adblockRules(units) {
  return [
    ...section('去广告 · AWAvenue 秋风广告规则（上游实时更新）'),
    AWAVENUE_RULE,
    ...section('去广告 · 广告联盟 / 遥测 / HTTPDNS'),
    ...readList('10-adblock.list'),
    ...section('去广告 · App 专项'),
    ...units.flatMap((u) => ((u.rules || []).length ? [`# ${u.name}`, ...u.rules] : [])),
  ];
}

// 关键服务保护：模块规则优先于主配置规则，所以去广告模块里也要先放一遍关键服务直连，
// 防止 AWAvenue 等上游规则误杀 12306 / 银行 / 支付 / 政务。我们自己维护、已验证的精确广告拒绝规则
// （如 ad.12306.cn）提到保护段之前，继续生效。
function underCritical(domain) {
  return profile.CRITICAL.some((c) => (c.type === 'DOMAIN' ? domain === c.domain : domain === c.domain || domain.endsWith(`.${c.domain}`)));
}
function criticalGuard(rejectLines) {
  const early = rejectLines.filter((l) => {
    const p = l.trim().split(',');
    return /^DOMAIN(-SUFFIX)?$/.test(p[0]) && /^REJECT/.test(p[2] || '') && underCritical(p[1]);
  });
  const direct = readList('05-critical.list').filter((l) => /^DOMAIN(-SUFFIX)?,/.test(l.trim()));
  return [...section('关键服务保护（先于第三方广告规则，防止误杀登录 / 支付 / 购票）'), ...early, ...direct];
}
function mitmExcludes() {
  return profile.CRITICAL.flatMap((c) => c.type === 'DOMAIN'
    ? [`-${c.domain}`] : [`-${c.domain}`, `-*.${c.domain}`]);
}

// 主配置只负责分流；去广告（拒绝规则 / 重写 / 脚本 / MITM）全部在 adblock-ultimate 模块里
function confRules(policyMap, { appleProtection = true } = {}) {
  const routing = listFiles().filter((f) => !/^(00|10)-/.test(f)).flatMap((f) => ['', ...readList(f)]);
  let lines = [...readList('00-protect.list'), ...routing];
  if (appleProtection) lines = apple.protect(lines);
  if (policyMap) lines = lines.map((l) => mapPolicy(l, policyMap));
  return dedupe(lines);
}

// ---------------------------------------------------------------- 重写 / 脚本 / MITM
// 阿里系 AMDC 调度：App 常用 HTTPDNS / 缓存的 IP 直连 80 端口，Shadowrocket 在建立连接时只看到 IP，
// DOMAIN / URL-REGEX 规则都匹配不到（实测命中 GEOIP,CN）。明文 HTTP 的 URL 重写在解析请求后执行、与 IP 无关，
// 所以再用一条 URL Rewrite 兜底。排除支付宝（主机含 alipay）。
const AMDC_RULE = 'URL-REGEX,"^http:\\/\\/.+\\/amdc\\/mobileDispatch",REJECT';
const AMDC_REWRITE = '^http:\\/\\/(?![^\\/]*alipay)[^\\/]+\\/amdc\\/mobileDispatch - reject';
const usesAmdc = (u) => (u.rules || []).includes(AMDC_RULE);
function rewriteBody(units) {
  return ['# --- 阿里系 AMDC 调度（IP 直连兜底） ---', AMDC_REWRITE, '', ...rewriteBodyUnits(units)];
}
function rewriteBodyUnits(units) {
  return units
    .filter((u) => (u.rewrites || []).length)
    .flatMap((u) => [`# --- ${u.name} ---`, ...u.rewrites, '']);
}
// [Body Rewrite]：http-response-jq。每一步单独 try/catch，字段缺失或结构变化时原样返回该步之前的结果，
// 绝不会因为某个接口改版而让 App 收到报错或空数据。jq 表达式用单引号包裹，所以表达式里不能出现单引号。
function jqExpr(jq) {
  const steps = Array.isArray(jq) ? jq : [jq];
  for (const s of steps) if (s.includes("'")) throw new Error(`jq 表达式不能包含单引号: ${s}`);
  return steps.map((s) => `(. as $o | try (${s}) catch $o)`).join(' | ');
}
function bodyLine(b) {
  return `http-response-jq ${b.pattern} '${jqExpr(b.jq)}'`;
}
function bodyRewriteBody(units) {
  return units
    .filter((u) => (u.bodyRewrites || []).length)
    .flatMap((u) => [`# --- ${u.name} ---`, ...u.bodyRewrites.map(bodyLine), '']);
}
function scriptBody(units) {
  return units
    .filter((u) => (u.scripts || []).length)
    .flatMap((u) => [`# --- ${u.name} ---`, ...u.scripts.map(scriptLine), '']);
}

// ---------------------------------------------------------------- 配置文件
function confHeader(title, file, lines) {
  return [
    '# ==============================================================================',
    `# ${title}  v${meta.shadowrocketVersion || meta.version}`,
    '# 本文件由 scripts/build.js 根据 src/ 自动生成，请勿直接修改；修改 src/ 后执行 npm run build。',
    `# 订阅地址：${meta.cdn}/${file}`,
    ...lines.map((l) => `# ${l}`),
    '#',
    '# 本配置只做分流，不含任何去广告内容。去广告请另外添加模块（配置 > 模块 > 右上角 +）：',
    `#   ${meta.cdn}/modules/adblock-ultimate.sgmodule`,
    '# 去广告模块需要 HTTPS 解密：配置文件 ⓘ > HTTPS 解密 > 证书 > 生成新的 CA 证书 > 安装证书，',
    '#   再到 设置 > 通用 > 关于本机 > 证书信任设置 中信任该证书。',
    '# ==============================================================================',
    '',
  ];
}

function buildConf({ file, title, desc, groups, policyMap }) {
  const out = [
    ...confHeader(title, file, desc),
    profile.general(`${meta.cdn}/${file}`),
  ];
  if (groups) out.push('[Proxy]', '', profile.proxyGroups);
  out.push(
    '[Rule]',
    ...confRules(policyMap),
    '',
    profile.host,
  );
  return out.join('\n');
}

// ---------------------------------------------------------------- 模块
function moduleText({ name, desc, author, category, rules, rewrites, bodyRewrites, scripts, mitm }) {
  const out = [
    `#!name=${name}`,
    `#!desc=${desc}`,
    `#!author=${author || 'alloflights'}`,
    `#!homepage=https://github.com/${meta.repo}`,
    `#!category=${category || '去广告'}`,
    '#!system=ios',
    `# v${meta.shadowrocketVersion || meta.version} · 由 scripts/build.js 自动生成，请勿直接修改`,
    '',
  ];
  if (rules && rules.length) out.push('[Rule]', ...rules, '');
  if (rewrites && rewrites.length) out.push('[URL Rewrite]', ...rewrites, '');
  if (bodyRewrites && bodyRewrites.length) out.push('[Body Rewrite]', ...bodyRewrites, '');
  if (scripts && scripts.length) out.push('[Script]', ...scripts, '');
  if (mitm && mitm.length) out.push('[MITM]', `hostname = %APPEND% ${mitm.join(', ')}`, '');
  return out.join('\n').replace(/\n+$/, '\n');
}

function buildModules() {
  // SR 中模块规则先于主配置；公众号只按广告接口拒绝，不封 wxs.qq.com 整个资源域。
  const units = loadApps().map((u) => Array.isArray(u.shadowrocketRules)
    ? { ...u, rules: u.shadowrocketRules } : u);
  const files = {};
  for (const u of units) {
    if (u.moduleFile === false) continue;
    files[`modules/${u.id}.sgmodule`] = moduleText({
      name: u.name,
      desc: u.desc,
      author: u.author,
      category: u.category,
      rules: dedupe([...(usesAmdc(u) ? criticalGuard(u.rules || []) : []), ...(u.mitm || []).map(quicRule), ...(u.rules || [])]),
      rewrites: usesAmdc(u) ? [AMDC_REWRITE, ...(u.rewrites || [])] : u.rewrites,
      bodyRewrites: (u.bodyRewrites || []).map(bodyLine),
      scripts: (u.scripts || []).map(scriptLine),
      mitm: u.mitm,
    });
  }
  files['modules/adblock-ultimate.sgmodule'] = moduleText({
    name: '全量去广告 (AdBlock Ultimate)',
    desc: '与主配置配套的去广告总模块：AWAvenue + 广告联盟/遥测/HTTPDNS/阿里 AMDC 拦截 + 全部 App 专项去广告（闲鱼、淘宝、京东、拼多多、滴滴、酷安、知乎、微博、B站、小红书、贴吧、网盘、高德、斗鱼、夸克、转转、微店、公众号等）。已包含同源生成的 App 与浏览增强模块，请勿重复叠加；抖音 / TikTok / 微信 / BoxJS 等静态模块独立按需开启。需开启 HTTPS 解密。',
    category: '去广告',
    rules: dedupe([...apple.guardRules(), ...section('HTTPS 解密主机 QUIC 回落 TCP'), ...quicRules(units), ...criticalGuard(adblockRules(units)), ...adblockRules(units)]),
    rewrites: rewriteBody(units),
    bodyRewrites: bodyRewriteBody(units),
    scripts: scriptBody(units),
    // 末尾追加关键服务排除（-*.域名），即使叠加了其它带通配解密的模块，也不会解密银行 / 支付 / 12306 / 政务
    mitm: [...mitmHosts(units), ...mitmExcludes(), ...apple.mitmExcludes()],
  });
  files['modules/adblock.sgmodule'] = moduleText({
    name: '广告联盟拦截 (AdBlock Lite)',
    desc: '仅分流层拦截：AWAvenue 秋风规则 + 穿山甲 / 优量汇 / 百青藤 / 快手 / Sigmob 等广告联盟与遥测。无需 HTTPS 解密，零额外延迟。',
    category: '去广告',
    rules: dedupe([...apple.guardRules(), ...criticalGuard(readList('10-adblock.list')), AWAVENUE_RULE, ...readList('10-adblock.list')]),
  });
  files['modules/awavenue.sgmodule'] = moduleText({
    name: 'AWAvenue 秋风广告规则',
    desc: '直接引用上游 TG-Twilight/AWAvenue-Ads-Rule 规则集（自动更新，不再内置过期副本）。',
    author: 'TG-Twilight',
    category: '去广告',
    rules: [...apple.guardRules(), ...criticalGuard([]), AWAVENUE_RULE],
  });
  const toProxy = (l) => mapPolicy(l, profile.AIO_POLICY);
  files['modules/ai-services.sgmodule'] = moduleText({
    name: 'AI 服务分流',
    desc: 'OpenAI / Claude / Gemini / Meta AI / Grok / Perplexity / Cursor 等走代理，国内大模型直连。',
    category: '分流',
    rules: dedupe(readList('20-ai.list').map(toProxy)),
  });
  files['modules/overseas-top500.sgmodule'] = moduleText({
    name: '海外常用应用与网站分流',
    desc: '海外资讯、学术、开发者云服务、流媒体、Edge / 必应与常见海外 TLD 走代理；Klook / Adobe / Canva / Zoom / Notion / Xmind 等国内可直连的境外品牌直连。',
    category: '分流',
    rules: dedupe(['30-academic.list', '40-overseas-apps.list', '50-dev-cloud.list', '60-global-media.list', '70-intl-tld.list']
      .flatMap((f) => ['', ...readList(f)]).map(toProxy)),
  });
  return files;
}

function buildAll() {
  const files = buildModules();
  files['Shadowrocket_LazyGroup_Merged.conf'] = buildConf({
    file: 'Shadowrocket_LazyGroup_Merged.conf',
    title: 'Shadowrocket 懒人策略组分流',
    desc: ['纯分流：AI 专线 / 流媒体 / 社交 / 地区自动测速策略组，国内直连，Apple 原生服务保护。'],
    groups: true,
  });
  files['Shadowrocket_AllInOne_Ultimate.conf'] = buildConf({
    file: 'Shadowrocket_AllInOne_Ultimate.conf',
    title: 'Shadowrocket 大一统精简分流（仅 PROXY / DIRECT）',
    desc: ['与懒人版规则完全一致，只是不含策略组：海外走 PROXY、国内与 Apple 走 DIRECT。'],
    groups: false,
    policyMap: profile.AIO_POLICY,
  });
  Object.assign(files, buildLoon({
    meta, profile, loon, readList, listFiles, loadApps, dedupe, section, adblockRules, criticalGuard, mitmHosts, AMDC_REWRITE, jqExpr, SCRIPT_BASE,
  }));
  return files;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const files = buildAll();
  let stale = 0;
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(ROOT, rel);
    const old = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (old === content) continue;
    if (check) {
      console.error(`产物过期: ${rel}`);
      stale++;
    } else {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, content);
      console.log(`写入 ${rel}`);
    }
  }
  if (check && stale) process.exit(1);
  if (!check) console.log(`完成，共 ${Object.keys(files).length} 个产物`);
}

module.exports = {
  AMDC_REWRITE, buildAll, confRules, loadApps, quicRule, mitmHosts, scriptLine, bodyLine, jqExpr, SCRIPT_BASE };
