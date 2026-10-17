const r = String.raw;
module.exports = {
  id: 'xiaohongshu',
  name: '小红书净化',
  desc: '去除小红书开屏、信息流赞助卡片、详情页小部件与营销弹窗，保存图片 / 实况时去水印。',
  rules: [],
  rewrites: [
    r`^https?:\/\/ci\.xiaohongshu\.com\/system_config\/watermark - reject-img`,
    r`^https?:\/\/edith\.xiaohongshu\.com\/api\/sns\/v1\/surprisebox\/(get_style|open|submit_action) - reject-dict`,
    r`^https?:\/\/edith\.xiaohongshu\.com\/api\/sns\/v3\/note\/guide\? - reject-dict`,
    r`^https?:\/\/www\.xiaohongshu\.com\/api\/marketing\/box\/trigger\? - reject-dict`,
    r`^https?:\/\/www\.xiaohongshu\.com\/api\/sns\/(v1\/ads\/resource|v2\/hey\/\w+\/hey_gallery) - reject-dict`,
  ],
  scripts: [
    { name: 'xiaohongshu_purify', type: 'response', pattern: r`^https?:\/\/edith\.xiaohongshu\.com\/api\/sns\/v\d\/(note\/(imagefeed|feed|videofeed|widgets|live_photo\/save|detail)|homefeed|system_service\/(splash_config|config)|search\/(banner|hot)_list|search\/notes|followfeed)`, script: 'xiaohongshu.js', maxSize: 2097152 },
  ],
  mitm: ['edith.xiaohongshu.com', 'www.xiaohongshu.com', 'ci.xiaohongshu.com'],
};
