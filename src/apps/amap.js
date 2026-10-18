const r = String.raw;
const M5 = r`^https:\/\/m5\.amap\.com\/ws\/`;
module.exports = {
  id: 'amap',
  name: '高德地图净化',
  desc: '去除高德地图开屏、首页营销卡片、搜索热词、路线规划推广、导航结束打车/福利弹窗。',
  author: 'RuCu6,kokoryh,alloflights',
  rules: [
    'URL-REGEX,"^http:\\/\\/.+\\/amdc\\/mobileDispatch",REJECT',
  ],
  rewrites: [
    M5 + r`faas\/amap-navigation\/card-service-(car-end|route-plan)\? - reject-dict`,
    M5 + r`faas\/amap-navigation\/main-page-(assets|location)\? - reject-dict`,
    M5 + r`(mapapi\/hint_text\/offline_data|message\/notice\/list|shield\/search\/new_hotword)\? - reject-dict`,
    M5 + r`shield\/search_poi\/tips_adv\? - reject-dict`,
    M5 + r`shield\/scene\/recommend\? - reject-dict`,
    M5 + r`valueadded\/weather\/v2\? - reject-dict`,
    r`^https:\/\/oss\.amap\.com\/ws\/banner\/lists\/\? - reject-dict`,
    r`^https:\/\/sns\.amap\.com\/ws\/msgbox\/pull_mp\? - reject-dict`,
    r`^https:\/\/m5-zb\.amap\.com\/ws\/boss\/(order\/car\/king_toolbox_car_bubble|tips\/onscene_visual_optimization)\? - reject-dict`,
  ],
  scripts: [
    { name: 'amap_drive', type: 'response', pattern: M5 + r`perception\/drive\/(routeInfo|routePlan)\?`, script: 'amap.js', maxSize: 1048576 },
    { name: 'amap_poi', type: 'response', pattern: M5 + r`shield\/search\/(common\/coupon\/info|poi\/detail)\?`, script: 'amap.js', maxSize: 1048576 },
    { name: 'amap_market', type: 'response', pattern: M5 + r`shield\/search_business\/process\/marketingOperationStructured\?`, script: 'amap.js', maxSize: 1048576 },
    { name: 'amap_search', type: 'response', pattern: M5 + r`shield\/search_poi\/(homepage|mps|search\/sp|sug|tips_operation_location)\?`, script: 'amap.js', maxSize: 1048576 },
    { name: 'amap_home', type: 'response', pattern: M5 + r`faas\/amap-navigation\/(card-service-plan-home|main-page)\?`, script: 'amap.js', maxSize: 1048576 },
    { name: 'amap_frog', type: 'response', pattern: M5 + r`shield\/frogserver\/aocs\/updatable\/1\?`, script: 'amap.js', maxSize: 1048576 },
  ],
  mitm: ['m5.amap.com', 'm5-zb.amap.com', 'oss.amap.com', 'sns.amap.com'],
};
