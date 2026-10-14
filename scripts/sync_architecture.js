const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/**
 * Shadowrocket Rules Single-Source-of-Truth Build & Sync Engine
 *
 * Responsibilities:
 * 1. Synchronizes [General], [Host], [URL Rewrite], [Script], and [MITM] across:
 *    - Shadowrocket_LazyGroup_Merged.conf
 *    - Shadowrocket_AllInOne_Ultimate.conf
 *    - modules/adblock-ultimate.sgmodule
 * 2. Injects complete domestic & overseas streaming adblock rules (GDT/AdNet, JAD, Tanx/Alimama,
 *    Pangle/CSJ/GroMore, MobAds, Kwai, Sigmob, TopOn, YouTube, X/Twitter, Spotify, Twitch, Reddit, Pixiv).
 * 3. Excludes SSL-pinned native app domains (api.x.com / api.twitter.com / *.amemv.com / *.snssdk.com) from [MITM]
 *    so native iOS X (Twitter) and Douyin clients never fail TLS handshakes or timeline/comment refreshes.
 */

const UNIFIED_SKIP_PROXY = [
    "192.168.0.0/16", "10.0.0.0/8", "17.0.0.0/8", "172.16.0.0/12",
    "localhost", "*.local", "captive.apple.com", "*.apple.com", "*.icloud.com", "*.icloud.com.cn",
    "*.push.apple.com", "*.mzstatic.com", "*.aaplimg.com", "*.itunes.com", "*.apple-cloudkit.com",
    "*.apple-dns.net", "identity.apple.com", "gsa.apple.com",
    "*.icbc.com.cn", "*.ccb.com", "*.abchina.com.cn", "*.boc.cn", "*.bankofchina.com",
    "*.bankcomm.com", "*.psbc.com", "*.cmbchina.com", "*.zj96596.com", "*.zjrc.com",
    "*.alipay.com", "*.unionpay.com", "*.95516.com", "*.pbccrc.org.cn", "*.chsi.com.cn",
    "*.122.gov.cn", "*.gffunds.com.cn", "*.nffund.com", "*.antfortune.com", "*.ecny.cn",
    "www.baidu.com", "www.163.com"
].join(", ");

const UNIFIED_ALWAYS_REAL_IP = [
    "*.apple.com", "*.icloud.com", "*.icloud.com.cn", "*.push.apple.com", "*.apple-cloudkit.com",
    "*.me.com", "*.mzstatic.com", "*.cdn-apple.com", "*.aaplimg.com", "*.itunes.com",
    "*.apple-dns.net", "identity.apple.com", "gsa.apple.com", "captive.apple.com",
    "*.outlook.com", "*.office365.com", "*.office.com", "*.local", "localhost"
].join(", ");

const UNIFIED_TUN_EXCLUDED = [
    "10.0.0.0/8", "17.0.0.0/8", "127.0.0.0/8", "169.254.0.0/16", "172.16.0.0/12",
    "192.0.0.0/24", "192.0.2.0/24", "192.88.99.0/24", "192.168.0.0/16",
    "198.51.100.0/24", "203.0.113.0/24", "224.0.0.0/4", "255.255.255.255/32",
    "239.255.255.250/32", "fe80::/10", "ff00::/8", "ff02::fb/128"
].join(", ");

const OVERSEAS_STREAM_AD_RULES = [
    "# ==================== 海外流媒体与社交平台去广告 (Spotify / Twitch / Reddit / Pixiv) ====================",
    "DOMAIN-SUFFIX,doubleclick.net,REJECT",
    "DOMAIN-SUFFIX,googleadservices.com,REJECT",
    "DOMAIN-SUFFIX,googlesyndication.com,REJECT",
    "DOMAIN-SUFFIX,googletagservices.com,REJECT",
    "DOMAIN-SUFFIX,2mdn.net,REJECT",
    "DOMAIN,s0.2mdn.net,REJECT",
    "DOMAIN,static.doubleclick.net,REJECT",
    "DOMAIN,www.googletagservices.com,REJECT",
    "DOMAIN,ads-fa.spotify.com,REJECT",
    "DOMAIN,adstudio.spotify.com,REJECT",
    "DOMAIN,adeventtracker.spotify.com,REJECT",
    "DOMAIN,analytics.spotify.com,REJECT",
    "DOMAIN,crashdump.spotify.com,REJECT",
    "DOMAIN,log.spotify.com,REJECT",
    "DOMAIN,weblb-wg.gslb.spotify.com,REJECT",
    "DOMAIN,ads.reddit.com,REJECT",
    "DOMAIN,events.reddit.com,REJECT",
    "DOMAIN,events.redditmedia.com,REJECT",
    "DOMAIN,d.reddit.com,REJECT",
    "DOMAIN,w3-reporting.reddit.com,REJECT",
    "DOMAIN,ad.pixiv.org,REJECT",
    "DOMAIN,d.pixiv.org,REJECT",
    "DOMAIN,imp.pixiv.net,REJECT",
    "DOMAIN,analytics.pixiv.net,REJECT",
    "DOMAIN,imasdk.googleapis.com,REJECT",
    "DOMAIN-SUFFIX,scorecardresearch.com,REJECT"
];

