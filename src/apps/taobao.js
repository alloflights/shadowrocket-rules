// 淘宝 / 飞猪 / 淘票票：参考 可莉 Taobao、TaobaoTravel、Remove_ads_by_keli 插件；开屏 JS 改写为本地 jq（不引用第三方脚本）。
// 依赖 10-adblock 的 AMDC 全局阻断：否则 mtop 走 spdy / xQUIC 长连接，HTTPS 解密与重写不生效。
const r = String.raw;
const ACS = r`^https:\/\/acs\.m\.taobao\.com\/gw\/`;
const GUIDE = r`^https:\/\/guide-acs\.m\.taobao\.com\/gw\/`;
// 开屏素材：等待 0 秒、冷热启动均不展示、投放时间推到 2090 年、素材地址置空
const SPLASH_ITEM = '{"waitTime": "0", "times": "0", "hotStart": "false", "coldStart": "false", "haveVoice": "false", "hideTBLogo": "false", "enable4G": "false", '
  + '"startTime": "3818332800000", "endTime": "3818419199000", "gmtStart": "2090-12-31 00:00:00", "gmtEnd": "2090-12-31 23:59:59", "gmtStartMs": "3818332800000", "gmtEndMs": "3818419199000"}';
module.exports = {
  id: 'taobao',
  name: '淘宝 / 飞猪 / 淘票票净化',
  desc: '去除淘宝开屏图片与视频广告、开屏活动弹层（PopLayer）、二楼与首页 newface 推广、各类广告位接口；飞猪开屏与猜你喜欢；淘票票开屏与弹窗。首次启用后请删除重装淘宝一次以清除已缓存的开屏素材。',
  rules: [
    'DOMAIN,amdc.m.taobao.com,REJECT',
    'URL-REGEX,"^http:\\/\\/.+\\/amdc\\/mobileDispatch",REJECT',
    'DOMAIN,adashx.m.taobao.com,REJECT',
    'DOMAIN,h-adashx.ut.taobao.com,REJECT',
    'DOMAIN,ut.taobao.com,REJECT',
    'DOMAIN,ossgw.alicdn.com,REJECT',
    'DOMAIN,hudong.alicdn.com,REJECT',
    'DOMAIN,ems.youku.com,REJECT',
  ],
  rewrites: [
    ACS + r`mtop\.fliggy\.crm\.screen\.(allresource|predict) - reject-dict`,
    ACS + r`mtop\.alibaba\.advertisementservice\.getadv - reject-dict`,
    ACS + r`mtop\.alimama\.etao\.config\.query\/.+?etao_advertise - reject-dict`,
    ACS + r`mtop\.alimusic\.common\.mobileservice\.startinit - reject-dict`,
    ACS + r`mtop\.etao\.noah\.query\/.+tao_splash - reject-dict`,
    ACS + r`mtop\.film\.mtopadvertiseapi\.(queryadvertise|queryloadingbanner) - reject-dict`,
    ACS + r`mtop\.film\.life\.popup\.get\/ - reject-dict`,
    ACS + r`mtop\.o2o\.ad\.gateway\.get - reject-dict`,
    ACS + r`mtop\.taobao\.idle\.home\.welcome - reject-dict`,
    ACS + r`mtop\.trip\.activity\.querytmsresources - reject-dict`,
    ACS + r`mtop\.fliggy\.tripzoo\.new\.couponlist\/ - reject-dict`,
    ACS + r`mtop\.trip\.my\.recommendcard\/ - reject-dict`,
    ACS + r`mtop\.fliggy\.recommend\.common\.guess\.tab\.feeds\/ - reject-dict`,
    GUIDE + r`mtop\.taobao\.(volvo\.secondfloor\.getconfig|wireless\.home\.newface\.awesome\.get) - reject-dict`,
  ],
  bodyRewrites: [
    {
      pattern: GUIDE + r`mtop\.taobao\.wireless\.home\.splash\.awesome\.get`,
      jq: `.data.containers.splash_home_base.base.sections |= map(if (.bizData["taobao-splash"].data | type) == "array" then .bizData["taobao-splash"].data |= map(. + ${SPLASH_ITEM} | (if .imgUrl then .imgUrl = "" else . end) | (if .videoUrl then .videoUrl = "" else . end)) else . end)`,
    },
    {
      pattern: GUIDE + r`mtop\.taobao\.cloudvideo\.video\.query`,
      jq: [
        'if .data.duration then .data.duration = "0" else . end',
        'if (.data.resources | type) == "array" then .data.resources = [] else . end',
        'if (.data.caches | type) == "array" then .data.caches = [] else . end',
        'if .data.respTimeInMs then .data.respTimeInMs = "3818332800000" else . end',
      ],
    },
    {
      pattern: r`^https:\/\/poplayer\.template\.alibaba\.com\/\w+\.json`,
      jq: [
        'if (.res.images | type) == "array" then .res.images = [] else . end',
        'if (.res.videos | type) == "array" then .res.videos = [] else . end',
        'if .enable then .enable = false else . end',
        'if (.mainRes.images | type) == "array" then .mainRes.images = [] else . end',
      ],
    },
  ],
  scripts: [],
  mitm: ['acs.m.taobao.com', 'guide-acs.m.taobao.com', 'poplayer.template.alibaba.com'],
};
