// 小黑盒：参考 可莉 XiaoHeiHe 插件
const r = String.raw;
module.exports = {
  id: 'xiaoheihe',
  name: '小黑盒净化',
  desc: '去除小黑盒开屏广告与资讯信息流中的广告卡片。',
  rules: [],
  rewrites: [
    r`^https:\/\/api\.xiaoheihe\.cn\/account\/get_ads_info_v2 - reject-dict`,
  ],
  bodyRewrites: [
    {
      pattern: r`^https:\/\/api\.xiaoheihe\.cn\/bbs\/app\/feeds\/news`,
      jq: '.result.links |= map(if .content_type == 27 then del(.title, .ad_pm, .img_gif, .idea_id, .ad_report, .label, .source, .intranet_only, .ad_cm, .content_type, .PROTOCOL, .img, .ad_ratio) else . end)',
    },
  ],
  scripts: [],
  mitm: ['api.xiaoheihe.cn'],
};