const REMOVED_BROKEN_TWITTER_RULES = new Set([
    "AND,((PROTOCOL,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,googlevideo.com)),REJECT-NO-DROP",
    "AND,((PROTOCOL,UDP),(DST-PORT,443),(DOMAIN,youtubei.googleapis.com)),REJECT-NO-DROP",
    "AND,((PROTOCOL,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,youtube.com)),REJECT-NO-DROP",
    "DOMAIN-SUFFIX,ads.youtube.com,REJECT",
    "DOMAIN,ad.youtube.com,REJECT",
    "DOMAIN,youtube.cleverads.vn,REJECT",
    "URL-REGEX,^https?:\\/\\/[\\w-]+\\.googlevideo\\.com\\/initplayback.+&oad,REJECT-200",
    "URL-REGEX,^https?:\\/\\/[\\w-]+\\.googlevideo\\.com\\/videoplayback.*(&ctier=L&|&oad=|&adformat=),REJECT-200",
    "AND,((PROTOCOL,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,x.com)),REJECT-NO-DROP",
    "AND,((PROTOCOL,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,twitter.com)),REJECT-NO-DROP",
    "AND,((PROTOCOL,UDP),(DST-PORT,443),(DOMAIN-SUFFIX,twimg.com)),REJECT-NO-DROP",
    "DOMAIN,ads-api.twitter.com,REJECT",
    "DOMAIN,ads-api.x.com,REJECT",
    "DOMAIN,ads.twitter.com,REJECT",
    "DOMAIN,ads.x.com,REJECT",
    "DOMAIN,analytics.twitter.com,REJECT",
    "DOMAIN,analytics.x.com,REJECT",
    "DOMAIN,static.ads-twitter.com,REJECT",
    "DOMAIN,scribe.twitter.com,REJECT",
    "DOMAIN,scribe.x.com,REJECT",
    "DOMAIN,p.twitter.com,REJECT",
    "DOMAIN,syndication.twitter.com,REJECT",
    "DOMAIN,syndication-oembed.twitter.com,REJECT"
]);

const UNIFIED_HOST_SECTION = `[Host]
*.apple.com = server:system
*.icloud.com = server:system
*.mzstatic.com = server:system
*.aaplimg.com = server:system
*.itunes.com = server:system
*.outlook.com = server:system
*.office365.com = server:system
*.office.com = server:system
localhost = 127.0.0.1`;

