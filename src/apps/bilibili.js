const r = String.raw;
module.exports = {
  id: 'bilibili',
  name: '哔哩哔哩净化',
  desc: '去除 B 站开屏（含品牌 / 事件开屏）、首页推荐流广告、顶栏多余 Tab、播放页广告卡片。',
  rules: [],
  rewrites: [],
  scripts: [
    { name: 'bili_json', type: 'response', pattern: r`^https:\/\/app\.bilibili\.com\/x\/(v2\/(splash\/(list|show|brand\/list|event\/list2)|feed\/index\?)|resource\/show\/tab\/v2)`, script: 'bilibili-json.js', maxSize: 1048576 },
    { name: 'bili_proto', type: 'response', pattern: r`^https:\/\/(grpc\.biliapi\.net|app\.bilibili\.com)\/bilibili\.app\.viewunite\.v1\.View\/View$`, script: 'bilibili-proto.js', maxSize: 1048576, binary: true },
  ],
  mitm: ['app.bilibili.com', 'grpc.biliapi.net'],
};
