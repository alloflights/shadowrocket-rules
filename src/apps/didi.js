// 滴滴出行：参考 可莉 DiDi 插件（保留首页导航与顺风车 Tab，不改动功能开关白名单）
const r = String.raw;
module.exports = {
  id: 'didi',
  name: '滴滴出行净化',
  desc: '去除滴滴开屏与活动弹窗、首页推广卡片、个人中心营销模块、代驾 / 货运 / 城际推广、目的地推荐；关闭证书校验开关让去广告生效。',
  rules: [
    'DOMAIN,gwp.xiaojukeji.com,REJECT',
    'DOMAIN,gwpgz.diditaxi.com.cn,REJECT',
    'DOMAIN,adtrack.xiaojukeji.com,REJECT',
  ],
  rewrites: [
    r`^https:\/\/res\.xiaojukeji\.com\/resapi\/activity\/mget(\?|$) - reject-dict`,
    r`^https:\/\/daijia\.kuaidadi\.com(:443)?\/gateway\?api=(prado\.cms\.delivery\.batch|prado\.cms\.AggregateDeliveryRemoteService\.aggregateDelivery|lj\.c\.p\.queryLevelAndRightsStatus|lj\.cos\.p\.popup) - reject-dict`,
    r`^https:\/\/api\.udache\.com\/gulfstream\/porsche\/v\d\/pSFCHomePage\? - reject-dict`,
    r`^https:\/\/htwkop-st\.xiaojukeji\.com\/gateway\?api=cms\.htw\.delivery\.batch - reject-dict`,
    r`^https:\/\/freight\.xiaojukeji\.com\/gateway\?api=freight\.d\.core\.multiDisplayV\d - reject-dict`,
  ],
  bodyRewrites: [
    { pattern: r`^https:\/\/as\.xiaojukeji\.com\/ep\/as\/toggles\?`, jq: '.data |= map(select(.name != "isUseNetConnectivity") | .assign.args.rootca_pin = 0 | .assign.args.sni_list = {})' },
    { pattern: r`^https:\/\/conf\.diditaxi\.com\.cn\/homepage\/v\d\/other\/slow\?`, jq: 'del(.data.order_cards.new_loss_banner_card, .data.order_cards.call_car_card_80)' },
    {
      pattern: r`^https:\/\/conf\.diditaxi\.com\.cn\/homepage\/v\d\/other\/fast\?`,
      jq: [
        'del(.data.disorder_cards.communicate_card, .data.disorder_cards.not_login_bottom_bar, .data.disorder_cards.riding_code_card, .data.disorder_cards.guess_card, .data.disorder_cards.scene_list_card)',
        'del(.data.order_cards)',
        'del(.data.disorder_cards.car_icon.data.icon_info_new_agreement)',
      ],
    },
    {
      pattern: r`^https:\/\/common\.diditaxi\.com\.cn\/common\/v\d\/usercenter\/layout`,
      jq: [
        '.data.instances |= with_entries(select(.key as $k | ["center_base_info_card", "center_tool_card", "center_wallet_finance_card", "center_order_related_card"] | index($k)))',
        '.data.instances.center_wallet_finance_card.data.view_info |= map(select(.title == "优惠卡券"))',
      ],
    },
    {
      pattern: r`^https:\/\/api\.udache\.com\/gulfstream\/porsche\/v\d\/dache_homepage_layout\?`,
      jq: ['del(.data.instances.dache_main_core_icon)', '.data.instances |= with_entries(select(.key | test("feed_back_|dache_main_member|order_container_|dache_main_core_icon|dache_main_card_")))'],
    },
    {
      pattern: r`^https:\/\/api\.udache\.com\/intercity\/ticket\/api\/v\d\/core\/getFullPageInfoLayout\?`,
      jq: '.data.disorder_components |= map(select(.name == "history_order_card" or .name == "inprogress_order_card" or .name == "station_calendar" or .name == "main_card_v2" or .name == "user_history_order"))',
    },
    { pattern: r`^https:\/\/daijia\.kuaidadi\.com(:443)?\/gateway\?api=lj\.cos\.apolloConfig`, jq: '.data |= map(select(.name != "daijia-memberInfo-config" and .name != "daijia-transfer-share-config"))' },
    {
      pattern: r`^https:\/\/api\.udache\.com\/gulfstream\/porsche\/v\d\/bronze\/pinchengle_homepage_layout$`,
      jq: '.data.instances |= with_entries(select(.key as $k | ["dacheanycar-certificates-1", "main-card-1", "map-1", "nav-1", "tool-container-1"] | index($k)))',
    },
    { pattern: r`^https:\/\/htwkop\.xiaojukeji\.com(:443)?\/gateway\?api=hm\.fa\.(querySellCardSummary|queryWelfareCenter)`, jq: 'if has("data") then .data = "{}" else . end' },
    { pattern: r`^https:\/\/poi\.map\.xiaojukeji\.com\/mapapi\/(startinfo\?api_version|poiinfo\?product_id)`, jq: 'del(.rec_destination)' },
    { pattern: r`^https:\/\/common\.diditaxi\.com\.cn\/user_common\/itineraryList\?`, jq: 'del(.data.tab_nav[]?.tab_param)' },
  ],
  scripts: [],
  mitm: ['as.xiaojukeji.com', 'conf.diditaxi.com.cn', 'common.diditaxi.com.cn', 'res.xiaojukeji.com', 'api.udache.com', 'daijia.kuaidadi.com',
    'htwkop-st.xiaojukeji.com', 'htwkop.xiaojukeji.com', 'freight.xiaojukeji.com', 'poi.map.xiaojukeji.com'],
};
