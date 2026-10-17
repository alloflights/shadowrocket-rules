const r = String.raw;
module.exports = {
  id: 'umetrip',
  name: '航旅纵横净化',
  desc: '去除航旅纵横开屏、摇一摇跳转第三方、首页弹窗营销与浮层。',
  rules: [
    'DOMAIN,startup.umetrip.com,REJECT',
    'DOMAIN,umestartup.umetrip.com,REJECT',
    'DOMAIN,bda.umetrip.com,REJECT',
    'DOMAIN,opactivity.umetrip.com,REJECT',
    'DOMAIN,sensors.umetrip.com.cn,REJECT',
    'DOMAIN,discardrp.umetrip.com,REJECT',
  ],
  rewrites: [
    r`^https?:\/\/oss\.umetrip\.com\/fs\/advert\/polite - reject-dict`,
  ],
  scripts: [],
  mitm: ['oss.umetrip.com'],
};
