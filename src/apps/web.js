const r = String.raw;
module.exports = [
  {
    id: 'direct-link',
    name: '外链直接跳转',
    desc: '自动跳过知乎、CSDN、掘金、简书、微博、贴吧、QQ、少数派、Gitee、语雀的外链安全确认页。',
    category: '浏览增强',
    rules: [],
    rewrites: [],
    scripts: [
      { name: 'direct_link', type: 'request', pattern: r`^https?:\/\/(link\.(zhihu\.com|csdn\.net|juejin\.cn)|www\.jianshu\.com\/go-wild|weibo\.cn\/sinaurl|jump2?\.bdimg\.com\/safecheck|c\.pc\.qq\.com\/middlem|sspai\.com\/link|gitee\.com\/link|www\.yuque\.com\/r\/goto)`, script: 'direct-link.js' },
    ],
    mitm: ['link.zhihu.com', 'link.csdn.net', 'link.juejin.cn', 'www.jianshu.com', 'weibo.cn', 'jump.bdimg.com', 'jump2.bdimg.com', 'c.pc.qq.com', 'sspai.com', 'gitee.com', 'www.yuque.com'],
  },
  {
    id: 'safari-clean',
    name: 'Safari 网页去打扰',
    desc: '解除知乎、CSDN、贴吧、微博移动网页的“打开 App 查看”遮罩并自动展开全文。',
    category: '浏览增强',
    rules: [],
    rewrites: [],
    scripts: [
      { name: 'safari_clean', type: 'response', pattern: r`^https?:\/\/(m\.zhihu\.com\/(question\/\d+|p\/\d+)|blog\.csdn\.net\/\w+\/article\/details\/\d+|tieba\.baidu\.com\/p\/\d+|m\.weibo\.cn\/detail\/\d+)`, script: 'safari-clean.js', maxSize: 1048576 },
    ],
    mitm: ['m.zhihu.com', 'blog.csdn.net', 'tieba.baidu.com', 'm.weibo.cn'],
  },
];