const UNIFIED_URL_REWRITE_BODY = `# --- Google 搜索引擎防跳转重写 ---
^https?://(www.)?g.cn https://www.google.com 302
^https?://(www.)?google.cn https://www.google.com 302

# --- Spotify 海外流媒体广告重写 ---
^https?:\\/\\/spclient\\.wg\\.spotify\\.com\\/(ads|ad-logic)\\/ - reject-200

# --- 完美世界电竞广告接口拦截 ---
^https?:\\/\\/.*(pwesports\\.cn|wanmei\\.com)\\/.*(feed\\/ad|promote|popup|banner_ad) - reject-dict

# --- 百度网盘营销推广与静态素材拦截 (保证图片加载秒返透明图，杜绝倒计时等待) ---
^https?:\\/\\/pan\\.baidu\\.com\\/rest\\/.*\\/membership\\/(proxy\\/)?guide - reject-200
^https?:\\/\\/pan\\.baidu\\.com\\/pmall\\/order\\/privilege\\/info - reject-dict
^https?:\\/\\/pan\\.baidu\\.com\\/api\\/useractivity\\/activity - reject-dict
^https?:\\/\\/pan\\.baidu\\.com\\/api\\/certuser\\/get - reject-dict
^https?:\\/\\/pan\\.baidu\\.com\\/component\\/view\\/(1510|1130)\\?vip - reject-dict
^https?:\\/\\/pan\\.baidu\\.com\\/feed\\/hotlist - reject-200
^https?:\\/\\/pan\\.baidu\\.com\\/coins\\/center\\/notice - reject-200
^https?:\\/\\/pan\\.baidu\\.com\\/queryintent\\/queryhint - reject-200
^https?:\\/\\/pan\\.baidu\\.com\\/api\\/taskscore\\/tasklist - reject-dict
^https?:\\/\\/ndstatic\\.cdn\\.bcebos\\.com\\/activity\\/welfare\\/(js\\/.+\\.js|index\\.html) - reject-200
^https?:\\/\\/staticsns\\.cdn\\.bcebos\\.com\\/amis\\/.+\\/banner\\.png - reject-img
^https?:\\/\\/issuecdn\\.baidupcs\\.com\\/issue\\/netdisk\\/.*(guanggao|ad|splash|advert).* - reject-img
^https?:\\/\\/update\\.pan\\.baidu\\.com\\/statistics - reject-200
^https?:\\/\\/.*zhangyuyidong\\.cn\\/api\\/zysdk - reject-200
^https?:\\/\\/afd\\.baidu\\.com\\/afd\\/entry - reject-dict
^https?:\\/\\/pan\\.baidu\\.com\\/buy\\/ad\\/analytics - reject-200
^https?:\\/\\/pan\\.baidu\\.com\\/api\\/analytics - reject-200

# --- 酷安搜索热词与开屏素材拦截 ---
^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/search\\?.*type=hotSearch - reject-200
^https?:\\/\\/image\\.coolapk\\.com\\/.*(splash|advert).* - reject-img

# --- 知乎商业横幅与开屏素材直拒 ---
^https?:\\/\\/www\\.zhihu\\.com\\/commercial_api\\/banners_v3\\/ - reject-dict

# --- 小黑盒开屏与信息流推广拦截 ---
^https?:\\/\\/api\\.xiaoheihe\\.cn\\/bbs\\/app\\/api\\/(startup|ad\\/|feed\\/ad|general\\/v\\d\\/banner|game\\/promote) - reject-dict

# --- NGA玩家社区与恩基爱社区广告拦截 ---
^https?:\\/\\/(bbs\\.nga\\.cn|nga\\.178\\.com)\\/app_api\\.php\\?.*__lib=(advert|splash) - reject-dict

# --- 懂球帝开屏与资讯信息流广告拦截 ---
^https?:\\/\\/api\\.dongqiudi\\.com\\/v\\d\\/(article\\/ad|splash|tab\\/ad) - reject-dict

# --- 网易大神开屏与推广拦截 ---
^https?:\\/\\/god\\.game\\.163\\.com\\/api\\/v\\d\\/(ad\\/|splash) - reject-dict

# --- 斗鱼与虎牙直播开屏广告拦截 ---
^https?:\\/\\/(capi|apiv2)\\.douyucdn\\.cn\\/api\\/v\\d\\/(getAppSplash|client_ad|room_ad) - reject-dict
^https?:\\/\\/hdads\\.huya\\.com\\/ - reject-dict
^https?:\\/\\/business\\.msorpack\\.huya\\.com\\/.*Adv - reject-dict

# --- 转转开屏广告与商业弹窗拦截 ---
^https?:\\/\\/api\\.zhuanzhuan\\.com\\/zz\\/transfer\\/(splash|ad) - reject-dict

# --- 铁路12306开屏广告拦截 ---
^https?:\\/\\/mobile\\.12306\\.cn\\/otsmobile\\/init\\/(splash|commercial) - reject-dict

# --- 去哪儿与携程旅行商业开屏拦截 ---
^https?:\\/\\/app\\.qunar\\.com\\/mobile\\/(splash|ad) - reject-dict
^https?:\\/\\/m\\.ctrip\\.com\\/restapi\\/soa2\\/\\d+\\/ad(Get|Show) - reject-dict

# --- 500px中国版与图虫摄影社区开屏拦截 ---
^https?:\\/\\/api\\.500px\\.com\\.cn\\/v\\d\\/(splash|advertisements) - reject-dict
^https?:\\/\\/api\\.tuchong\\.com\\/2\\/(splash|ad\\/) - reject-dict

# --- 中国大学慕课与知到在线教育开屏拦截 ---
^https?:\\/\\/www\\.icourse163\\.org\\/mob\\/ad\\/ - reject-dict
^https?:\\/\\/.*\\.zhihuishu\\.com\\/.*(splash|advert) - reject-dict

# --- 中国移动与云闪付开屏广告拦截 ---
^https?:\\/\\/.*\\.10086\\.cn\\/.*(splash|ad|advert) - reject-dict
^https?:\\/\\/content\\.95516\\.com\\/api\\/v\\d\\/ad\\/ - reject-dict

# --- 雷神加速器与biubiu加速器开屏拦截 ---
^https?:\\/\\/.*\\.leigod\\.com\\/api\\/v\\d\\/(splash|ad) - reject-dict
^https?:\\/\\/.*\\.biubiu001\\.com\\/.*(splash|ad) - reject-dict

# --- 京东与大众点评营销弹窗拦截 ---
^https?:\\/\\/api\\.m\\.jd\\.com\\/client\\.action\\?functionId=(start|getAd) - reject-dict
^https?:\\/\\/m\\.api\\.dianping\\.com\\/(advert|splash)\\/ - reject-dict

# --- 闲鱼开屏与首页广告拦截 ---
^https?:\\/\\/(acs|g-acs)\\.m\\.goofish\\.com\\/gw\\/mtop\\.taobao\\.idle\\.local\\.splash\\.ads\\/ - reject-dict
^https?:\\/\\/(acs|g-acs)\\.m\\.goofish\\.com\\/gw\\/mtop\\.taobao\\.idle\\.home\\.banner\\.feed\\/ - reject-dict
^https?:\\/\\/(acs|g-acs)\\.m\\.goofish\\.com\\/gw\\/mtop\\.taobao\\.idle\\.popup\\.window\\/ - reject-dict
^https?:\\/\\/(acs|g-acs)\\.m\\.goofish\\.com\\/gw\\/mtop\\.taobao\\.idle\\.float\\.window\\/ - reject-dict

# --- 微博开屏与信息流推广拦截 ---
^https:\\/\\/api\\.weibo\\.cn\\/2\\/(ug\\/checkin\\/list|push\\/daily)\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/!\\/live\\/media_homelist\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/comments\\/bullet_screens\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/photo\\/info\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/statuses\\/(container_positive|push_info)\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/vote\\/get_vote_detail\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/!\\/chaohua\\/discovery\\/home_bottom\\/switch\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/!\\/huati\\/(discovery_home_bottom_getdotinfo|mobile_discovery_searchchange)\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/!\\/wbox\\/\\w+\\/(home_bottom_modal|interest_category)\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/search\\/container_discover\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/hot\\/hours_spotlight\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/2\\/video\\/redpacket\\? - reject-dict
^https:\\/\\/api\\.weibo\\.cn\\/!\\/sug\\/list\\/finderchange\\? - reject-dict
^https:\\/\\/bootrealtime\\.uve\\.weibo\\.com\\/v[23]\\/ad\\/realtime - reject-dict
^https:\\/\\/sdkapp\\.uve\\.weibo\\.com\\/interface\\/sdk\\/(get-lbs-cell-info\\.php|sdkconfig\\.php) - reject
^https:\\/\\/card\\.weibo\\.com\\/article\\/m\\/aj\\/(reward|uvead)\\? - reject-dict
^https:\\/\\/weibo\\.com\\/ttarticle\\/x\\/m\\/aj\\/(reward|uvead)\\? - reject-dict

# --- 高德地图推广卡片与横幅拦截 ---
^https:\\/\\/m5\\.amap\\.com\\/ws\\/faas\\/amap-navigation\\/card-service-(car-end|route-plan)\\? - reject-dict
^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/search\\/new_hotword\\? - reject-dict
^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/search_poi\\/tips_adv\\? - reject-dict
^https:\\/\\/oss\\.amap\\.com\\/ws\\/banner\\/lists\\/\\? - reject-dict
^https:\\/\\/m5\\.amap\\.com\\/ws\\/faas\\/amap-navigation\\/main-page-(assets|location)\\? - reject-dict
^https:\\/\\/m5\\.amap\\.com\\/ws\\/(mapapi\\/hint_text\\/offline_data|message\\/notice\\/list|shield\\/search\\/new_hotword)\\? - reject-dict
^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/scene\\/recommend\\? - reject-dict
^https:\\/\\/m5\\.amap\\.com\\/ws\\/valueadded\\/weather\\/v2\\? - reject-dict
^https:\\/\\/sns\\.amap\\.com\\/ws\\/msgbox\\/pull_mp\\? - reject-dict
^https:\\/\\/m5-zb\\.amap\\.com\\/ws\\/boss\\/(order\\/car\\/king_toolbox_car_bubble|tips\\/onscene_visual_optimization)\\? - reject-dict

# --- 小红书营销弹窗与水印配置拦截 ---
^https?:\\/\\/ci\\.xiaohongshu\\.com\\/system_config\\/watermark - reject-img
^https?:\\/\\/edith\\.xiaohongshu\\.com\\/api\\/sns\\/v1\\/surprisebox\\/(get_style|open|submit_action) - reject-dict
^https?:\\/\\/www\\.xiaohongshu\\.com\\/api\\/marketing\\/box\\/trigger\\? - reject-dict
^https?:\\/\\/edith\\.xiaohongshu\\.com\\/api\\/sns\\/v3\\/note\\/guide\\? - reject-dict
^https?:\\/\\/www\\.xiaohongshu\\.com\\/api\\/sns\\/(v1\\/ads\\/resource|v2\\/hey\\/\\w+\\/hey_gallery) - reject-dict

# --- 抖音开屏与带货浮窗拦截 ---
^https?:\\/\\/.*\\.snssdk\\.com\\/v\\d\\/splash\\/ - reject-dict
^https?:\\/\\/(api.*\\.amemv|aweme\\.snssdk)\\.com\\/api\\/ad\\/ - reject-200
^https?:\\/\\/.*\\.snssdk\\.com\\/api\\/ad\\/v\\d\\/ - reject-200
^https?:\\/\\/.*\\.snssdk\\.com\\/aweme\\/v\\d\\/yellow_cart\\/ - reject-dict
^https?:\\/\\/.*\\.snssdk\\.com\\/aweme\\/v\\d\\/commerce\\/ - reject-dict
^https?:\\/\\/.*\\.snssdk\\.com\\/live\\/room\\/pop_window - reject-dict
^https?:\\/\\/.*\\.ecombdapi\\.com\\/.* - reject-200
^https?:\\/\\/.*\\.ecombdpage\\.com\\/.* - reject-200

# --- 贴吧HTTPDNS与打点拦截 ---
^https?:\\/\\/180\\.76\\.76\\.200\\/ - reject
^https?:\\/\\/tiebac\\.baidu\\.com\\/c\\/s\\/log - reject-200

# --- 虎扑开屏与商业推广拦截 ---
^https?:\\/\\/.*\\.hupucdn\\.com\\/.*ad.* - reject-img
^https?:\\/\\/goblin\\.hupu\\.com\\/.* - reject
^https?:\\/\\/.*\\.mobileapi\\.hupu\\.com\\/.+\\/(interfaceAd|banners|search\\/v2\\/(hotkeylist|hintkeylist)) - reject
^https?:\\/\\/bbs\\.mobileapi\\.hupu\\.com\\/.+\\/bbsallapi\\/(lego\\/data|tag\\/v\\d\\/heatTag) - reject-dict
^https?:\\/\\/games\\.mobileapi\\.hupu\\.com\\/.+\\/bplapi\\/user\\/v1\\/more - reject-dict

# --- 网易云音乐活动与弹窗拦截 ---
^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/content\\/activity\\/music\\/jar\\/template\\/list - reject-200
^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/sp\\/flow\\/popup\\/query - reject-200
^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/vipmall\\/couponcfg\\/get - reject-200
^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/w?eapi\\/(resource-exposure\\/)?activity - reject-200
^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/comment\\/feed\\/inserted\\/resources - reject-200
^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/resource-exposure\\/config - reject-200

# --- 喜马拉雅开屏与福利中心增强拦截 ---
^https?:\\/\\/.*\\.ximalaya\\.com\\/.*(adse|adRealTime|ting\\/(loading|feed|home)|outadservice|ting\\/preload) - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/.*(adse|adRealTime|ting\\/(loading|feed|home)|outadservice|ting\\/preload) - reject
^https?:\\/\\/.*\\.ximalaya\\.com\\/discovery-feed\\/(focus\\/queryF|isShowUserGiftPendant) - reject
^https?:\\/\\/passport\\.ximalaya\\.com\\/friendship-mobile\\/v1\\/findFriendsBanner - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/discovery-feed\\/focus\\/queryF - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/mobile-playpage\\/view\\/ - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/chaos-notice-web\\/v1\\/message\\/preview\\/list - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/social-web\\/bottomTabs\\/dynamicEntrance\\/status - reject
^https?:\\/\\/.*\\.xmcdn\\.com\\/\\w{8}\\/\\w{4}-\\w{16}\\/.+gif$ - reject
^https?:\\/\\/gslb.*\\.xima.*\\.com\\/ - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/(dog-portal\\/checkOld|(child-mobile\\/child|aged-mobile\\/aged)\\/mode\\/query) - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/discovery-feed\\/isShowUserGiftPendant - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/mobile-user\\/unread - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/mobile-user\\/minorProtection\\/pop - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/collector\\/xl\\/v\\d - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/butler-portal\\/versionCheck - reject
^https?:\\/\\/(adse\\.wsa|adse|adbehavior|xdcs-collector)\\.xima.*\\.com\\/.* - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/mobile\\/discovery\\/v\\d\\/location - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/(hub\\/)?hotWord - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/(hub\\/)?hotWordBillboard - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/(hub)?guideWord - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/api\\/v\\d\\/adRealTime - reject
^https?:\\/\\/.*\\.xima.*\\.com\\/ting\\/(loading|feed|home)? - reject

# --- 航旅纵横开屏与商业广告拦截 ---
^https?:\\/\\/umestartup\\.umetrip\\.com\\/ - reject
^https?:\\/\\/(discardrp|startup)\\.umetrip\\.com\\/gateway\\/api\\/umetrip\\/native - reject
^https?:\\/\\/oss\\.umetrip\\.com\\/fs\\/advert\\/polite - reject-dict

# --- 美团闪购与商业开屏素材阻断 ---
^https?:\\/\\/img\\.meituan\\.net\\/bizad\\/ - reject-img
^https?:\\/\\/(s3plus|flowplus)\\.meituan\\.net\\/v\\d\\/\\w+\\/linglong\\/ - reject-img

# --- 麦当劳与肯德基开屏及弹窗拦截 ---
^https?:\\/\\/api(2)?\\.mcd\\.cn\\/bff\\/portal\\/(home\\/(splash|hotActivity)|richpop) - reject-200
^https?:\\/\\/res\\.kfc\\.com\\.cn\\/(advertisement|CRM\\/kfcad)\\/ - reject-200
^https?:\\/\\/dynamicad\\.kfc\\.com\\.cn\\/api\\/app5\\/homepage\\/ai\\/popup - reject-200`;

