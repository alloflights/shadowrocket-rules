// [General] / [Proxy Group] / [Host] 的唯一数据源
const fs = require('fs');
const path = require('path');

// 关键服务域名：唯一来源 src/rules/05-critical.list
const CRITICAL = fs.readFileSync(path.join(__dirname, 'rules', '05-critical.list'), 'utf8')
  .split(/\r?\n/).map((l) => l.trim()).filter((l) => /^DOMAIN(-SUFFIX)?,/.test(l))
  .map((l) => { const [type, domain] = l.split(','); return { type, domain }; });
// skip-proxy / MITM 排除用的通配写法
const criticalPatterns = () => CRITICAL.flatMap((c) => (c.type === 'DOMAIN' ? [c.domain] : [`*.${c.domain}`]));
const SKIP_PROXY = [
  '192.168.0.0/16', '10.0.0.0/8', '17.0.0.0/8', '172.16.0.0/12', '100.64.0.0/10', 'localhost', '*.local', 'captive.apple.com',
  '*.apple.com', '*.apple.com.cn', '*.icloud.com', '*.icloud.com.cn', '*.icloud-content.com', '*.push.apple.com', '*.mzstatic.com',
  '*.aaplimg.com', '*.cdn-apple.com', '*.itunes.com', '*.apple-cloudkit.com', '*.apple-dns.net', 'identity.apple.com', 'gsa.apple.com',
  // 05-critical.list 里的 12306 / 政务 / 银行 / 支付 / 运营商 / Wi-Fi 通话 / 游戏反作弊域名自动追加（见 CRITICAL）
];

const ALWAYS_REAL_IP = [
  '*.apple.com', '*.icloud.com', '*.icloud.com.cn', '*.push.apple.com', '*.apple-cloudkit.com', '*.me.com', '*.mzstatic.com',
  '*.cdn-apple.com', '*.aaplimg.com', '*.itunes.com', '*.apple-dns.net', 'identity.apple.com', 'gsa.apple.com', 'captive.apple.com',
  '*.outlook.com', '*.office365.com', '*.office.com', '*.msftconnecttest.com', '*.msftncsi.com', 'time.*.com', 'ntp.*.com',
  'stun.*.*', 'stun.*.*.*', '*.local', 'localhost',
  // QQ / 微信 / TIM 网页快捷登录：这些域名解析到 127.0.0.1，拿到虚拟 IP 会导致「一键登录」失效
  'localhost.ptlogin2.qq.com', 'localhost.sec.qq.com', 'localhost.work.weixin.qq.com',
  // Wi-Fi 通话 ePDG
  '*.3gppnetwork.org',
  // 游戏联机：真实 IP 才能正确打洞，NAT 类型不降级（含热点共享给主机时）
  '*.srv.nintendo.net', '*.stun.playstation.net', 'xbox.*.microsoft.com', '*.xboxlive.com', '*.battlenet.com.cn', '*.battle.net',
];

const TUN_EXCLUDED = [
  '10.0.0.0/8', '17.0.0.0/8', '127.0.0.0/8', '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24',
  '192.168.0.0/16', '198.51.100.0/24', '203.0.113.0/24', '224.0.0.0/4', '255.255.255.255/32', '239.255.255.250/32',
  'fe80::/10', 'ff00::/8', 'ff02::fb/128',
];

