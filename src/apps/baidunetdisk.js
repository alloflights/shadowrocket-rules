const r = String.raw;
const PAN = r`^https?:\/\/pan\.baidu\.com\/`;
module.exports = {
  id: 'baidunetdisk',
  name: '百度网盘净化',
  desc: '去除百度网盘开屏与倒计时、首页卡片推广、金刚区短剧/小说/打印/求职入口、会员引导、福利活动与热榜，拒绝广告配置下发（参考可莉 BaiduNetDisk 插件）；不触碰文件列表与传输。',
  rules: [
    'DOMAIN,update.pan.baidu.com,REJECT',
    'DOMAIN,fc-video.cdn.bcebos.com,REJECT',
    'DOMAIN,rp.hpplay.cn,REJECT',
    'DOMAIN-SUFFIX,afd.baidu.com,REJECT',
  ],
  rewrites: [
    PAN + r`rest\/.*\/membership\/(proxy\/)?guide - reject-200`,
    PAN + r`pmall\/order\/privilege\/info - reject-dict`,
    PAN + r`api\/useractivity\/activity - reject-dict`,
    PAN + r`api\/certuser\/get - reject-dict`,
    PAN + r`component\/view\/(1510|1130)\?vip - reject-dict`,
    PAN + r`feed\/hotlist - reject-200`,
    PAN + r`coins\/center\/notice - reject-200`,
    PAN + r`queryintent\/queryhint - reject-200`,
    PAN + r`api\/taskscore\/tasklist - reject-dict`,
    PAN + r`(buy\/ad\/analytics|api\/analytics) - reject-200`,
    PAN + r`api\/getconfig\? - reject-dict`,
    PAN + r`api\/getsyscfg\? - reject-dict`,
    PAN + r`act\/api\/activityentry\? - reject-dict`,
    PAN + r`rest\/\d\.\d\/pcs\/adv\? - reject-dict`,
    PAN + r`api\/plugin\/get\? - reject-dict`,
    PAN + r`recommend\/query\/list\? - reject-dict`,
    r`^https?:\/\/ndstatic\.cdn\.bcebos\.com\/activity\/welfare\/(js\/.+\.js|index\.html) - reject-200`,
    r`^https?:\/\/staticsns\.cdn\.bcebos\.com\/amis\/.+\/banner\.png - reject-img`,
    r`^https?:\/\/issuecdn\.baidupcs\.com\/issue\/netdisk\/.*(guanggao|splash|advert|\/ad\/) - reject-img`,
  ],
  bodyRewrites: [
    { pattern: PAN + r`feed\/kingkongdistrict\?`, jq: '.data.data |= map(select(.type != "novel" and .type != "shortplay" and .type != "print" and .type != "job_hunt"))' },
  ],
  scripts: [
    { name: 'baidunetdisk_splash', type: 'request', pattern: PAN + r`.*(pcs\/adx?|membership\/advertise|splash|buy\/ad\/(conf|get)|api\/ad\/|act\/v\d\/(bchannel|welfare)\/list|feed\/cardinfos|recommend\/shortseries\/list)`, script: 'baidunetdisk.js' },
    { name: 'baidunetdisk_clean', type: 'response', pattern: PAN + r`(feed\/(?!kingkongdistrict)|act\/|pmall\/|.*(welfare|bchannel|pcs\/ad))`, script: 'baidunetdisk.js', maxSize: 2097152 },
  ],
  mitm: ['pan.baidu.com', 'ndstatic.cdn.bcebos.com', 'staticsns.cdn.bcebos.com', 'issuecdn.baidupcs.com'],
};