const UNIFIED_SCRIPT_BODY = `# 0. 百度网盘急速开屏净化 (本地 0.1ms Mock 响应，彻底阻止开屏占位页与摇一摇监听实例化)
baidunetdisk_splash = type=http-request,pattern=^https?:\\/\\/pan\\.baidu\\.com\\/.*(pcs\\/adx?|membership\\/advertise|splash|buy\\/ad\\/(conf|get)|api\\/ad\\/|act\\/(api\\/activityentry|v\\d\\/(bchannel|welfare)\\/list)|feed\\/cardinfos|recommend\\/shortseries\\/list),requires-body=0,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/baidunetdisk.js,script-update-interval=0
baidunetdisk_clean = type=http-response,pattern=^https?:\\/\\/pan\\.baidu\\.com\\/.*(feed|card|membership|activity|config|user|welfare),requires-body=1,max-size=2097152,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/baidunetdisk.js,script-update-interval=0

# 1. 完美世界电竞净化 (开屏秒开、社区与资讯内置信息流广告剥离、轮播Banner净化)
pwesports_splash = type=http-request,pattern=^https?:\\/\\/.*(pwesports\\.cn|wanmei\\.com)\\/.*(splash|startup|launch|advert|open_screen|boot_ad),requires-body=0,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/pwesports.js,script-update-interval=0
pwesports_clean = type=http-response,pattern=^https?:\\/\\/.*(pwesports\\.cn|wanmei\\.com)\\/(app|api)\\/(v\\d\\/)?(feed|news|community|home|banner|match|article|square|post|index),requires-body=1,max-size=2097152,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/pwesports.js,script-update-interval=0

# 2. 酷安深度无感去广告 (开屏Mock、304缓存破除、自底向上剥离空白广告框与SDK占位容器)
酷安_开屏Mock = type=http-request,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/(?:(?:main\\/)?(?:splash|launch|launch_ad|launch-ad|launchad|openScreen|openscreen|open-screen|open_screen|startup|startup_ad|startup-ad|startupad|boot_ad|boot-ad|bootad)|ad\\/request)(?:[\\/?]|$),requires-body=0,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_初始化请求 = type=http-request,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/main\\/init,requires-body=0,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_初始化 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/main\\/init,requires-body=1,max-size=1048576,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_首页信息流 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/(?:main|feed)\\/index.*,requires-body=1,max-size=2097152,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_数据列表 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/(?:page|main|feed)\\/(?:dataList|list|feedList|stream).*,requires-body=1,max-size=2097152,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_扩展页面 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/(?:apk|product|topic|question|search|user|dyh|collection|goods)\\/.*,requires-body=1,max-size=2097152,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_动态详情 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/feed\\/detail,requires-body=1,max-size=1048576,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_评论区 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/feed\\/replyList,requires-body=1,max-size=1048576,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0
酷安_个人中心 = type=http-response,pattern=^https?:\\/\\/api\\d*\\.coolapk\\.com\\/v6\\/account\\/profile,requires-body=1,max-size=1048576,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/coolapk.js,script-update-interval=0

# 3. 知乎全量推荐流、关注流、热榜、回答页与新版聚合根接口深度净化 (2026真机抓包对齐)
zhihu_clean = type=http-response,pattern=^https?:\\/\\/(api|www|appcloud2|appcloud2\\.in)\\.zhihu\\.com\\/(feed-root\\/|topstory\\/recommend|v4\\/topstory\\/recommend|topstory\\/hot-lists|moments|v4\\/questions\\/\\d+\\/answers|questions\\/\\d+\\/(answers|feeds)|api\\/v4\\/answers\\/\\d+\\/recommendations|api\\/v4\\/articles\\/\\d+\\/recommendation|ad-style-service\\/|commercial_api\\/(real_time_launch|app_float_layer)|v3\\/resource|v3\\/config),requires-body=1,max-size=5242880,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/zhihu.js,script-update-interval=0

# 4. 百度贴吧去广告 (JSON + Protobuf 双引擎，100% 静默无弹窗)
tieba_json = type=http-response,pattern=^https?:\\/\\/(tiebac|c\\.tieba)\\.baidu\\.com\\/(c\\/(s\\/sync|f\\/(ad\\/getSplashAd|frs\\/(page|threadlist|generalTabList)|pb\\/(pic)?page|excellent\\/personalized))$|tiebaads\\/commonbatch\\?),requires-body=1,max-size=1048576,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/tieba-json.js,script-update-interval=0
tieba_proto = type=http-response,pattern=^https?:\\/\\/(tiebac|c\\.tieba)\\.baidu\\.com\\/c\\/(b\\/ad\\/adBid|f\\/(frs\\/(page|threadlist|generalTabList)|ad\\/getFeedAd|pb\\/page|excellent\\/personalized))\\?cmd,requires-body=1,binary-body-mode=1,max-size=-1,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/tieba-proto.js,script-update-interval=0

# 5. 小红书去广告与无水印原图/实况保存
xiaohongshu_purify = type=http-response,pattern=^https?:\\/\\/edith\\.xiaohongshu\\.com\\/api\\/sns\\/v\\d\\/(note\\/(imagefeed|feed|videofeed|widgets|live_photo\\/save|detail)|homefeed|system_service\\/(splash_config|config)|search\\/(banner|hot)_list|search\\/notes|followfeed),requires-body=1,max-size=2097152,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/xiaohongshu.js,script-update-interval=0

# 6. 哔哩哔哩 (JSON开屏推荐 + Protobuf视频播放页净化，100% 静默无弹窗)
bili_json = type=http-response,pattern=^https:\\/\\/app\\.bilibili\\.com\\/x\\/(v2\\/(splash\\/(list|show|brand\\/list|event\\/list2)|feed\\/index\\?)|resource\\/show\\/tab\\/v2),requires-body=1,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/bilibili-json.js,script-update-interval=0
bili_proto = type=http-response,pattern=^https:\\/\\/(grpc\\.biliapi\\.net|app\\.bilibili\\.com)\\/bilibili\\.app\\.viewunite\\.v1\\.View\\/View$,requires-body=1,binary-body-mode=1,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/bilibili-proto.js,script-update-interval=0

# 7. 微博多维度去广告
weibo_main = type=http-response,pattern=^https?:\\/\\/api\\.weibo\\.cn\\/2\\/(cardlist|page|statuses\\/(container_timeline|extend|show)|checkin\\/show|client\\/publisher_list|push\\/active|groups\\/allgroups\\/v2|comments\\/build_comments|profile\\/(container_timeline|me|userinfo)|search\\/(container_timeline|finder)|video\\/tiny_stream_video_list),script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/weibo.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0
weibo_preload = type=http-response,pattern=^https?:\\/\\/(sdkapp|bootpreload|wbapp)\\.uve\\.weibo\\.com\\/(interface\\/sdk\\/sdkad\\.php|v[12]\\/ad\\/preload|wbapplua\\/wbpullad\\.lua|preload\\/get_ad),script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/weibo.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0

# 8. 高德地图净化 (首页、路线规划、搜索建议与AMDC调度)
amap_header = type=http-response,pattern=^http:\\/\\/amdc\\.m\\.taobao\\.com\\/amdc\\/mobileDispatch$,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/header.js,timeout=60,script-update-interval=0
amap_drive = type=http-response,pattern=^https:\\/\\/m5\\.amap\\.com\\/ws\\/perception\\/drive\\/(routeInfo|routePlan)\\?,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/amap.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0
amap_poi = type=http-response,pattern=^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/search\\/(common\\/coupon\\/info|poi\\/detail)\\?,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/amap.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0
amap_market = type=http-response,pattern=^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/search_business\\/process\\/marketingOperationStructured\\?,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/amap.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0
amap_search = type=http-response,pattern=^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/search_poi\\/(homepage|mps|search\\/sp|sug|tips_operation_location)\\?,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/amap.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0
amap_home = type=http-response,pattern=^https:\\/\\/m5\\.amap\\.com\\/ws\\/faas\\/amap-navigation\\/(card-service-plan-home|main-page)\\?,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/amap.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0
amap_frog = type=http-response,pattern=^https:\\/\\/m5\\.amap\\.com\\/ws\\/shield\\/frogserver\\/aocs\\/updatable\\/1\\?,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/amap.js,requires-body=1,max-size=-1,timeout=60,script-update-interval=0

# 9. 网易云音乐净化 (框架、发现页、推荐页、搜索与广告过滤)
netease_adblock = type=http-response,pattern=^https?:\\/\\/interface(\\d)?\\.music\\.163\\.com\\/e?api\\/(link\\/(home\\/framework\\/tab|page\\/(discovery|rcmd)\\/resource\\/show|position\\/show\\/resource|scene\\/show\\/resource)|ios\\/upgrade\\/get|search\\/(default\\/keyword\\/list|rcmd\\/keyword\\/get|chart\\/(list|detail)|suggest\\/keyword\\/get|specialkeyword\\/get)|ad\\/(loading\\/(get|current)|get)|vip\\/cashier\\/tspopup\\/get|vipnewcenter\\/app\\/resource\\/newaccountpage|side-bar\\/mini-program\\/music-service\\/account|delivery\\/(deliver|batch-deliver)|yunbei\\/account\\/entrance\\/get|creator\\/musician\\/reminder\\/message\\/get|batch),requires-body=1,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/netease.adblock.js,script-update-interval=0

# 10. 起点读书净化 (开屏广告、每日导读、活动弹窗、悬浮广告)
起点_广告净化 = type=http-response,pattern=^https:\\/\\/magev6\\.if\\.qidian\\.com\\/argus\\/api\\/(v4\\/client\\/getsplashscreen|v2\\/(deeplink\\/geturl|dailyrecommend\\/getdailyrecommend)|v1\\/(client\\/getconf$|bookshelf\\/getHoverAdv|adv\\/getadvlistbatch\\?positions=iOS_tab)),requires-body=1,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/qidian.js,script-update-interval=0

# 11. 喜马拉雅净化 (首页动态、顶部直播、横幅、分类Tab)
喜马拉雅_净化 = type=http-response,pattern=^https?:\\/\\/.*\\.xima.*\\.com\\/(discovery-category\\/(customCategories|v\\d\\/category)|focus-mobile\\/focusPic|discovery-feed\\/v\\d\\/mix|mobile-user\\/v\\d\\/homePage),requires-body=1,max-size=0,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/ximalaya_json.js,script-update-interval=0

# 12. 全网外链“零等待”302直跳与 Safari 移动端网页去流氓化 (自动展开全文/解除复制限制/防强跳App)
全网外链直接跳转 = type=http-request,pattern=^https?:\\/\\/(link\\.(zhihu|csdn|juejin)\\.(com|net|cn)|(www\\.)?jianshu\\.com\\/go-wild|weibo\\.cn\\/sinaurl|jump2?\\.bdimg\\.com\\/safecheck|c\\.pc\\.qq\\.com\\/middlem|sspai\\.com\\/link|gitee\\.com\\/link|www\\.yuque\\.com\\/r\\/goto),requires-body=0,max-size=0,timeout=10,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/direct-link.js,script-update-interval=0
safari_clean = type=http-response,pattern=^https?:\\/\\/(m\\.zhihu\\.com\\/(question\\/\\d+|p\\/\\d+)|blog\\.csdn\\.net\\/\\w+\\/article\\/details\\/\\d+|tieba\\.baidu\\.com\\/p\\/\\d+|m\\.weibo\\.cn\\/detail\\/\\d+),requires-body=1,max-size=1048576,script-path=https://cdn.jsdelivr.net/gh/alloflights/shadowrocket-rules@main/modules/scripts/safari-clean.js,script-update-interval=0`;

