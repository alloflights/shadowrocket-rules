// 转转：参考 可莉 ZhuanZhuan 插件（mock 响应改为 jq 返回同样的成功空结果）
const r = String.raw;
const APP = r`^https:\/\/app\.zhuanzhuan\.com\/`;
module.exports = {
  id: 'zhuanzhuan',
  name: '转转净化',
  desc: '去除转转开屏、首页弹窗与运营位、我的页面推广卡片与金融入口、猜你喜欢与足迹推荐、信息流轮播推广。',
  rules: [],
  rewrites: [
    r`zz\/v2\/zzlogic\/getOpenScreen$`,
    r`zz\/v2\/zzinfoshow\/getwindvanecardv2$`,
    r`zzopen\/popwindow\/getallpopwin\?`,
    r`zzopen\/zzbmlogic\/queryFrontPageWindowInfo\?`,
    r`zzopen\/ptuserlogic\/subscribehotrecommend$`,
    r`zzopen\/ypmall\/listData$`,
    r`zz\/v2\/zzusercenter\/myprofilevariouscards$`,
  ].map((p) => `${APP}${p} - reject-dict`),
  bodyRewrites: [
    { pattern: APP + r`zzopen\/ptsimpleshow\/recommendbymyloveinfo\?`, jq: '{"respCode": 0, "errorMsg": "null", "errMsg": ""}' },
    { pattern: APP + r`zz\/v2\/zzinfoshow\/footprintsamerecommend\?`, jq: '{"respCode": 0, "errorMsg": "", "errMsg": ""}' },
    { pattern: APP + r`zz\/v2\/zzinfoshow\/getchoicegoodsinfos\?`, jq: '{"respCode": 0, "respData": {}, "errorMsg": "", "errMsg": ""}' },
    { pattern: APP + r`zz\/v2\/zzlogic\/mycontinenthomepage\?`, jq: ['del(.respData.topOpera.leftOpera, .respData.topOpera.rightOpera2)', 'del(.respData.topActBanner, .respData.bmArea)'] },
    { pattern: APP + r`zzx\/transfer\/getConfigInfo\?`, jq: 'del(.respData.freeMarketTabLeadPop, .respData.topOperations)' },
    {
      pattern: APP + r`zz\/v2\/zzinfoshow\/getfeedflowinfo\?`,
      jq: ['if .respData.userRed.campName == "OCD挂件" then del(.respData.userRed) else . end', '.respData.infoData |= map(del(.rotateResource, .appRecommendResource, .cargoGroupCardV2))'],
    },
    {
      pattern: APP + r`zz\/transfer\/getmymoretools$`,
      jq: [
        'walk(if type == "array" then map(select((type == "object" and .name == "免流量特权") | not)) else . end)',
        '.respData.groupList |= map(select(.groupName != "活动参与" and .groupName != "金融工具"))',
      ],
    },
    {
      pattern: APP + r`zz\/transfer\/getmyprofilev3$`,
      jq: [
        'del(.respData.bmNewInfo)',
        '.respData.itemGroupList |= map(if (.itemList | type) == "array" then .itemList |= map(select(.name != "天天赚钱" and .name != "借钱")) else . end)',
        '.respData.itemGroupList |= map(select(.groupType != 15))',
      ],
    },
  ],
  scripts: [],
  mitm: ['app.zhuanzhuan.com'],
};