function general(updateUrl) {
  return `[General]
bypass-system = true

# 跳过代理：Apple 核心服务、局域网、12306 / 政务 / 银行 / 支付 / 运营商等关键服务，直接由系统处理，最低延迟、最少干扰。
skip-proxy = ${[...SKIP_PROXY, ...criticalPatterns()].join(', ')}

# 真实 IP：Apple 认证 / 推送、微软邮件、NTP / STUN 不使用虚拟 IP，避免握手失败与时间同步异常。
always-real-ip = ${ALWAYS_REAL_IP.join(', ')}

# TUN 旁路：17.0.0.0/8 (Apple)、fe80::/10 (AWDL 隔空投送)、组播地址不进隧道，保证 AirDrop / 接力 / 通用剪贴板。
tun-excluded-routes = ${TUN_EXCLUDED.join(', ')}

# DNS：直连流量用运营商级 UDP 公共 DNS（阿里 + 腾讯），首包无需 TLS/HTTP 握手，比 DoH 少 1~2 个 RTT。
# 代理流量的域名在远端解析，不受本地 DNS 污染影响。需要防劫持时可改为：https://dns.alidns.com/dns-query, https://doh.pub/dns-query
dns-server = 223.5.5.5, 119.29.29.29
fallback-dns-server = system
# 直连域名用系统 DNS（运营商就近解析，CDN 调度最准，国内 App 加载最快）
dns-direct-system = true
dns-direct-fallback-proxy = false
hijack-dns = 8.8.8.8:53, 8.8.4.4:53
private-ip-answer = true

# 关闭 IPv6：避免 AAAA 查询与蜂窝网络 IPv6 回落带来的额外等待
ipv6 = false
prefer-ipv6 = false

icmp-auto-reply = true
always-reject-url-rewrite = false
udp-policy-not-supported-behaviour = REJECT

# 只对走代理的连接阻断 QUIC（去广告模块会对其解密的主机单独禁用 QUIC，其余直连不受影响）
block-quic = all-proxy

# WebRTC 防真实 IP 泄露
stun-response-ip = 127.0.0.1
stun-response-ipv6 = ::1

# 不拦截 mDNS / Bonjour，保证 AirDrop、通用剪贴板、接力
compatibility-mode = 1

# 配置自动更新地址
update-url = ${updateUrl}
`;
}

const REGIONS = [
  ['香港节点', '🇭🇰|HK|Hong|hong|香港|深港|沪港|京港|港'],
  ['台湾节点', '🇹🇼|TW|TWN|Taiwan|Taipei|taiwan|台湾|台灣|台北|台中|新北|彰化'],
  ['日本节点', '🇯🇵|JP|Japan|japan|Tokyo|tokyo|日本|东京|大阪|京日|苏日|沪日|上日|川日|深日|广日|日'],
  ['新加坡节点', '🇸🇬|SG|Sing|sing|新加坡|狮城|沪新|京新|深新|杭新|广新'],
  ['韩国节点', '🇰🇷|KR|Korea|korea|KOR|韩国|首尔|韩|韓|春川'],
  ['美国节点', '🇺🇸|US|USA|America|america|United States|美国|凤凰城|洛杉矶|西雅图|芝加哥|纽约|沪美|美'],
];
// 订阅里的“剩余流量 / 到期时间 / 官网”等信息节点不参与测速
const INFO = '剩余|到期|流量|官网|重置|过期|套餐|Expire|Traffic|官方|客服';
const filter = (keys) => `(?=.*(${keys}))^((?!(${INFO})).)*$`;
const ALL = '香港节点,台湾节点,日本节点,新加坡节点,韩国节点,美国节点';
const NON_HK_AI = '🇺🇸|US|USA|America|United States|美国|🇯🇵|JP|Japan|日本|🇸🇬|SG|Singapore|新加坡|🇹🇼|TW|Taiwan|台湾';