const UNIFIED_MITM_HOSTS = [
    "*.google.cn",
    "hermes.hupu.com", "goblin.hupu.com", "*.mobileapi.hupu.com", "*.hupu.com", "*.hupucdn.com",
    "umestartup.umetrip.com", "bda.umetrip.com", "startup.umetrip.com", "discardrp.umetrip.com", "oss.umetrip.com", "home.umetrip.com", "umerp.umetrip.com",
    "app.bilibili.com", "grpc.biliapi.net",
    "api.coolapk.com", "api2.coolapk.com", "*.coolapk.com",
    "tiebac.baidu.com", "c.tieba.baidu.com",
    "edith.xiaohongshu.com", "www.xiaohongshu.com", "ci.xiaohongshu.com",
    "pan.baidu.com", "afd.baidu.com", "issuecdn.baidupcs.com", "ndstatic.cdn.bcebos.com", "staticsns.cdn.bcebos.com",
    "api.mcd.cn", "api2.mcd.cn", "res.kfc.com.cn", "dynamicad.kfc.com.cn",
    "api.zhihu.com", "www.zhihu.com", "appcloud2.zhihu.com", "appcloud2.in.zhihu.com", "zhuanlan.zhihu.com",
    "api.weibo.cn", "*.uve.weibo.com", "card.weibo.com", "weibo.com",
    "m5.amap.com", "m5-zb.amap.com", "oss.amap.com", "sns.amap.com", "amdc.m.taobao.com",
    "interface*.music.163.com",
    "magev6.if.qidian.com",
    "*.ximalaya.com", "*.xmcdn.com", "*.wsa.ximalaya.com", "adse.ximalaya.com", "adse.wsa.ximalaya.com", "mobile.ximalaya.com", "passport.ximalaya.com",
    "acs.m.goofish.com", "g-acs.m.goofish.com",
    "img.meituan.net", "s3plus.meituan.net", "flowplus.meituan.net",
    "spclient.wg.spotify.com",
    "api.pwesports.cn", "app.pwesports.cn", "esports.wanmei.com", "api.esports.wanmei.com", "client.pwesports.cn", "ad.pwesports.cn", "advert.pwesports.cn", "*.pwesports.cn", "*.wanmei.com",
    "api.xiaoheihe.cn", "bbs.nga.cn", "nga.178.com", "api.dongqiudi.com", "god.game.163.com",
    "capi.douyucdn.cn", "apiv2.douyucdn.cn", "hdads.huya.com", "business.msorpack.huya.com",
    "api.zhuanzhuan.com", "mobile.12306.cn", "app.qunar.com", "m.ctrip.com",
    "api.500px.com.cn", "api.tuchong.com", "www.icourse163.org", "*.zhihuishu.com",
    "*.10086.cn", "app.10086.cn", "content.95516.com",
    "*.leigod.com", "*.biubiu001.com", "api.m.jd.com", "m.api.dianping.com", "*.zhangyuyidong.cn",
    "link.zhihu.com", "link.csdn.net", "link.juejin.cn", "*.jianshu.com", "weibo.cn", "jump2.bdimg.com", "jump.bdimg.com", "c.pc.qq.com", "sspai.com", "gitee.com", "www.yuque.com",
    "m.zhihu.com", "blog.csdn.net", "tieba.baidu.com", "m.weibo.cn"
];

