const r = String.raw;
module.exports = [
  {
    id: 'kfc',
    name: '肯德基净化',
    desc: '去除肯德基 App 开屏、首页营销弹窗与 AI 动态弹窗。',
    rules: ['DOMAIN,dynamicad.kfc.com.cn,REJECT'],
    rewrites: [r`^https?:\/\/res\.kfc\.com\.cn\/(advertisement|CRM\/kfcad)\/ - reject-200`],
    scripts: [],
    mitm: ['res.kfc.com.cn'],
  },
  {
    id: 'mcdonald',
    name: '麦当劳净化',
    desc: '去除麦当劳 App 开屏、首页弹窗营销与热门活动横幅。',
    rules: [],
    rewrites: [r`^https?:\/\/api2?\.mcd\.cn\/bff\/portal\/(home\/(splash|hotActivity)|richpop) - reject-200`],
    scripts: [],
    mitm: ['api.mcd.cn', 'api2.mcd.cn'],
  },
];
