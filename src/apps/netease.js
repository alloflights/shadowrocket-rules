const r = String.raw;
const N = r`^https?:\/\/interface\d?\.music\.163\.com\/`;
module.exports = {
  id: 'netease',
  name: '网易云音乐净化',
  desc: '去除网易云音乐开屏、首页 / 发现页 / 推荐页推广、搜索热词、评论区插播与弹窗。',
  rules: [],
  rewrites: [
    N + r`e?api\/content\/activity\/music\/jar\/template\/list - reject-200`,
    N + r`e?api\/sp\/flow\/popup\/query - reject-200`,
    N + r`e?api\/vipmall\/couponcfg\/get - reject-200`,
    N + r`w?eapi\/(resource-exposure\/)?activity - reject-200`,
    N + r`e?api\/comment\/feed\/inserted\/resources - reject-200`,
    N + r`e?api\/resource-exposure\/config - reject-200`,
  ],
  scripts: [
    { name: 'netease_adblock', type: 'response', pattern: N + r`e?api\/(link\/(home\/framework\/tab|page\/(discovery|rcmd)\/resource\/show|position\/show\/resource|scene\/show\/resource)|ios\/upgrade\/get|search\/(default\/keyword\/list|rcmd\/keyword\/get|chart\/(list|detail)|suggest\/keyword\/get|specialkeyword\/get)|ad\/(loading\/(get|current)|get)|vip\/cashier\/tspopup\/get|vipnewcenter\/app\/resource\/newaccountpage|side-bar\/mini-program\/music-service\/account|delivery\/(deliver|batch-deliver)|yunbei\/account\/entrance\/get|creator\/musician\/reminder\/message\/get|batch)`, script: 'netease.adblock.js', maxSize: 1048576 },
  ],
  mitm: ['interface*.music.163.com'],
};
