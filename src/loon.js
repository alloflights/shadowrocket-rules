// Loon 版的唯一数据源：可莉插件清单、策略组、[General]。分流 / 去广告内容与 Shadowrocket 版共用 src/rules 与 src/apps。
const KELEE = 'https://kelee.one/Tool/Loon/Lpx';

// 可莉插件（https://hub.kelee.one）。covers = 被它取代的自研单元 id：主配置启用可莉插件时，
// 自研「补充」插件不再包含这些单元，避免同一接口被两套脚本 / 重写重复处理。
// 不收录：12306 / 云闪付（解密关键服务，与关键服务保护冲突）、各类解锁 / 签到类插件。
const KELEE_PLUGINS = [
  // ---- 通用 ----
  { file: 'BlockAdvertisers', tag: '广告平台拦截器' },
  { file: 'Block_HTTPDNS', tag: 'HTTPDNS 拦截器' },
  { file: 'Remove_ads_by_keli', tag: '可莉广告过滤器', covers: ['chuangkit'] },
  // ---- 海外 App（自研版没有） ----
  { file: 'YouTube_remove_ads', tag: 'YouTube 去广告（需开 MitM over HTTP/2）' },
  { file: 'Spotify_remove_ads', tag: 'Spotify 去广告' },
  // ---- 国内 App ----
  { file: 'FleaMarket_remove_ads', tag: '闲鱼去广告', covers: ['goofish'] },
  { file: 'Taobao_remove_ads', tag: '淘宝去广告', covers: ['taobao'] },
  { file: 'TaobaoTravel_remove_ads', tag: '飞猪旅行去广告' },
  { file: 'JD_remove_ads', tag: '京东去广告', covers: ['jd'] },
  { file: 'PinDuoDuo_remove_ads', tag: '拼多多去广告', covers: ['pdd'] },
  { file: 'Weidian_remove_ads', tag: '微店去广告', covers: ['weidian'] },
  { file: 'ZhuanZhuan_remove_ads', tag: '转转去广告', covers: ['zhuanzhuan'] },
  { file: 'Amap_remove_ads', tag: '高德地图去广告', covers: ['amap'] },
  { file: 'DiDi_remove_ads', tag: '滴滴去广告', covers: ['didi'] },
  { file: 'Umetrip_remove_ads', tag: '航旅纵横去广告', covers: ['umetrip'] },
  { file: 'Weixin_Official_Accounts_remove_ads', tag: '微信公众号去广告', covers: ['wechat-mp'] },
  { file: 'WexinMiniPrograms_Remove_ads', tag: '微信小程序去广告' },
  { file: 'Weibo_remove_ads', tag: '微博去广告', covers: ['weibo'] },
  { file: 'Zhihu_remove_ads', tag: '知乎去广告', covers: ['zhihu'] },
  { file: 'RedPaper_remove_ads', tag: '小红书去广告', covers: ['xiaohongshu'] },
  { file: 'Tieba_remove_ads', tag: '百度贴吧去广告', covers: ['tieba'] },
  { file: 'BaiduNetDisk_remove_ads', tag: '百度网盘去广告', covers: ['baidunetdisk'] },
  { file: 'QuarkBrowser_remove_ads', tag: '夸克去广告', covers: ['quark'] },
  { file: 'CoolApk_remove_ads', tag: '酷安去广告', covers: ['coolapk'] },
  { file: 'Bilibili_remove_ads', tag: '哔哩哔哩去广告', covers: ['bilibili'] },
  { file: 'Douyu_remove_ads', tag: '斗鱼去广告', covers: ['douyu'] },
  { file: 'HUPU_remove_ads', tag: '虎扑去广告', covers: ['hupu'] },
  { file: 'XiaoHeiHe_remove_ads', tag: '小黑盒去广告', covers: ['xiaoheihe'] },
  { file: 'PerfectWorldEsport_remove_ads', tag: '完美世界电竞去广告' },
  { file: 'NetEaseGodlike_remove_ads', tag: '网易大神去广告', covers: ['netease-godlike'] },
  { file: 'NeteaseCloudMusic_remove_ads', tag: '网易云音乐去广告', covers: ['netease'] },
  { file: 'Himalaya_remove_ads', tag: '喜马拉雅去广告', covers: ['ximalaya'] },
  { file: 'QiDian_remove_ads', tag: '起点读书去广告', covers: ['qidian'] },
  { file: 'DragonRead_remove_ads', tag: '番茄小说去广告', covers: ['fanqie'] },
  { file: 'WakeupSchedule_remove_ads', tag: 'WakeUp 课程表去广告', covers: ['wakeup'] },
].map((p) => ({ ...p, url: `${KELEE}/${p.file}.lpx`, covers: p.covers || [] }));

// Shadowrocket 的 PROXY（主界面所选节点）在 Loon 里对应这个策略组
const PROXY = '节点选择';

// 远程规则文件名用的 ASCII 名称（URL 里不放中文）
const SLUG = {
  [PROXY]: 'proxy', DIRECT: 'direct', 苹果服务: 'apple', 谷歌服务: 'google', 微软服务: 'microsoft', 哔哩哔哩: 'bilibili',
  游戏平台: 'game', 漏网之鱼: 'final', 'Disney+': 'disney',
};