function cleanRuleSection(ruleSectionText, isModule) {
    // 1. Replace forbidden volces.com REJECT with neptune-api.volces.com REJECT and strip all Twitter & YouTube ad/UDP rules
    let lines = ruleSectionText
        .split("\n")
        .map(line => {
            if (line.trim() === "DOMAIN-SUFFIX,volces.com,REJECT") {
                return "DOMAIN-SUFFIX,neptune-api.volces.com,REJECT";
            }
            return line;
        })
        .filter(line => !REMOVED_BROKEN_TWITTER_RULES.has(line.trim()));

    // 2. Inject Overseas Streaming Ad Rules right after the Global & Domestic Top Ad Networks section if not already present
    const hasSpotifyAds = lines.some(l => l.trim() === "DOMAIN,ads-fa.spotify.com,REJECT");
    if (!hasSpotifyAds) {
        let insertIdx = lines.findIndex(l => l.includes("DOMAIN-SUFFIX,adcolony.com,REJECT"));
        if (insertIdx === -1) {
            insertIdx = lines.findIndex(l => l.includes("IP-CIDR,182.254.118.0/24,REJECT,no-resolve"));
        }
        if (insertIdx !== -1) {
            lines.splice(insertIdx + 1, 0, "", ...OVERSEAS_STREAM_AD_RULES);
        }
    }

    // 2b. For main .conf files, ensure X (Twitter) core domains are explicitly routed to PROXY
    if (!isModule && !lines.some(l => l.trim() === "DOMAIN-SUFFIX,x.com,PROXY")) {
        const redditIdx = lines.findIndex(l => l.trim() === "DOMAIN-SUFFIX,reddit.com,PROXY");
        if (redditIdx !== -1) {
            lines.splice(
                redditIdx,
                0,
                "DOMAIN-SUFFIX,x.com,PROXY",
                "DOMAIN-SUFFIX,twitter.com,PROXY",
                "DOMAIN-SUFFIX,twimg.com,PROXY",
                "DOMAIN-SUFFIX,t.co,PROXY",
                "DOMAIN-SUFFIX,pscp.tv,PROXY",
                "DOMAIN-SUFFIX,periscope.tv,PROXY"
            );
        }
    }

    // 3. Ensure Bilibili splash image regex is present in [Rule]
    if (!lines.some(l => l.includes("bilivideo.com\\/.*-SPLA"))) {
        const insertIdx = lines.findIndex(l => l.includes("DOMAIN,mpad.weixin.qq.com,REJECT"));
        if (insertIdx !== -1) {
            lines.splice(insertIdx + 1, 0, "URL-REGEX,^https?:\\/\\/.*\\.bilivideo\\.com\\/.*-SPLA,REJECT-IMG");
        }
    }

    // 4. Deduplicate exact rules and remove shadowed conflicting DIRECT rules for explicitly REJECTed ad/tracker domains
    const seenExact = new Set();
    const rejectedDomainKeys = new Set();
    const cleaned = [];

    for (const rawLine of lines) {
        const trimmed = rawLine.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
            cleaned.push(rawLine);
            continue;
        }
        const parts = trimmed.split(",").map(s => s.trim());
        const ruleType = parts[0];
        const target = parts[1] || "";
        const policy = parts[2] || "";
        const typeKey = `${ruleType},${target}`;

        if (policy.startsWith("REJECT")) {
            rejectedDomainKeys.add(typeKey);
        } else if (policy === "DIRECT" && rejectedDomainKeys.has(typeKey)) {
            continue;
        }

        if (seenExact.has(trimmed)) {
            continue;
        }
        seenExact.add(trimmed);
        cleaned.push(trimmed);
    }

    return cleaned.join("\n");
}

