'use strict';
// 补充覆盖所有静态模块，以及无浏览器 URL API 的代理脚本沙箱。
module.exports = function ({ test, assert, ROOT, files, read, body, sectionOf }) {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  function invoke(file, { url = 'https://example.org/', responseBody, headers = {}, status = 200 } = {}) {
    let result; let calls = 0;
    const ctx = {
      $request: { url, headers: {}, method: 'GET' },
      $done(v) { calls++; result = v; },
      console: { log() {}, warn() {}, error() {} },
      $persistentStore: { read() { return null; }, write() { return true; } },
      $notification: { post() {} },
    };
    if (responseBody !== undefined) ctx.$response = { body: responseBody, headers, status, statusCode: status };
    vm.runInNewContext(read(`modules/scripts/${file}`), ctx, { timeout: 2000 });
    assert(calls === 1, `${file} 应恰好调用一次 $done，实际 ${calls}`);
    return result;
  }
  const jump = (target, prefix = 'https://link.zhihu.com/?target=') => invoke('direct-link.js', { url: prefix + encodeURIComponent(target) });
  test('外链：无 URL / URLSearchParams API 时仍能跳转，并保留目标内部编码', () => {
    const target = 'https://example.org/a%2Fb?token=a%26b&sig=%2B%3D#part';
    assert(jump(target).response.headers.Location === target, '目标编码被破坏');
  });
  test('外链：只解开外层嵌套编码', () => {
    const target = 'https://example.org/path?q=a%2Bb';
    for (let n = 0; n < 3; n++) {
      let wrapped = target;
      for (let i = 0; i < n; i++) wrapped = encodeURIComponent(wrapped);
      assert(jump(wrapped).response.headers.Location === target, `嵌套 ${n} 层失败`);
    }
  });
  test('外链：只允许 HTTP(S)，拒绝危险协议、凭据和响应头注入', () => {
    for (const target of ['javascript:alert(1)', 'data:text/html,test', 'file:///etc/passwd', 'https://user:pass@example.org/', 'https://example.org/\r\nX-Test: bad', 'https://example.org\\@evil.test/']) {
      assert(!jump(target).response, `危险目标被放行：${target}`);
    }
  });
  test('外链：支持无协议 / 协议相对 URL，并拒绝无效输入', () => {
    assert(jump('//example.org/a').response.headers.Location === 'https://example.org/a', '协议相对地址失败');
    assert(jump('example.org/a').response.headers.Location === 'https://example.org/a', '无协议地址失败');
    for (const target of ['', '%E0%A4%A', '/relative', 'not a url', 'https://', 'https://example.org:99999/']) assert(!jump(target).response, `无效地址：${target}`);
  });
  test('外链：按来源主机和路径精确匹配，不处理相似恶意域名', () => {
    for (const prefix of ['https://link.zhihu.com.evil.test/?target=', 'https://example.org/?target=', 'https://www.jianshu.com/normal?target=']) assert(!jump('https://example.org/', prefix).response, `错误来源：${prefix}`);
    assert(jump('https://example.org/', 'https://c.pc.qq.com/middlem.html?pfurl=').response, 'QQ pfurl 未支持');
  });
  test('Safari：空响应 / 非 HTML 原样放行', () => {
    for (const input of [undefined, '', '{"data":1}', 'plain text']) assert(!invoke('safari-clean.js', { responseBody: input }).body, '不应注入非 HTML');
    assert(!invoke('safari-clean.js', { responseBody: '<html></html>', headers: { 'Content-Type': 'application/json' } }).body, 'JSON Content-Type 不应改写');
  });
  test('Safari：大小写 HTML 标签可注入，重复执行不重复注入', () => {
    const out = invoke('safari-clean.js', { responseBody: '<HTML><HEAD></HEAD><BODY>正文</BODY></HTML>', headers: { 'content-type': 'text/html; charset=utf-8' } });
    assert(out.body.includes('safari-clean-style') && out.body.includes('正文'), '未注入或正文丢失');
    const again = invoke('safari-clean.js', { responseBody: out.body });
    assert(!again.body || again.body === out.body, '重复注入');
    assert(!out.body.includes('window.location.assign =') && !out.body.includes('window.location.replace ='), '不应写入只读 Location 方法');
  });
  const samples = [
    ['amap.js', 'https://m5.amap.com/ws/shield/frogserver/aocs/updatable/1'],
    ['weibo.js', 'https://api.weibo.cn/2/statuses/container_timeline'],
    ['xiaohongshu.js', 'https://edith.xiaohongshu.com/api/sns/v1/homefeed'],
    ['bilibili-json.js', 'https://app.bilibili.com/x/v2/feed/index?'],
    ['goofish.js', 'https://acs.m.goofish.com/gw/mtop.taobao.idlehome.home.nextfresh/1.0/'],
    ['coolapk.js', 'https://api.coolapk.com/v6/main/indexV8'],
    ['qidian.js', 'https://magev6.if.qidian.com/argus/api/v4/client/getsplashscreen'],
    ['pwesports.js', 'https://api.pwesports.cn/app/feed'],
    ['tiktok.js', 'https://api.tiktokv.com/aweme/v1/feed/'],
    ['douyin.js', 'https://aweme.snssdk.com/aweme/v1/feed/'],
    ['baidunetdisk.js', 'https://pan.baidu.com/api/getsyscfg'],
    ['tieba-json.js', 'https://tiebac.baidu.com/c/s/sync'],
    ['zhihu.js', 'https://api.zhihu.com/topstory/recommend'],
    ['ximalaya_json.js', 'https://mobile.ximalaya.com/unrelated'],
  ];
  for (const [file, url] of samples) test(`${file}：异常响应只完成一次并原样放行`, () => {
    for (const input of ['', '<html>error</html>', 'null', '{"data":null}']) {
      const out = invoke(file, { url, responseBody: input });
      if (!input || input.startsWith('<')) assert(out && (out.body === undefined || out.body === input), '异常响应被改写');
    }
  });
  for (const file of ['tieba-proto.js', 'bilibili-proto.js']) test(`${file}：损坏二进制响应不抛错`, () => {
    const url = file === 'tieba-proto.js' ? 'https://tiebac.baidu.com/c/f/frs/page?cmd=1' : 'https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/View';
    const out = invoke(file, { url, responseBody: new Uint8Array([255, 255, 255]), status: 200 });
    assert(out && out.body === undefined, '损坏 protobuf 应原样放行');
  });
  test('完美电竞：保留 thread / download / header、字符串 false 和普通福利帖子', () => {
    const normal = [{ type: 'thread', title: '正常帖子' }, { type: 'download' }, { type: 'header' }, { is_ad: 'false' }, { tag: '福利抽奖', title: '讨论广告屏蔽' }, { url: 'https://example.org/reunion' }];
    const ads = [{ type: 'feed_ad' }, { type: 'advertisement' }, { is_ad: true }, { is_ad: '1' }, { label: '广告' }, { url: 'https://example.org/?ad_id=12' }];
    const out = invoke('pwesports.js', { url: 'https://api.pwesports.cn/app/feed', responseBody: JSON.stringify({ data: { list: normal.concat(ads), notice: '赛事公告' } }) });
    const data = JSON.parse(out.body).data;
    assert(JSON.stringify(data.list) === JSON.stringify(normal), '正常帖子误删或广告未删除');
    assert(data.notice === '赛事公告', '正常赛事公告不应删除');
  });
  test('小红书：主页只删明确广告，不因普通 card_icon 删除笔记', () => {
    const input = { data: [{ id: 'normal', card_icon: 'new', note_attributes: ['normal'] }, { id: 'ad', ads_info: { ad_id: 1 } }, { id: 'empty_ad', ads_info: null }] };
    const out = invoke('xiaohongshu.js', { url: 'https://edith.xiaohongshu.com/api/sns/v1/homefeed', responseBody: JSON.stringify(input) });
    assert(JSON.parse(out.body).data.map((x) => x.id).join(',') === 'normal,empty_ad', '普通卡片误删');
  });
  test('B 站 gRPC：完整空消息支持 Uint8Array / ArrayBuffer，坏帧不修改响应头', () => {
    for (const bytes of [new Uint8Array([0, 0, 0, 0, 0]), new Uint8Array([0, 0, 0, 0, 0]).buffer]) {
      const out = invoke('bilibili-proto.js', { url: 'https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/View', responseBody: bytes });
      assert(out.body && out.body.length === 5 && out.body[0] === 0, '合法 gRPC 帧未改写');
    }
    const headers = { 'grpc-encoding': 'gzip' };
    invoke('bilibili-proto.js', { url: 'https://grpc.biliapi.net/bilibili.app.viewunite.v1.View/View', responseBody: new Uint8Array([1, 0, 0, 0, 1, 255]), headers });
    assert(headers['grpc-encoding'] === 'gzip', '异常放行不得污染原响应头');
  });
  test('阿里系单 App 模块：支付宝保护先于 AMDC 全局拒绝', () => {
    for (const name of ['goofish', 'taobao', 'amap']) {
      const rules = body(sectionOf(files[`modules/${name}.sgmodule`], 'Rule'));
      const guard = rules.indexOf('DOMAIN-SUFFIX,alipay.com,DIRECT');
      const amdc = rules.findIndex((l) => l.startsWith('URL-REGEX,') && l.includes('/mobileDispatch'));
      assert(guard >= 0 && amdc > guard, `${name} 缺少支付宝前置保护`);
    }
  });
  for (const name of fs.readdirSync(path.join(ROOT, 'modules/scripts')).filter((n) => n.endsWith('.js'))) {
    test(`${name}：真实代理脚本语法（非 CommonJS）`, () => { new vm.Script(read(`modules/scripts/${name}`)); });
  }
  const forbidden = ['bytegecko.com', 'umeng.com', 'gtimg.cn', 'qzs.qq.com', 'apple.com', 'icloud.com', 'wxs.qq.com'];
  for (const name of fs.readdirSync(path.join(ROOT, 'modules')).filter((n) => n.endsWith('.sgmodule'))) {
    const rel = `modules/${name}`; const text = files[rel] || read(rel);
    test(`${rel}：包括静态模块在内的安全边界`, () => {
      const hosts = body(sectionOf(text, 'MITM')).join(',').replace(/^hostname\s*=\s*%(APPEND|INSERT)%\s*/, '').split(',').map((h) => h.trim()).filter(Boolean);
      assert(!hosts.includes('*') && !hosts.includes('-*'), '不允许全局解密或关闭其它模块的解密');
      const rules = body(sectionOf(text, 'Rule'));
      for (const h of hosts.filter((h) => !h.startsWith('-'))) assert(rules.includes(require('../scripts/build').quicRule(h)), `缺少 QUIC 回落：${h}`);
      for (const line of body(sectionOf(text, 'Rule'))) {
        const [type, value, policy] = line.split(',');
        if (/^DOMAIN(-SUFFIX)?$/.test(type) && /^REJECT/.test(policy || '')) assert(!forbidden.includes(value), `过宽拒绝：${line}`);
      }
    });
    test(`${rel}：脚本 / 重写引用有效且有资源上限`, () => {
      for (const line of body(sectionOf(text, 'Script'))) {
        const pattern = (line.match(/(?:^|,)pattern=(.*?)(?=,(?:script-path|requires-body|max-size|timeout|script-update-interval)=)/) || [])[1];
        assert(pattern, `缺少脚本正则：${line}`); new RegExp(pattern);
        const file = (line.match(/script-path=https:\/\/[^,\s]+\/modules\/scripts\/([^,\s]+)/) || [])[1];
        assert(file && fs.existsSync(path.join(ROOT, 'modules/scripts', file)), '脚本引用不存在');
        assert(/script-update-interval=86400(?:,|$)/.test(line), '缺少脚本更新间隔');
        const timeout = Number((line.match(/timeout=(\d+)/) || [])[1]);
        assert(timeout > 0 && timeout <= (name === 'boxjs.sgmodule' ? 120 : 30), '缺少或过大 timeout');
        if (/type=http-response/.test(line)) {
          const size = Number((line.match(/max-size=(\d+)/) || [])[1]);
          assert(size > 0 && size <= 5242880, '响应体大小限制无效');
        }
      }
      for (const line of body(sectionOf(text, 'URL Rewrite'))) new RegExp(line.split(' ')[0]);
    });
  }
  test('全量模块：关键服务排除同时包含根域名和子域名', () => {
    const text = files['modules/adblock-ultimate.sgmodule'];
    const hosts = body(sectionOf(text, 'MITM')).join(',').split(',').map((x) => x.trim());
    for (const c of require('../src/profile').CRITICAL) {
      assert(hosts.includes(`-${c.domain}`), `缺少根域名排除 ${c.domain}`);
      if (c.type === 'DOMAIN-SUFFIX') assert(hosts.includes(`-*.${c.domain}`), `缺少子域名排除 ${c.domain}`);
    }
  });
};