const REGIONS = [
  ['香港节点', '香港', '🇭🇰|HK|Hong|hong|香港|深港|沪港|京港|港'],
  ['台湾节点', '台湾', '🇹🇼|TW|TWN|Taiwan|Taipei|taiwan|台湾|台灣|台北|台中|新北|彰化'],
  ['日本节点', '日本', '🇯🇵|JP|Japan|japan|Tokyo|tokyo|日本|东京|大阪|京日|苏日|沪日|上日|川日|深日|广日|日'],
  ['新加坡节点', '新加坡', '🇸🇬|SG|Sing|sing|新加坡|狮城|沪新|京新|深新|杭新|广新'],
  ['韩国节点', '韩国', '🇰🇷|KR|Korea|korea|KOR|韩国|首尔|韩|韓|春川'],
  ['美国节点', '美国', '🇺🇸|US|USA|America|america|United States|美国|凤凰城|洛杉矶|西雅图|芝加哥|纽约|沪美|美'],
];
const INFO = '剩余|到期|流量|官网|重置|过期|套餐|Expire|Traffic|官方|客服';
const NON_HK_AI = '🇺🇸|US|USA|America|United States|美国|🇯🇵|JP|Japan|日本|🇸🇬|SG|Singapore|新加坡|🇹🇼|TW|Taiwan|台湾';
const only = (keys) => `(?=.*(${keys}))^((?!(${INFO})).)*$`;
const TEST_URL = 'http://www.gstatic.com/generate_204';

const remoteFilter = [
  '[Remote Filter]',
  '# 节点筛选：对本地节点和全部订阅节点生效，自动排除「剩余流量 / 到期时间」等信息节点',
  `全部 = NameRegex, FilterKey = "^((?!(${INFO})).)*$"`,
  `AI可用 = NameRegex, FilterKey = "${only(NON_HK_AI)}"`,
  ...REGIONS.map(([, f, k]) => `${f} = NameRegex, FilterKey = "${only(k)}"`),
  '',
].join('\n');

const ALL = REGIONS.map(([n]) => n).join(',');
// select 组默认选中第一个成员
const proxyGroup = `[Proxy Group]
# ---------- 总出口（对应 Shadowrocket 的 PROXY） ----------
${PROXY} = select,自动选择,${ALL},手动切换,DIRECT
自动选择 = url-test,全部,url=${TEST_URL},interval=600,tolerance=100
手动切换 = select,全部
# ---------- AI 专线（固定节点，避免 IP 漂移触发风控；Gemini / Claude 不要用香港） ----------
OpenAI = select,AI稳定线路,美国节点,日本节点,新加坡节点,台湾节点,${PROXY}
Claude = select,新加坡节点,AI稳定线路,美国节点,日本节点,台湾节点,${PROXY}
Gemini = select,新加坡节点,AI稳定线路,美国节点,日本节点,台湾节点,${PROXY}
MetaAI = select,AI稳定线路,美国节点,${PROXY},日本节点,新加坡节点
AI = select,AI稳定线路,美国节点,日本节点,新加坡节点,台湾节点,${PROXY}
# ---------- 流媒体 / 社交 ----------
YouTube = select,${PROXY},${ALL}
Netflix = select,${PROXY},${ALL}
Disney+ = select,${PROXY},${ALL}
Max = select,${PROXY},${ALL}
TikTok = select,${PROXY},${ALL}
Spotify = select,${PROXY},DIRECT,${ALL}
Telegram = select,${PROXY},${ALL}
Twitter = select,${PROXY},${ALL}
Facebook = select,${PROXY},${ALL}
PayPal = select,${PROXY},DIRECT,${ALL}
Amazon = select,${PROXY},DIRECT,${ALL}
# ---------- 平台服务 ----------
苹果服务 = select,DIRECT,${PROXY},${ALL}
谷歌服务 = select,${PROXY},${ALL}
微软服务 = select,DIRECT,${PROXY},${ALL}
哔哩哔哩 = select,DIRECT,${PROXY},香港节点,台湾节点
游戏平台 = select,${PROXY},DIRECT,${ALL}
# 漏网之鱼：规则与 GEOIP,CN 都没命中的流量（基本都是境外站点）。默认代理，可一键切 DIRECT。
漏网之鱼 = select,${PROXY},DIRECT,${ALL}
# ---------- 自动组 ----------
# AI稳定线路：fallback（按顺序取第一个可用节点，不按延迟跳变），排除香港与信息节点
AI稳定线路 = fallback,AI可用,url=${TEST_URL},interval=1800,max-timeout=3000
# 地区自动测速：公差 100ms，避免频繁切线
${REGIONS.map(([n, f]) => `${n} = url-test,${f},url=${TEST_URL},interval=600,tolerance=100`).join('\n')}
`;

module.exports = { KELEE_PLUGINS, PROXY, SLUG, remoteFilter, proxyGroup, TEST_URL };