function updateGeneralSection(generalText) {
    let text = generalText;
    if (!text.includes("bypass-system = true")) {
        text = text.replace("[General]", "[General]\nbypass-system = true");
    }
    text = text.replace(/^skip-proxy\s*=.*$/m, `skip-proxy = ${UNIFIED_SKIP_PROXY}`);
    text = text.replace(/^always-real-ip\s*=.*$/m, `always-real-ip = ${UNIFIED_ALWAYS_REAL_IP}`);
    text = text.replace(/^tun-excluded-routes\s*=.*$/m, `tun-excluded-routes = ${UNIFIED_TUN_EXCLUDED}`);
    if (!text.includes("compatibility-mode = 1")) {
        text = text.trimEnd() + "\n\n# 网络兼容模式。设为 1 使 Shadowrocket 不拦截系统级 mDNS/Bonjour 广播，保障 AirDrop 与通用剪贴板不断连\ncompatibility-mode = 1\n";
    }
    return text;
}

function rebuildConfFile(relPath, isModule) {
    const fullPath = path.join(ROOT, relPath);
    let content = fs.readFileSync(fullPath, "utf8");

    const ruleMatch = content.match(/\[Rule\]([\s\S]*?)(?=\n\[(Host|URL Rewrite|Script|MITM)\]|$)/);
    if (!ruleMatch) throw new Error(`Missing [Rule] in ${relPath}`);
    const cleanedRuleBody = cleanRuleSection(ruleMatch[1], isModule);

    if (isModule) {
        const headerMatch = content.match(/^([\s\S]*?)(?=\[Rule\])/);
        const header = headerMatch ? headerMatch[1].trimEnd() : "";
        const mitmLine = `hostname = %APPEND% ${UNIFIED_MITM_HOSTS.filter(h => h !== "*.google.cn").join(", ")}\nh2 = true`;
        const newModule = `${header}

[Rule]
${cleanedRuleBody.trim()}

[URL Rewrite]
${UNIFIED_URL_REWRITE_BODY.split("\n").filter(l => !l.includes("google.com 302")).join("\n").trim()}

[Script]
${UNIFIED_SCRIPT_BODY.trim()}

[MITM]
${mitmLine}
`;
        fs.writeFileSync(fullPath, newModule, "utf8");
        console.log(`Synced module: ${relPath}`);
        return;
    }

    const beforeRuleMatch = content.match(/^([\s\S]*?)(?=\[Rule\])/);
    let beforeRule = beforeRuleMatch ? beforeRuleMatch[1] : "";
    beforeRule = updateGeneralSection(beforeRule);

    const mitmSection = `[MITM]
# Shadowrocket 仅会解密 hostname 指定的域名的请求；开启 h2 = true 支持 HTTP/2 MITM 解密
hostname = ${UNIFIED_MITM_HOSTS.join(", ")}
h2 = true`;

    const newConf = `${beforeRule.trimEnd()}

[Rule]
${cleanedRuleBody.trim()}

${UNIFIED_HOST_SECTION}

[URL Rewrite]
${UNIFIED_URL_REWRITE_BODY.trim()}

[Script]
${UNIFIED_SCRIPT_BODY.trim()}

${mitmSection}
`;
    fs.writeFileSync(fullPath, newConf, "utf8");
    console.log(`Synced conf: ${relPath}`);
}

rebuildConfFile("Shadowrocket_LazyGroup_Merged.conf", false);
rebuildConfFile("Shadowrocket_AllInOne_Ultimate.conf", false);
rebuildConfFile("modules/adblock-ultimate.sgmodule", true);
