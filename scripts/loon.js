/**
 * Loon 产物：主配置 + 自研插件 + 远程规则文件。数据全部来自 src/（与 Shadowrocket 版共用），由 build.js 调用。
 *
 * Loon 与 Shadowrocket 的关键差异（决定了这里的结构）：
 *   1. 规则来源优先级：本地 [Rule] > 插件 [Rule] > [Remote Rule]。所以主配置本地只放 Apple / 关键服务保护等「必须最先命中」的规则，
 *      分流全部做成远程规则——否则本地的 DOMAIN-SUFFIX,taobao.com,DIRECT 会盖掉可莉插件里的去广告拒绝规则。
 *   2. 一个远程规则文件只能对应一个策略。按原顺序把显式规则分块；只有在不改变任何域名匹配结果时才把同策略的块合并。
 *   3. 域名请求先匹配全部域名规则，没命中才解析 DNS 匹配 IP 规则：GEOIP / FINAL 放本地也不会提前触发 DNS。
 */
'use strict';

const BUILTIN = new Set(['DIRECT', 'REJECT', 'REJECT-IMG', 'REJECT-DICT', 'REJECT-ARRAY', 'REJECT-DROP']);
const isDomainType = (t) => /^DOMAIN(-SUFFIX|-KEYWORD)?$/.test(t);
const isIpType = (t) => /^(IP-CIDR|IP-CIDR6|IP-ASN)$/.test(t);

function toLoonRuleSet(url) {
  return url.replace('/rule/Shadowrocket/', '/rule/Loon/').replace('/rule/QuantumultX/', '/rule/Loon/');
}

// ---------------------------------------------------------------- 规则重叠判断（决定能否合并分块）
function v4(cidr) {
  const [net, bits] = cidr.split('/');
  const n = net.split('.').reduce((a, x) => a * 256 + Number(x), 0);
  const size = 2 ** (32 - Number(bits));
  return [Math.floor(n / size) * size, Math.floor(n / size) * size + size - 1];
}
function overlap(a, b) {
  if (isDomainType(a.type) && isDomainType(b.type)) {
    if (a.type === 'DOMAIN-KEYWORD' || b.type === 'DOMAIN-KEYWORD') return true; // 关键字可能命中任意域名，保守处理
    const x = a.value.toLowerCase();
    const y = b.value.toLowerCase();
    const under = (d, s) => d === s || d.endsWith(`.${s}`);
    if (a.type === 'DOMAIN' && b.type === 'DOMAIN') return x === y;
    if (a.type === 'DOMAIN') return under(x, y);
    if (b.type === 'DOMAIN') return under(y, x);
    return under(x, y) || under(y, x);
  }
  if (isIpType(a.type) && isIpType(b.type)) {
    if (a.type === 'IP-CIDR' && b.type === 'IP-CIDR') {
      const [p, q] = [v4(a.value), v4(b.value)];
      return p[0] <= q[1] && q[0] <= p[1];
    }
    if ((a.type === 'IP-CIDR' && b.type === 'IP-CIDR6') || (a.type === 'IP-CIDR6' && b.type === 'IP-CIDR')) return false;
    return true;
  }
  return false;
}

function parseRule(line, file) {
  const p = line.split(',');
  return { type: p[0], value: p[1], policy: p[2], opts: p.slice(3), line, file };
}

/**
 * 把分流规则（显式规则 + RULE-SET）按原顺序转换成 Loon 远程规则块。
 * 显式规则只会被并入「更早的同策略块」，而且中间不能隔着：不同策略的 RULE-SET（内容未知，视为屏障），
 * 或与之重叠的不同策略显式规则。因此任何域名 / IP 的首个命中规则都与 Shadowrocket 版一致。
 */
