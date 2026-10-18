// 闲鱼：AMDC 调度已在 10-adblock 全局阻断（否则 mtop 走 spdy/xQUIC 绕过解密），这里只处理 mtop 接口
const r = String.raw;
const ACS = r`^https?:\/\/(g-)?acs\.m\.goofish\.com\/gw\/`;
const rejectDict = [
  r`mtop\.taobao\.idlecommerce\.splash`,
  r`mtop\.taobao\.idle\.local\.splash`,
  r`mtop\.taobao\.idle\.home\.welcome`,
  r`mtop\.taobao\.idle\.popup\.window`,
  r`mtop\.taobao\.idle\.float\.window`,
  r`mtop\.taobao\.idlemtopsearch\.item\.search\.activate`,
  r`mtop\.taobao\.idlemtopsearch\.search\.discover`,
  r`mtop\.taobao\.idlemtopsearch\.detailpage\.search\.shade`,
  r`mtop\.taobao\.idle\.item\.resell\.recommendorhotcate`,
  r`mtop\.taobao\.idlehome\.idle\.coin\.nextfresh`,
  r`mtop\.taobao\.idle\.local\.home\.top`,
  r`mtop\.idle\.trade\.item\.recommend\.render`,
  r`mtop\.taobao\.idle\.live\.home\.ads\.material\.get`,
  r`mtop\.taobao\.idle\.topic\.banner`,
  r`mtop\.taobao\.wireless\.home\.xianyu(\.my)?\.awesome\.get`,
  r`mtop\.taobao\.idle\.local\.near\.by\.corner\.info`,
  r`mtop\.taobao\.idle\.item\.buy\.feeds`,
];
module.exports = {
  id: 'goofish',
  name: '闲鱼去广告',
  desc: '修复闲鱼去开屏失效（全局阻断 AMDC 调度，强制回落 HTTPS），去除开屏、首页运营位/广告商品、关注页/社区/新发布推广、搜索广告与底纹、悬浮球弹窗、猜你喜欢。首次启用后请删除重装闲鱼一次。',
  rules: [
    'DOMAIN,amdc.m.taobao.com,REJECT',
    'URL-REGEX,"^http:\\/\\/.+\\/amdc\\/mobileDispatch",REJECT',
    'DOMAIN-SUFFIX,iyes.youku.com,REJECT',
  ],
  rewrites: [
    ...rejectDict.map((p) => `${ACS}${p} - reject-dict`),
    `${ACS}${r`mtop\.idle\.ad\.expose`} - reject-200`,
    `${ACS}${r`mtop\.idle\.idleadv`} - reject-200`,
  ],
  // 参考 可莉 FleaMarket 插件（jq 每步独立 try/catch，接口改版时原样放行）
  bodyRewrites: [
    { pattern: ACS + r`mtop\.taobao\.idle\.fun\.follow\.feed\.list\/`, jq: '.data.sections |= map(select(.cardType == 2001))' },
    { pattern: ACS + r`mtop\.taobao\.idlehome\.home\.community\/`, jq: '.data.feedsList |= map(select(.template.name == "idlefish_home_new_commodity_card" or .template.name == "idlefish_home_new_content_card"))' },
    { pattern: ACS + r`mtop\.taobao\.idlehome\.home\.newitem\.page\/`, jq: '.data.sections |= map(select(.data.clickParam.args.cardType as $ct | $ct != "banner" and $ct != "mamaAD"))' },
    { pattern: ACS + r`mtop\.taobao\.idlehome\.magic\.home\.page\.list\/`, jq: 'del(.data.topList)' },
  ],
  scripts: [
    {
      name: 'goofish_clean',
      type: 'response',
      pattern: ACS + r`mtop\.(taobao\.(idlehome\.home\.(nextfresh|circle\.list)|idlehome\.widget\.refresh\.get|idle\.(local\.home|home\.whale\.modulet|user\.strategy\.list|playboy\.recommend|item\.recommend\.list|group\.myself\.banner|circle\.(myself\.banner|visited)|fun\.follow\.often\.visit|local\.flow\.plat\.section)|idlemtopsearch\.search(\.shade)?)|idle\.user\.page\.my\.adapter)\/`,
      script: 'goofish.js',
      maxSize: 2097152,
    },
  ],
  mitm: ['acs.m.goofish.com', 'g-acs.m.goofish.com'],
};
