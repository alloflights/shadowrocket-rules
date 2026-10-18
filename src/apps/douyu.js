// 斗鱼：参考 可莉 Douyu 插件（不阻断 P2P 端口与 CDN 调度，避免影响看直播）
const r = String.raw;
module.exports = {
  id: 'douyu',
  name: '斗鱼净化',
  desc: '去除斗鱼开屏广告、直播间挂件与入口推广、首页活动悬浮、带货与游戏推广开关；阻断 P2P 上传 STUN 与连麦调度。',
  rules: [
    'URL-REGEX,"^http:\\/\\/linkmicschedule\\.douyucdn\\.cn\\/im_schedule\\/im_gate_list",REJECT',
    'DOMAIN,stun1.douyucdn.cn,REJECT',
    'DOMAIN,stun1.qvb.qcloud.com,REJECT',
  ],
  rewrites: [
    r`^https:\/\/rtbapi\.douyucdn\.cn\/japi\/sign\/app\/getinfo - reject-dict`,
  ],
  bodyRewrites: [
    { pattern: r`^https:\/\/apiv2\.douyucdn\.cn\/japi\/entrance\/roomRes\/nc\/m\/list`, jq: 'del(.data.pendant_a, .data.entrance_d)' },
    {
      pattern: r`^https:\/\/venus\.douyucdn\.cn\/venus\/config\/static\/update.+keyCodeSet=flow_config`,
      jq: 'reduce ("greatGodGameSitterSwitch", "followMoreAnchorEntrance", "sdklivebanner", "homeActFloatSwitch", "bringGoodsSwitch", "qqGameSwitch") as $k (.; if has($k) then .[$k] = 0 else . end)',
    },
  ],
  scripts: [],
  mitm: ['rtbapi.douyucdn.cn', 'apiv2.douyucdn.cn', 'venus.douyucdn.cn'],
};
