// 百度贴吧：JSON / Protobuf 脚本 + 可莉 Tieba 插件的 jq 净化与接口拒绝（不改动首页 Tab 布局）
// 注意：贴吧对 HTTP/2 解密敏感，开启“通过 HTTP/2 进行中间人攻击”时可能提示未登录，建议关闭该选项。
const r = String.raw;
const TB = r`^https?:\/\/tieba\.baidu\.com\/`;
const TBC = r`^https?:\/\/tiebac\.baidu\.com\/`;
module.exports = {
  id: 'tieba',
  name: '百度贴吧净化',
  desc: '去除贴吧开屏、首页推荐伪装广告贴、吧内商业贴、详情页直播推荐与插楼广告（JSON + Protobuf），精简我的页面、侧边栏与搜索热榜。若提示未登录，请关闭 HTTPS 解密里的“通过 HTTP/2 进行中间人攻击”。',
  rules: [
    'IP-CIDR,180.76.76.200/32,REJECT,no-resolve',
  ],
  rewrites: [
    TBC + r`c\/s\/log - reject-200`,
    TBC + r`c\/f\/forum\/getInterestClassList$ - reject-dict`,
    r`^https?:\/\/(tiebac|tieba)\.baidu\.com\/c\/f\/search\/discover$ - reject-dict`,
    TB + r`c\/f\/forum\/getForumAlbum$ - reject-dict`,
    r`^http:\/\/c\.tieba\.baidu\.com\/c\/f\/forum\/hotforum$ - reject-dict`,
  ],
  bodyRewrites: [
    {
      pattern: TBC + r`c\/u\/user\/profile$`,
      jq: [
        'del(.url_map, .user_agent_info, .bubble_info, .duxiaoman_entry, .uc_card, .finance_tab, .vip_banner, .ala_live_info, .recom_naws_list, .duxiaoman, .namoaixud_entry)',
        'del(.user.consume_info)',
        'if (.user.shake_ad_switch | type) == "object" and (.user.shake_ad_switch | has("is_show")) then .user.shake_ad_switch.is_show = 0 else . end',
        '.custom_grid |= map(select(.title != "游戏大厅" and .title != "预约管理" and .title != "领话费" and .title != "短故事"))',
        '.zone_info |= map(if (.common_func.common_func_noraml | type) == "array" then .common_func.common_func_noraml |= map(select(.name != "创建智能体")) else . end)',
        '.zone_info |= map(select(.type != "commerce" and .type != "banner" and .type != "game"))',
      ],
    },
    { pattern: TB + r`c\/f\/forum\/forumGuide$`, jq: 'del(.hot_search)' },
    { pattern: TB + r`c\/f\/frs\/frsBottom\?`, jq: 'del(.card_activity)' },
    { pattern: TBC + r`c\/f\/frs\/frsBottom$`, jq: 'del(.card_activity)' },
    { pattern: TBC + r`c\/f\/sidebar\/home$`, jq: 'del(.game_center, .task_list, .vip_banner)' },
    { pattern: TB + r`mo\/q\/search\/startPage\?`, jq: '{"no": 0, "error": "success"}' },
  ],
  scripts: [
    { name: 'tieba_json', type: 'response', pattern: r`^https?:\/\/(tiebac|c\.tieba)\.baidu\.com\/(c\/(s\/sync|f\/(ad\/getSplashAd|frs\/(page|threadlist|generalTabList)|pb\/(pic)?page|excellent\/personalized))$|tiebaads\/commonbatch\?)`, script: 'tieba-json.js', maxSize: 1048576 },
    { name: 'tieba_proto', type: 'response', pattern: r`^https?:\/\/(tiebac|c\.tieba)\.baidu\.com\/c\/(b\/ad\/adBid|f\/(frs\/(page|threadlist|generalTabList)|ad\/getFeedAd|pb\/page|excellent\/personalized))\?cmd`, script: 'tieba-proto.js', maxSize: 1048576, binary: true },
  ],
  mitm: ['tiebac.baidu.com', 'c.tieba.baidu.com', 'tieba.baidu.com'],
};
