// 拼多多：参考 可莉 PinDuoDuo 插件（不改动底部 Tab 与首页金刚区图标）
const r = String.raw;
const API = r`^https:\/\/api\.pinduoduo\.com\/`;
const rejectDict = [
  r`api\/aristotle\/unrated_order_for_unreceived_tab\?`,
  r`api\/aristotle\/query_order_list_tabs_element\?`,
  r`api\/aquarius\/hungary\/global\/homepage\?`,
  r`api\/caterham\/v3\/query\/order_express_group\?`,
  r`search_hotquery\?`,
  r`api\/zaire_biz\/chat\/resource\/get_list_data\?`,
  r`api\/caterham\/v3\/query\/new_chat_group\?`,
  r`api\/alexa\/goods\/back_up\?`,
  r`api\/caterham\/v3\/query\/personal\?`,
  r`api\/brand-olay\/goods_detail\/bybt_guide\?`,
  r`api\/engels\/reviews\/require\/append\?`,
  r`api\/caterham\/v3\/query\/my_order_group\?`,
  r`api\/caterham\/v3\/query\/likes\?`,
  r`api\/phantom\/gbdbpdv\/extra\?`,
  r`api\/manufacturer\/cross\/shortcut\/list\?`,
  r`api\/dunkirk\/liveactivity\/push\/create\/url\/report\?`,
  r`api\/growth\/nagato\/app\/index\/gather\?`,
  r`api\/engels\/wait\/receive\/review\?`,
  r`api\/buffon\/nasus\/recommend\?`,
  r`api\/caterham\/v2\/query\/goods_detail_with_tags\?`,
];
module.exports = {
  id: 'pdd',
  name: '拼多多净化',
  desc: '去除拼多多开屏、首页横幅与搜索热词、个人页 / 订单页 / 聊天页的推荐与营销模块、商品详情页底部推荐；阻断 HTTPDNS、长连接与遥测，让去广告稳定生效。',
  rules: [
    'AND,((URL-REGEX,"^http:\\/\\/((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\/d(\\d)?"),(USER-AGENT,"*com.xunmeng.pinduoduo*")),REJECT',
    'AND,((URL-REGEX,"^http:\\/\\/\\[[0-9a-fA-F:]+\\]\\/d(\\d)?\\?"),(USER-AGENT,"*com.xunmeng.pinduoduo*")),REJECT',
    ...['titan', 'xg', 'apm', 'apm-a', 'th', 'th-a', 'th-b', 'ta', 'ta-a', 'meta', 't-dsp'].map((h) => `DOMAIN,${h}.pinduoduo.com,REJECT`),
    ...['cdl-1', 'cdl-p2', 'cd-1'].map((h) => `DOMAIN,${h}.pddpic.com,REJECT`),
  ],
  rewrites: [
    API + r`api\/cappuccino\/splash - reject`,
    ...rejectDict.map((p) => `${API}${p} - reject-dict`),
  ],
  bodyRewrites: [
    { pattern: API + r`api\/alexa\/homepage\/hub\?`, jq: ['del(.result.dy_module.irregular_banner_dy)', 'del(.result.search_bar_hot_query)'] },
    { pattern: API + r`search\?`, jq: 'del(.expansion)' },
    { pattern: API + r`api\/philo\/personal\/hub\?`, jq: 'del(.monthly_card_entrance, .personal_center_style_v2_vo, .personal_banner)' },
    { pattern: API + r`api\/oak\/integration\/render\?`, jq: ['del(.bottom_section_list)', 'del(.ui.bottom_section)', 'del(.ui.live_section.float_info)'] },
    { pattern: API + r`api\/caterham\/v3\/query\/order_detail_group\?`, jq: 'del(.data.goods_list)' },
    { pattern: API + r`order\/`, jq: ['del(.marketing_banner_vo)', 'del(.shipping.banner_above_recommend)'] },
    { pattern: API + r`api\/aristotle\/order_list_v4\?`, jq: '.orders |= map(if (.order_buttons | type) == "array" then .order_buttons |= map(del(.order_growth_tip)) else . end)' },
  ],
  scripts: [],
  mitm: ['api.pinduoduo.com'],
};
