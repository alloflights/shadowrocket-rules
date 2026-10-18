// 京东：参考 可莉 JD 插件与 fmz200 jingdong.js，脚本逻辑改写为本地 jq（不引用第三方脚本）
const r = String.raw;
const API = r`^https:\/\/api\.m\.jd\.com\/client\.action\?functionId=`;
const notIn = (field, list) => `select(.${field} as $v | ${JSON.stringify(list)} | index($v) | not)`;
module.exports = {
  id: 'jd',
  name: '京东净化',
  desc: '去除京东开屏、首页悬浮与通栏推广、下拉二楼、直播小窗、搜索框推荐词、物流页与订单页推广、我的页面弹窗与推荐楼层；关闭 HTTPDNS 与长连接探测，让去广告稳定生效。',
  rules: [
    'URL-REGEX,"^http:\\/\\/\\w{32}\\.jddebug\\.com\\/diagnose\\?",REJECT',
  ],
  rewrites: [
    API + r`(searchBoxWord|stationPullService|uniformRecommend[06]) - reject-dict`,
    API + r`getWidgetV1052 - reject-dict`,
  ],
  bodyRewrites: [
    {
      pattern: API + 'basicConfig',
      jq: [
        'if (.data.JDMessage.socketmonitor | type) == "object" then .data.JDMessage.socketmonitor |= ((if has("isSocketEstablishedAhead") then .isSocketEstablishedAhead = 0 else . end) | (if has("isSocketReport") then .isSocketReport = 0 else . end)) else . end',
        'if (.data.JDHttpToolKit.httpdns | type) == "object" and (.data.JDHttpToolKit.httpdns | has("httpdns")) then .data.JDHttpToolKit.httpdns.httpdns = 0 else . end',
      ],
    },
    {
      pattern: API + r`start(&|$)`,
      jq: ['if (.images | type) == "array" then .images = [] else . end', 'if .showTimesDaily then .showTimesDaily = 0 else . end'],
    },
    {
      pattern: API + 'welcomeHome',
      jq: [
        `.floorList |= map(${notIn('type', ['bottomXview', 'float', 'photoCeiling', 'ruleFloat', 'searchIcon', 'topRotate', 'tabBarAtmosphere'])})`,
        'if (.webViewFloorList | type) == "array" then .webViewFloorList = [] else . end',
      ],
    },
    {
      pattern: API + '(deliverLayer|orderTrackBusiness)',
      jq: ['del(.bannerInfo)', `.floors |= map(${notIn('mId', ['banner', 'jdDeliveryBanner'])})`],
    },
    { pattern: API + 'getTabHomeInfo', jq: 'del(.result.iconInfo, .result.roofTop)' },
    {
      pattern: API + 'myOrderInfo',
      jq: [
        `.floors |= map(${notIn('mId', ['bannerFloor', 'bpDynamicFloor', 'plusFloor'])})`,
        '.floors |= map(if .mId == "virtualServiceCenter" and (.data.virtualServiceCenters | type) == "array" then .data.virtualServiceCenters |= map(if (.serviceList | type) == "array" then .serviceList |= map(select(.serviceTitle != "精选特惠")) else . end) else . end)',
      ],
    },
    {
      pattern: API + 'personinfoBusiness',
      jq: [
        `.floors |= map(${notIn('mId', ['bigSaleFloor', 'buyOften', 'newAttentionCard', 'newBigSaleFloor', 'newStyleAttentionCard', 'newsFloor', 'noticeFloor', 'recommendfloor'])})`,
        '.floors |= map(if .mId == "basefloorinfo" and (.data | type) == "object" then .data |= (del(.commonPopup, .commonPopup_dynamic, .floatLayer) | (if (.commonTips | type) == "array" then .commonTips = [] else . end) | (if (.commonWindows | type) == "array" then .commonWindows = [] else . end)) else . end)',
      ],
    },
  ],
  scripts: [],
  mitm: ['api.m.jd.com'],
};