const proxyGroups = `[Proxy Group]
# ---------- AI 专线（固定节点，避免 IP 漂移触发风控；Gemini / Claude 不要用香港） ----------
OpenAI = select,AI稳定线路,美国节点,日本节点,新加坡节点,台湾节点,PROXY,policy-select-name=AI稳定线路
Claude = select,新加坡节点,AI稳定线路,美国节点,日本节点,台湾节点,PROXY,policy-select-name=新加坡节点
Gemini = select,新加坡节点,AI稳定线路,美国节点,日本节点,台湾节点,PROXY,policy-select-name=新加坡节点
MetaAI = select,AI稳定线路,美国节点,PROXY,日本节点,新加坡节点,policy-select-name=AI稳定线路
AI = select,AI稳定线路,美国节点,日本节点,新加坡节点,台湾节点,PROXY,policy-select-name=AI稳定线路
# ---------- 流媒体 / 社交 ----------
YouTube = select,PROXY,${ALL},policy-select-name=PROXY
Netflix = select,PROXY,${ALL},policy-select-name=PROXY
Disney+ = select,PROXY,${ALL},policy-select-name=PROXY
Max = select,PROXY,${ALL},policy-select-name=PROXY
TikTok = select,PROXY,${ALL},policy-select-name=PROXY
Spotify = select,PROXY,DIRECT,${ALL},policy-select-name=PROXY
Telegram = select,PROXY,${ALL},policy-select-name=PROXY
Twitter = select,PROXY,${ALL},policy-select-name=PROXY
Facebook = select,PROXY,${ALL},policy-select-name=PROXY
PayPal = select,PROXY,DIRECT,${ALL},policy-select-name=PROXY
Amazon = select,PROXY,DIRECT,${ALL},policy-select-name=PROXY
# ---------- 平台服务 ----------
苹果服务 = select,DIRECT,PROXY,${ALL},policy-select-name=DIRECT
谷歌服务 = select,PROXY,${ALL},policy-select-name=PROXY
微软服务 = select,DIRECT,PROXY,${ALL},policy-select-name=DIRECT
哔哩哔哩 = select,DIRECT,PROXY,香港节点,台湾节点,policy-select-name=DIRECT
游戏平台 = select,PROXY,DIRECT,${ALL},policy-select-name=PROXY
# 漏网之鱼：规则与 GEOIP,CN 都没命中的流量（基本都是境外站点）。默认代理，可一键切 DIRECT。
漏网之鱼 = select,PROXY,DIRECT,${ALL},policy-select-name=PROXY

# AI稳定线路：fallback（非测速跳变），排除香港与信息节点，除非节点彻底超时否则不换 IP
AI稳定线路 = fallback,url=http://www.gstatic.com/generate_204,interval=1800,timeout=5,policy-regex-filter=${filter(NON_HK_AI)}
# 地区自动测速组：公差 100ms，避免频繁切线
${REGIONS.map(([n, k]) => `${n} = url-test,url=http://www.gstatic.com/generate_204,interval=600,tolerance=100,timeout=5,select=0,policy-regex-filter=${filter(k)}`).join('\n')}
`;

// AllInOne（无策略组）版本的策略映射
const AIO_POLICY = {
  OpenAI: 'PROXY', Claude: 'PROXY', Gemini: 'PROXY', MetaAI: 'PROXY', AI: 'PROXY',
  YouTube: 'PROXY', Netflix: 'PROXY', 'Disney+': 'PROXY', Max: 'PROXY', TikTok: 'PROXY', Spotify: 'PROXY',
  Telegram: 'PROXY', Twitter: 'PROXY', Facebook: 'PROXY', PayPal: 'PROXY', Amazon: 'PROXY',
  苹果服务: 'DIRECT', 谷歌服务: 'PROXY', 微软服务: 'DIRECT', 哔哩哔哩: 'DIRECT', 游戏平台: 'PROXY', 漏网之鱼: 'PROXY',
};

const host = `[Host]
*.apple.com = server:system
*.icloud.com = server:system
*.icloud.com.cn = server:system
*.mzstatic.com = server:system
*.aaplimg.com = server:system
*.cdn-apple.com = server:system
*.itunes.com = server:system
*.outlook.com = server:system
*.office365.com = server:system
*.office.com = server:system
localhost = 127.0.0.1
`;

module.exports = { general, proxyGroups, AIO_POLICY, host, CRITICAL, criticalPatterns };
