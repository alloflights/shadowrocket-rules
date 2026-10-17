// 其他 App 的开屏 / 推广接口（无专用脚本，纯 reject 重写）。只解密确有规则的精确主机名。
const r = String.raw;
module.exports = {
  id: 'misc',
  name: '其他 App 开屏净化',
  desc: '小黑盒、NGA、懂球帝、网易大神、斗鱼、虎牙、转转、500px、图虫、中国大学慕课的开屏与推广接口；g.cn / google.cn 首页跳转 google.com。',
  moduleFile: false,
  rules: [
    'DOMAIN,hdads.huya.com,REJECT',
  ],
  rewrites: [
    r`^https?:\/\/(www\.)?(g|google)\.cn\/?(\?.*)?$ https://www.google.com 302`,
    r`^https?:\/\/api\.xiaoheihe\.cn\/bbs\/app\/api\/(startup|ad\/|feed\/ad|general\/v\d\/banner|game\/promote) - reject-dict`,
    r`^https?:\/\/(bbs\.nga\.cn|nga\.178\.com)\/app_api\.php\?.*__lib=(advert|splash) - reject-dict`,
    r`^https?:\/\/api\.dongqiudi\.com\/v\d\/(article\/ad|splash|tab\/ad) - reject-dict`,
    r`^https?:\/\/god\.game\.163\.com\/api\/v\d\/(ad\/|splash) - reject-dict`,
    r`^https?:\/\/(capi|apiv2)\.douyucdn\.cn\/api\/v\d\/(getAppSplash|client_ad|room_ad) - reject-dict`,
    r`^https?:\/\/business\.msorpack\.huya\.com\/.*Adv - reject-dict`,
    r`^https?:\/\/api\.zhuanzhuan\.com\/zz\/transfer\/(splash|ad) - reject-dict`,
    r`^https?:\/\/api\.500px\.com\.cn\/v\d\/(splash|advertisements) - reject-dict`,
    r`^https?:\/\/api\.tuchong\.com\/2\/(splash|ad\/) - reject-dict`,
    r`^https?:\/\/www\.icourse163\.org\/mob\/ad\/ - reject-dict`,
  ],
  scripts: [],
  mitm: ['g.cn', 'www.g.cn', 'google.cn', 'www.google.cn', 'api.xiaoheihe.cn', 'bbs.nga.cn', 'nga.178.com', 'api.dongqiudi.com', 'god.game.163.com', 'capi.douyucdn.cn', 'apiv2.douyucdn.cn', 'business.msorpack.huya.com', 'api.zhuanzhuan.com', 'api.500px.com.cn', 'api.tuchong.com', 'www.icourse163.org'],
};
