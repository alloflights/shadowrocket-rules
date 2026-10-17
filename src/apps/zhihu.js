const r = String.raw;
module.exports = {
  id: 'zhihu',
  name: '知乎净化',
  desc: '去除知乎开屏、推荐/关注/热榜流广告、回答页与评论区商品卡、搜索预置词与商业横幅。',
  rules: [
    'DOMAIN,sugar.zhihu.com,REJECT',
    'DOMAIN,zhihu-web-analytics.zhihu.com,REJECT',
    'DOMAIN,datahub.zhihu.com,REJECT',
    'DOMAIN,crash2.zhihu.com,REJECT',
    'DOMAIN,apm.zhihu.com,REJECT',
    'IP-CIDR,118.89.204.198/32,REJECT,no-resolve',
  ],
  rewrites: [
    r`^https?:\/\/(api|www)\.zhihu\.com\/commercial_api\/(banners_v3|launch_v2|app_float_layer|feed_float_layer)\/? - reject-dict`,
    r`^https?:\/\/(api|www)\.zhihu\.com\/(api\/v4\/)?(mcn|bazaar|ecommerce|fringe)\/ - reject-dict`,
  ],
  scripts: [
    {
      name: 'zhihu_clean',
      type: 'response',
      pattern: r`^https?:\/\/(api|www|appcloud2|appcloud2\.in|zhuanlan)\.zhihu\.com\/(feed-root\/|topstory\/recommend|v4\/topstory\/recommend|topstory\/hot-lists|moments|(api\/)?v4\/questions\/\d+\/(answers|feeds)|questions\/\d+\/(answers|feeds)|(api\/)?v4\/answers\/\d+|answers\/\d+|(api\/)?v4\/articles\/\d+|articles\/\d+|next-data|next-render|prague\/|comment_v5\/|v4\/comments|search\/preset_words|search\/tabs|(v4\/)?search_v3|ad-style-service\/|commercial_api\/|(api\/v4\/)?(mcn|bazaar|ecommerce|fringe)\/|v3\/resource|v3\/config)`,
      script: 'zhihu.js',
      maxSize: 5242880,
    },
  ],
  mitm: ['api.zhihu.com', 'www.zhihu.com', 'appcloud2.zhihu.com', 'appcloud2.in.zhihu.com', 'zhuanlan.zhihu.com'],
};
