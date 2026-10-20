// 微信公众号文章：参考 可莉 Weixin_Official_Accounts 插件（只解密 mp.weixin.qq.com，不碰微信聊天 / 支付）
const r = String.raw;
module.exports = {
  id: 'wechat-mp',
  name: '微信公众号净化',
  desc: '去除公众号文章底部广告、商品卡片、相关文章推荐与搜索推荐词。只解密 mp.weixin.qq.com，不影响微信聊天与支付。',
  // Shadowrocket 模块规则优先于主配置：只拦下方广告接口，不封 wxs.qq.com 整个素材 CDN。
  // Loon 基础规则暂不调整；构建器显式支持按客户端覆盖 rules。
  shadowrocketRules: [],
  rules: [
    'DOMAIN-SUFFIX,wxs.qq.com,REJECT',
  ],
  rewrites: [
    r`^https:\/\/mp\.weixin\.qq\.com\/mp\/(cps_product_info|getappmsgad|jsmonitor|masonryfeed|relatedarticle)\? - reject-dict`,
    r`^https:\/\/mp\.weixin\.qq\.com\/mp\/relatedsearchword - reject-dict`,
  ],
  scripts: [],
  mitm: ['mp.weixin.qq.com'],
};