function routingBlocks(entries) {
  const blocks = [];
  for (const e of entries) {
    if (e.ruleSet) {
      blocks.push({ ruleSet: e.ruleSet, policy: e.policy });
      continue;
    }
    let target = null;
    for (let k = blocks.length - 1; k >= 0; k--) {
      const b = blocks[k];
      if (b.policy === e.policy) {
        if (!b.ruleSet) {
          target = b;
          break;
        }
        continue;
      }
      if (b.ruleSet || b.rules.some((r) => overlap(r, e))) break;
    }
    if (target) target.rules.push(e);
    else blocks.push({ policy: e.policy, rules: [e] });
  }
  return blocks;
}

module.exports = function buildLoon(h) {
  const { meta, profile, loon, readList, listFiles, loadApps, dedupe, section, adblockRules, criticalGuard, mitmHosts, AMDC_REWRITE, jqExpr, SCRIPT_BASE } = h;
  const P = loon.PROXY;
  const mapPol = (pol) => (pol === 'PROXY' ? P : pol);
  const LOON = `${meta.cdn}/loon`;
  const units = loadApps();
  const covered = new Set(loon.KELEE_PLUGINS.flatMap((p) => p.covers));
  for (const id of covered) if (!units.some((u) => u.id === id)) throw new Error(`KELEE_PLUGINS covers 未知单元: ${id}`);
  const supplementUnits = units.filter((u) => !covered.has(u.id));

  // ------------------------------------------------------------ 插件内容转换
  function ruleLine(l) {
    const t = l.trim();
    if (!t || t.startsWith('#')) return l;
    // Shadowrocket 的 QUIC 回落写法 → Loon 的 PROTOCOL,QUIC
    const q = t.match(/^AND,\(\(PROTOCOL,UDP\),\(DST-PORT,443\),\((.+)\)\),REJECT$/);
    if (q) return `AND,((PROTOCOL,QUIC),(${q[1]})),REJECT`;
    if (/(^|\()DST-PORT,/.test(t)) return t.replace(/(^|\()DST-PORT,/g, '$1DEST-PORT,');
    return t;
  }
  function rewriteLine(l) {
    const t = l.trim();
    if (!t || t.startsWith('#')) return l;
    let m = t.match(/^(\S+) - (reject(?:-200|-dict|-array|-img)?)$/);
    if (m) return `${m[1]} ${m[2]}`;
    m = t.match(/^(\S+) (\S+) (302|307)$/);
    if (m) return `${m[1]} ${m[3]} ${m[2]}`;
    throw new Error(`无法转换为 Loon Rewrite: ${t}`);
  }
  const bodyLine = (b) => `${b.pattern} response-body-json-jq '${jqExpr(b.jq)}'`;
  function scriptLine(s) {
    const parts = [`script-path=${SCRIPT_BASE}/${s.script}`, `requires-body=${s.type === 'response'}`];
    if (s.binary) parts.push('binary-body-mode=true');
    parts.push(`timeout=${s.timeout || 10}`, `tag=${s.name}`);
    return `http-${s.type} ${s.pattern} ${parts.join(', ')}`;
  }
  const quic = (host) => {
    let m;
    if (host.startsWith('*.')) m = `DOMAIN-SUFFIX,${host.slice(2)}`;
    else if (host.includes('*')) m = `DOMAIN-SUFFIX,${host.slice(host.indexOf('.', host.indexOf('*')) + 1)}`;
    else m = `DOMAIN,${host}`;
    return `AND,((PROTOCOL,QUIC),(${m})),REJECT`;
  };
  const byUnit = (list, fn) => list.flatMap((u) => (fn(u).length ? [`# --- ${u.name} ---`, ...fn(u), ''] : []));

  function pluginText({ name, desc, rules, rewrites, scripts, mitm }) {
    const out = [
      `#!name=${name}`,
      `#!desc=${desc}`,
      '#!author=alloflights',
      `#!homepage=https://github.com/${meta.repo}`,
      '#!tag=去广告',
      `#!date=v${meta.version}`,
      `# 由 scripts/build.js 根据 src/ 自动生成，请勿直接修改`,
      '',
    ];
    if (rules.length) out.push('[Rule]', ...rules, '');
    if (rewrites.length) out.push('[Rewrite]', ...rewrites, '');
    if (scripts.length) out.push('[Script]', ...scripts, '');
    if (mitm.length) out.push('[MitM]', `hostname = ${mitm.join(', ')}`, '');
    return out.join('\n').replace(/\n+$/, '\n');
  }
  function adblockPlugin(list, { name, desc, globalRules }) {
    const hosts = mitmHosts(list);
    const bodies = byUnit(list, (u) => (u.bodyRewrites || []).map(bodyLine));
    const unitRules = list.flatMap((u) => ((u.rules || []).length ? [`# ${u.name}`, ...u.rules] : []));
    return pluginText({
      name,
      desc,
      rules: dedupe([
        ...section('HTTPS 解密主机禁用 QUIC（回落 TCP 才能被重写 / 脚本处理）'), ...hosts.map(quic),
        ...section('去广告 · 广告联盟 / 遥测 / HTTPDNS / 阿里 AMDC'), ...globalRules,
        ...(unitRules.length ? [...section('去广告 · App 专项'), ...unitRules] : []),
      ].map(ruleLine)),
      rewrites: [
        '# --- 阿里系 AMDC 调度（IP 直连兜底） ---', AMDC_REWRITE, '',
        ...byUnit(list, (u) => u.rewrites || []),
      ].map(rewriteLine).concat(bodies.length ? [...section('响应 Body 改写（jq，每一步失败都原样返回）'), ...bodies] : []),
      scripts: byUnit(list, (u) => (u.scripts || []).map(scriptLine)),
      mitm: hosts,
    });
  }

  const files = {};
  const adRules = readList('10-adblock.list');
  files['loon/plugins/adblock-supplement.plugin'] = adblockPlugin(supplementUnits, {
    name: '自研补充去广告（配合可莉插件）',
    desc: `与可莉插件互补：广告联盟 / 遥测 / HTTPDNS / 阿里 AMDC 拦截（含 IP 直连兜底），以及可莉没有覆盖的 App：${supplementUnits.map((u) => (u.id === 'misc' ? 'NGA、懂球帝、虎牙、500px、图虫、中国大学慕课' : u.name.replace(/(开屏)?净化|去广告/g, '').trim())).join('、')}。需开启 MitM。`,
    globalRules: adRules,
  });
  files['loon/plugins/adblock-ultimate.plugin'] = adblockPlugin(units, {
    name: '自研全量去广告（不用可莉时开启）',
    desc: '与 Shadowrocket 全量去广告模块内容一致：广告联盟 / 遥测 / HTTPDNS / AMDC + 全部 App 专项。与可莉 App 插件功能重叠，二选一，不要同时开启。需开启 MitM。',
    globalRules: adRules,
  });

  // ------------------------------------------------------------ 分流：本地 + 远程
  const routingFiles = listFiles().filter((f) => !/^(00|05|10)-/.test(f));
  const entries = [];
  const localTail = [];
  for (const f of routingFiles) {
    for (const raw of readList(f)) {
      const t = raw.trim();
      if (!t || t.startsWith('#')) continue;
      const p = t.split(',');
      if (p[0] === 'RULE-SET') entries.push({ ruleSet: toLoonRuleSet(p[1]), policy: mapPol(p[2]) });
      else if (p[0] === 'DST-PORT') localTail.push(`DEST-PORT,${p[1]},${mapPol(p[2])}`);
      else if (p[0] === 'GEOIP' || p[0] === 'FINAL') localTail.push(t.split(',').map((x, i) => (i === p.length - 1 || (p[0] === 'GEOIP' && i === 2) ? mapPol(x) : x)).join(','));
      else if (isDomainType(p[0]) || isIpType(p[0])) entries.push({ ...parseRule(t, f), policy: mapPol(p[2]) });
      else throw new Error(`Loon 远程规则不支持: ${t}`);
    }
  }
  const blocks = routingBlocks(entries);
  const remote = [];
  let n = 0;
  for (const b of blocks) {
    if (b.ruleSet) {
      const tag = b.ruleSet.split('/').pop().replace(/\.(list|txt)$/, '');
      remote.push(`${b.ruleSet}, policy=${b.policy}, tag=${tag}, enabled=true`);
      continue;
    }
    n++;
    const slug = loon.SLUG[b.policy] || b.policy.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`策略 ${b.policy} 缺少 SLUG`);
    const rel = `loon/rules/${String(n).padStart(2, '0')}-${slug}.list`;
    const lines = [];
    let from = null;
    for (const r of b.rules) {
      if (r.file !== from) lines.push(`# ${r.file}`);
      from = r.file;
      lines.push([r.type, r.value, ...r.opts].join(','));
    }
    files[rel] = [
      `# 自研分流 #${n} → ${b.policy}（${b.rules.length} 条）`,
      `# v${meta.version} · 由 scripts/build.js 根据 src/rules 自动生成，请勿直接修改`,
      ...lines,
      '',
    ].join('\n');
    remote.push(`${meta.cdn}/${rel}, policy=${b.policy}, tag=自研 ${String(n).padStart(2, '0')} · ${b.policy}, enabled=true`);
  }

  const protect = readList('00-protect.list').map((l) => {
    const t = l.trim();
    if (!t || t.startsWith('#')) return l;
    const p = t.split(',');
    p[2] = mapPol(p[2]);
    return p.join(',');
  });
  const localRules = dedupe([
    ...protect,
    '',
    ...criticalGuard(adblockRules(units)),
    '',
    '# ==================== 邮件端口直连（机场普遍封锁 25/465/587/993 等端口） ====================',
    ...localTail.filter((l) => l.startsWith('DEST-PORT')),
    '',
    '# ==================== 兜底 ====================',
    '# 上面的本地规则与所有插件 / 远程规则的域名规则都没命中时，才解析 DNS 匹配 IP 规则：解析到中国大陆 IP 直连',
    ...localTail.filter((l) => l.startsWith('GEOIP')),
    '# 境外未知流量走「漏网之鱼」（默认代理，可一键切 DIRECT）',
    ...localTail.filter((l) => l.startsWith('FINAL')),
  ]);

  const kelee = loon.KELEE_PLUGINS.map((p) => `${p.url}, tag=${p.tag}, enabled=true`);
  const general = `[General]
# ---------- 直连提速 ----------
# 只用 IPv4：不查询 AAAA、不尝试 IPv6 回落，直连首包更快（与 Shadowrocket 版 ipv6 = false 一致）
ip-mode = ipv4-only
ipv6-vif = off
# DNS：系统 DNS（校园网 / 运营商就近解析，CDN 调度最准）与阿里、腾讯 UDP DNS 并发，取最先返回的结果。
# 不配置 DoH：Loon 只要配置了加密 DNS 就会优先使用它，每次查询多 1~2 个 RTT。代理流量的域名在节点端解析，不受影响。
dns-server = system,223.5.5.5,119.29.29.29
hijack-dns = 8.8.8.8:53,8.8.4.4:53
# 去广告域名在 DNS 阶段直接返回 127.0.0.1，App 立刻失败，不会建立连接再等待超时
domain-reject-mode = DNS
dns-reject-mode = LOOPBACKIP
# 中国大陆 IP 库（只含 CN，GEOIP,CN 判定更准）
geoip-url = https://cdn.jsdelivr.net/gh/Hackl0us/GeoIP2-CN@release/Country.mmdb

# ---------- 系统服务保护 ----------
# TUN 旁路：局域网、17.0.0.0/8 (Apple)、fe80::/10 (AWDL 隔空投送)、组播地址不进隧道，保证 AirDrop / 接力 / 通用剪贴板
bypass-tun = ${profile.TUN_EXCLUDED.join(',')},localhost,*.local
# 跳过代理：Apple 核心服务、局域网、12306 / 政务 / 银行 / 支付 / 运营商等关键服务（来自 src/rules/05-critical.list）
skip-proxy = ${[...profile.SKIP_PROXY, ...profile.criticalPatterns()].join(',')}
# 真实 IP：Apple 认证 / 推送、微软邮件、NTP / STUN、QQ 快捷登录、Wi-Fi 通话、游戏联机
real-ip = ${profile.ALWAYS_REAL_IP.join(',')}

# ---------- 测速与 UDP ----------
proxy-test-url = ${loon.TEST_URL}
internet-test-url = http://wifi.vivo.com.cn/generate_204
test-timeout = 5
udp-fallback-mode = REJECT
allow-wifi-access = false
`;

  const conf = [
    '# ==============================================================================',
    `# Loon 懒人策略组分流 + 可莉插件整合  v${meta.version}`,
    '# 本文件由 scripts/build.js 根据 src/ 自动生成，请勿直接修改；修改 src/ 后执行 npm run build。',
    `# 配置地址：${meta.cdn}/Loon_LazyGroup.conf`,
    '#',
    '# 使用：配置 > 从 URL 下载配置 粘贴上面的地址；再到 配置 > 订阅节点 添加机场订阅。',
    '# 去广告需要 MitM：配置 > MitM > 生成并安装证书，到 设置 > 通用 > 关于本机 > 证书信任设置 中信任；',
    '#   同页打开「MitM over HTTP/2」（YouTube、贴吧等需要）。',
    '# 分流与 Shadowrocket 版完全一致：本地规则只放 Apple / 关键服务保护，分流全部是远程规则（优先级低于插件，',
    '#   这样可莉插件和自研插件里的去广告规则才不会被 DIRECT 分流规则盖掉）。',
    '# ==============================================================================',
    '',
    general,
    '[Proxy]',
    '# 本地节点可写在这里；推荐在 App 的「订阅节点」里添加机场订阅',
    '',
    '[Remote Proxy]',
    '',
    loon.remoteFilter,
    loon.proxyGroup,
    '[Rule]',
    ...localRules,
    '',
    '[Remote Rule]',
    '# ==================== 去广告 · AWAvenue 秋风广告规则（上游实时更新） ====================',
    `${meta.awavenue}, policy=REJECT, tag=AWAvenue 秋风广告规则, enabled=true`,
    '# ==================== 分流（自研显式规则与 blackmatrix7 规则集，保持与 Shadowrocket 版相同的先后顺序） ====================',
    ...remote,
    '',
    '[Rewrite]',
    '',
    '[Script]',
    '',
    '[Plugin]',
    '# 自研补充：广告联盟 / HTTPDNS / AMDC 拦截 + 可莉没有覆盖的 App（肯德基、麦当劳、山姆、外链直达、Safari 网页去打扰等）',
    `${LOON}/plugins/adblock-supplement.plugin, tag=自研补充去广告, enabled=true`,
    '# 可莉插件（https://hub.kelee.one，按你的 App 清单挑选；只能在 Loon 内下载）',
    ...kelee,
    '# 不想用可莉插件时：关闭上面全部可莉插件和「自研补充」，只开下面这个（两者功能重叠，二选一）',
    `${LOON}/plugins/adblock-ultimate.plugin, tag=自研全量去广告, enabled=false`,
    '',
    profile.host.replace(/\n+$/, ''),
    '',
    '[MitM]',
    '# 解密主机由插件追加。这里排除关键服务：即使插件写了通配主机，也不会解密银行 / 支付 / 12306 / 政务',
    `hostname = ${profile.CRITICAL.flatMap((c) => (c.type === 'DOMAIN' ? [`-${c.domain}`] : [`-${c.domain}`, `-*.${c.domain}`])).join(', ')}`,
    '',
  ].join('\n');
  files['Loon_LazyGroup.conf'] = conf;

  // 校验：策略都存在
  const groups = new Set([...loon.proxyGroup.matchAll(/^([^#\s[][^=\n]*?) = /gm)].map((m) => m[1]));
  for (const b of blocks) if (!BUILTIN.has(b.policy) && !groups.has(b.policy)) throw new Error(`Loon 缺少策略组: ${b.policy}`);
  return files;
};
module.exports.routingBlocks = routingBlocks;
module.exports.overlap = overlap;
