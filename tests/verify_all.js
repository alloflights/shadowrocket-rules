const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(err);
        process.exitCode = 1;
    }
}

// Helper to execute script in a simulated Surge/Shadowrocket sandbox
function executeScript(scriptPath, requestObj, responseObj) {
    const code = fs.readFileSync(scriptPath, 'utf8');
    let doneOutput = null;
    const sandbox = {
        $request: requestObj,
        $response: responseObj,
        $done: (res) => {
            doneOutput = res;
        },
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        Date: Date,
        JSON: JSON,
        Array: Array,
        Object: Object,
        String: String,
        Number: Number,
        Boolean: Boolean,
        Math: Math,
        RegExp: RegExp,
        decodeURIComponent: decodeURIComponent,
        encodeURIComponent: encodeURIComponent
    };
    if (typeof responseObj === 'undefined') {
        delete sandbox.$response;
    }
    const context = vm.createContext(sandbox);
    vm.runInContext(code, context);
    return doneOutput;
}

console.log('================================================================');
console.log('1. DEEP VERIFICATION: Shadowrocket Scripts Execution & Edge Cases');
console.log('================================================================');

// ---------------------------------------------------------
// Baidu Netdisk Tests
// ---------------------------------------------------------
console.log('\n--- Testing baidunetdisk.js ---');
const baiduScriptPath = path.join(__dirname, '../modules/scripts/baidunetdisk.js');

runTest('Baidu Netdisk http-request mock (/pcs/adx): returns errno 0, empty ads, and null splash', () => {
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/rest/2.0/pcs/adx?version=12.5.0' }, undefined);
    assert(res && res.response, 'Expected response object');
    assert.strictEqual(res.response.status, 200);
    const body = JSON.parse(res.response.body);
    assert.strictEqual(body.errno, 0);
    assert.strictEqual(body.error_code, 0);
    assert(body.data && typeof body.data === 'object', 'data dictionary must exist to prevent client fallback to disk cache');
    assert.strictEqual(body.data.splash, null, 'data.splash must be null (not empty dict) to avoid blank splash container');
    assert(Array.isArray(body.data.ad_list) && body.data.ad_list.length === 0);
    assert.strictEqual(body.splash, null);
    assert(Array.isArray(body.ad_list) && body.ad_list.length === 0);
    assert(Array.isArray(body.ads) && body.ads.length === 0);
});

runTest('Baidu Netdisk http-request mock (/pcs/ad): returns data object with empty lists', () => {
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/rest/2.0/pcs/ad' }, undefined);
    assert(res && res.response);
    const body = JSON.parse(res.response.body);
    assert.strictEqual(body.errno, 0);
    assert(body.data && typeof body.data === 'object');
    assert.strictEqual(body.data.splash, null);
    assert(Array.isArray(body.data.ad_list) && body.data.ad_list.length === 0);
});

runTest('Baidu Netdisk http-request mock (/act/api/activityentry): returns errno 0', () => {
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/act/api/activityentry' }, undefined);
    assert(res && res.response);
    const body = JSON.parse(res.response.body);
    assert.strictEqual(body.errno, 0);
    assert(Array.isArray(body.data) && body.data.length === 0);
});

runTest('Baidu Netdisk http-request mock (/feed/cardinfos): returns empty cards', () => {
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/feed/cardinfos' }, undefined);
    assert(res && res.response);
    const body = JSON.parse(res.response.body);
    assert.strictEqual(body.errno, 0);
    assert(Array.isArray(body.card_list) && body.card_list.length === 0);
});

runTest('Baidu Netdisk http-response filtering: strips splash, mediation configs and cleans ad lists', () => {
    const mockPayload = {
        errno: 0,
        data: {
            ad_list: [{ id: 1, img: "https://issuecdn.baidupcs.com/ad1.jpg" }],
            splash: { duration: 5, img: "https://issuecdn.baidupcs.com/splash.jpg" },
            splash_list: [{ id: 1 }],
            gromore_config: { appId: "123" },
            pangle_config: { slotId: "456" },
            config: { ad: 1 }
        },
        config: {
            splash_config: { show: 1 },
            gromore_config: { enable: true }
        },
        ad_list: [{ id: 2 }],
        card_list: [{ title: "短剧推广" }]
    };
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/rest/2.0/pcs/ad' }, { status: 200, body: JSON.stringify(mockPayload) });
    assert(res && res.body, 'Expected body in $done');
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.errno, 0);
    assert.strictEqual(parsed.data.ad_list.length, 0);
    assert.strictEqual(parsed.data.splash, undefined);
    assert.strictEqual(parsed.data.gromore_config, undefined);
    assert.strictEqual(parsed.data.pangle_config, undefined);
    assert.strictEqual(parsed.config.splash_config, undefined);
    assert.strictEqual(parsed.config.gromore_config, undefined);
    assert.strictEqual(parsed.splash, null);
    assert.strictEqual(parsed.card_list.length, 0);
});

runTest('Baidu Netdisk edge case: handles malformed JSON response gracefully without throwing', () => {
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/rest/2.0/pcs/ad' }, { status: 200, body: 'Not Valid JSON {{{' });
    assert(res && typeof res === 'object');
});

runTest('Baidu Netdisk edge case: handles null data payload gracefully', () => {
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/rest/2.0/pcs/ad' }, { status: 200, body: JSON.stringify({ errno: 0, data: null }) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.errno, 0);
});

runTest('Baidu Netdisk http-response filtering preserves normal array data for non-ad endpoints', () => {
    const normalPayload = {
        errno: 0,
        data: [{ server_filename: "my_document.pdf", size: 1024 }],
        gromore_config: { dummy: 1 }
    };
    const res = executeScript(baiduScriptPath, { url: 'https://pan.baidu.com/rest/2.0/xpan/file?method=list' }, { status: 200, body: JSON.stringify(normalPayload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.errno, 0);
    assert(Array.isArray(parsed.data) && parsed.data.length === 1, 'Legitimate file lists must NOT be erased');
    assert.strictEqual(parsed.data[0].server_filename, "my_document.pdf");
    assert.strictEqual(parsed.gromore_config, undefined);
});

// ---------------------------------------------------------
// Coolapk Tests
// ---------------------------------------------------------
console.log('\n--- Testing coolapk.js ---');
const coolapkScriptPath = path.join(__dirname, '../modules/scripts/coolapk.js');

runTest('Coolapk /main/init: purges imageScaleCard, titled splash entities, and scrubs SDK tracking keys', () => {
    const mockInitPayload = {
        data: [
            {
                entityId: 1001,
                title: "正常功能卡片",
                entities: [
                    { entityId: 944, title: "开屏广告推广" },
                    { entityId: 2002, title: "正常子模块" }
                ],
                extraData: {
                    gromore: "sdk_token_123",
                    pangle: "pangle_cfg",
                    launch_time: 5000,
                    normalKey: "keep_me"
                }
            },
            {
                entityId: 945,
                title: "开屏穿透投放卡片"
            },
            {
                entityId: 5000,
                entityTemplate: "imageScaleCard",
                title: "全屏大图开屏投放"
            },
            {
                entityId: 20131,
                title: "酷品好物"
            }
        ],
        config: {
            gromore_config: { appId: "123" },
            splash_config: { timeout: 5 }
        }
    };

    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/init' }, { status: 200, body: JSON.stringify(mockInitPayload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.length, 1, 'All ad/splash entities including imageScaleCard and entity 20131 must be purged');
    assert.strictEqual(parsed.data[0].entities.length, 1, 'Nested ad entity 944 must be removed');
    assert.strictEqual(parsed.data[0].entities[0].entityId, 2002);
    assert.strictEqual(parsed.data[0].extraData.gromore, undefined, 'gromore must be stripped');
    assert.strictEqual(parsed.data[0].extraData.pangle, undefined, 'pangle must be stripped');
    assert.strictEqual(parsed.data[0].extraData.launch_time, undefined, 'launch_time must be stripped');
    assert.strictEqual(parsed.data[0].extraData.normalKey, "keep_me", 'normalKey must be preserved');
    assert.strictEqual(parsed.config.gromore_config, undefined);
    assert.strictEqual(parsed.config.splash_config, undefined);
});

runTest('Coolapk http-request mock (/splash): returns empty data immediately', () => {
    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/splash' }, undefined);
    assert(res && res.response);
    assert.strictEqual(res.response.status, 200);
    const body = JSON.parse(res.response.body);
    assert(Array.isArray(body.data) && body.data.length === 0);
});

runTest('Coolapk /main/index: filters sponsorCard, goodsCard, and promotion items', () => {
    const mockIndexPayload = {
        data: [
            { id: 1, entityType: "feed", title: "真正的数码极客动态" },
            { id: 2, entityTemplate: "sponsorCard", title: "赞助推广" },
            { id: 3, entityTemplate: "goodsCard", title: "618大促带货" },
            { id: 4, entityType: "card", title: "酷安热搜" },
            { id: 5, entityId: 24455, title: "广告推广实体" },
            { id: 6, entityType: "feed", title: "另一条真实酷友动态" }
        ]
    };

    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/indexV11' }, { status: 200, body: JSON.stringify(mockIndexPayload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.length, 2, 'Only 2 genuine feeds should remain');
    assert.strictEqual(parsed.data[0].id, 1);
    assert.strictEqual(parsed.data[1].id, 6);
});

runTest('Coolapk /feed/detail: removes detailSponsorCard, include_goods, and reply ads', () => {
    const mockDetailPayload = {
        data: {
            id: 12345,
            message: "动态正文",
            detailSponsorCard: [{ ad: true }],
            include_goods: [{ goods: "phone" }],
            hotReplyRows: [
                { id: 1, entityType: "reply", message: "真机友评论" },
                { id: 2, entityType: "ad", message: "拼多多推广评论" }
            ]
        }
    };

    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/feed/detail?id=12345' }, { status: 200, body: JSON.stringify(mockDetailPayload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.detailSponsorCard.length, 0);
    assert.strictEqual(parsed.data.include_goods.length, 0);
    assert.strictEqual(parsed.data.hotReplyRows.length, 1);
    assert.strictEqual(parsed.data.hotReplyRows[0].id, 1);
});

runTest('Coolapk edge case: handles malformed or empty response body gracefully', () => {
    const res1 = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/init' }, { status: 200, body: '' });
    assert(res1 && typeof res1 === 'object');
    const res2 = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/init' }, { status: 200, body: '{{' });
    assert(res2 && typeof res2 === 'object');
});

runTest('Coolapk recursive sanitizer removes GDT/JAD popup cards and commercial deep links while preserving normal content', () => {
    const payload = {
        data: [
            {
                id: 10,
                entityType: 'feed',
                title: '正常内容',
                extraData: { gdt: { slot: 'x' }, jad: { slot: 'y' }, keep: 'yes' },
                entities: [
                    { id: 11, entityType: 'popup', title: '热门推荐礼盒', jump_url: 'jdmobile://virtual?sku=7fresh' },
                    { id: 12, entityType: 'feed', title: '正常子内容' }
                ],
                nested: {
                    floating_layer: { title: '摇动/点击了解更多内容', link: 'https://ad.jd.com/7fresh' },
                    normal: { id: 13, title: '保留的嵌套对象' }
                }
            },
            { id: 20, entityType: 'card', title: '七鲜生鲜推广', deeplink: 'https://gdt.qq.com/click?ad=1' }
        ]
    };
    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/indexV12' }, { status: 200, body: JSON.stringify(payload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.length, 1);
    assert.strictEqual(parsed.data[0].entities.length, 1);
    assert.strictEqual(parsed.data[0].entities[0].id, 12);
    assert.strictEqual(parsed.data[0].extraData.gdt, undefined);
    assert.strictEqual(parsed.data[0].extraData.jad, undefined);
    assert.strictEqual(parsed.data[0].extraData.keep, 'yes');
    assert.strictEqual(parsed.data[0].nested.floating_layer, undefined);
    assert.strictEqual(parsed.data[0].nested.normal.id, 13);
});

runTest('Coolapk sanitizer catches encoded Tencent/JAD click links without deleting normal containers', () => {
    const payload = {
        data: [{
            entityType: 'feed',
            title: '正常容器',
            campaign: {
                entityType: 'card',
                title: '优量汇推广',
                click_url: encodeURIComponent('https://sdk.e.qq.com/click?ad=1')
            },
            normal: {
                entityType: 'card',
                title: '普通内容',
                click_url: 'https://example.com/article'
            }
        }]
    };
    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/indexV13' }, { status: 200, body: JSON.stringify(payload) });
    const parsed = JSON.parse(res.body);
    assert(parsed.data[0].campaign === undefined, 'Encoded GDT click card must be removed');
    assert(parsed.data[0].normal, 'Normal card must be preserved');
});

runTest('Coolapk request mock covers launch/open-screen/startup variants with a valid empty 200 structure', () => {
    const urls = [
        'https://api.coolapk.com/v6/main/launch',
        'https://api12.coolapk.com/v6/main/launch_ad',
        'https://api123.coolapk.com/v6/main/startup-ad?version=1',
        'https://api.coolapk.com/v6/main/bootAd',
        'https://api.coolapk.com/v6/main/openScreen',
        'https://api.coolapk.com/v6/main/openscreen',
        'https://api.coolapk.com/v6/main/open-screen',
        'https://api.coolapk.com/v6/ad/request'
    ];
    urls.forEach(url => {
        const res = executeScript(coolapkScriptPath, { url }, undefined);
        assert(res && res.response, `Expected request mock for ${url}`);
        assert.strictEqual(res.response.status, 200);
        const body = JSON.parse(res.response.body);
        assert.strictEqual(body.code, 0);
        assert.strictEqual(body.splash, null);
        assert(Array.isArray(body.data));
    });
});

runTest('Coolapk response sanitizer tolerates a missing $request object', () => {
    const payload = { data: [{ entityType: 'card', title: '广告推广' }] };
    const res = executeScript(coolapkScriptPath, undefined, { status: 200, body: JSON.stringify(payload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert(Array.isArray(parsed.data) && parsed.data.length === 0);
});

runTest('Coolapk sanitizer removes numeric ad flags but preserves ordinary福利 text', () => {
    const payload = { data: [
        { entityType: 'feed', title: '福利经验分享', description: '普通用户经验，不含商业跳转' },
        { entityType: 'card', is_ad: 1, title: '推广卡片' }
    ] };
    const res = executeScript(coolapkScriptPath, { url: 'https://api.coolapk.com/v6/main/indexV14' }, { status: 200, body: JSON.stringify(payload) });
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.length, 1);
    assert.strictEqual(parsed.data[0].title, '福利经验分享');
});

// ---------------------------------------------------------
// Douyin media/ad response tests
// ---------------------------------------------------------
console.log('\n--- Testing douyin.js and douyin-web.js ---');
const douyinScriptPath = path.join(__dirname, '../modules/scripts/douyin.js');
const douyinWebScriptPath = path.join(__dirname, '../modules/scripts/douyin-web.js');

runTest('Douyin JSON purifier removes explicit ad cards, strips commerce overlays, and normalizes playwm URLs', () => {
    const payload = {
        aweme_list: [
            {
                aweme_id: 'normal-1',
                video: {
                    play_addr: { url_list: ['https://cdn.example.test/video/playwm/abc.mp4'] },
                    download_addr: { url_list: ['https://cdn.example.test/video/playwm/download.mp4'] },
                    bit_rate: [{ play_addr: { url_list: ['https://cdn.example.test/video/playwm/abc-hd.mp4'] } }]
                },
                commerce_info: { product_id: '7fresh' },
                image_post_info: {
                    images: [{ display_image: { url_list: ['https://cdn.example.test/image/original.jpg'] } }]
                }
            },
            { aweme_id: 'ad-1', is_ads: true, title: '商业推广视频' }
        ]
    };
    const res = executeScript(douyinScriptPath, { url: 'https://aweme.snssdk.com/aweme/v1/feed/' }, { status: 200, body: JSON.stringify(payload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.aweme_list.length, 1);
    const item = parsed.aweme_list[0];
    assert.strictEqual(item.video.play_addr.url_list[0], 'https://cdn.example.test/video/play/abc.mp4');
    assert.strictEqual(item.video.download_addr.url_list[0], 'https://cdn.example.test/video/play/download.mp4');
    assert.strictEqual(item.video.bit_rate[0].play_addr.url_list[0], 'https://cdn.example.test/video/play/abc-hd.mp4');
    assert.strictEqual(item.commerce_info, undefined);
    assert.strictEqual(item.image_post_info.without_watermark, undefined);
    assert.strictEqual(item.image_post_info.images[0].owner_watermark_image, undefined);
});

runTest('Douyin web extractor injects a toolbar only when public page data contains media', () => {
    const data = {
        item: {
            video: { play_addr: { url_list: ['https://cdn.example.test/video/playwm/web.mp4'] } },
            images: [{ url_list: ['https://cdn.example.test/image/1.jpg'] }]
        }
    };
    const html = '<html><body><script id="RENDER_DATA">' + encodeURIComponent(JSON.stringify(data)) + '</script></body></html>';
    const res = executeScript(douyinWebScriptPath, { url: 'https://www.douyin.com/video/1' }, { status: 200, body: html });
    assert(res && res.body);
    assert(res.body.includes('douyin-clean-bar'));
    assert(res.body.includes('https://cdn.example.test/video/play/web.mp4'));
    assert(res.body.includes('查看/保存原图'));
});

runTest('Douyin web extractor accepts SIGI_STATE hydration data', () => {
    const data = {
        item: {
            video: { play_addr: { url_list: ['https://cdn.example.test/video/playwm/sigi.mp4'] } }
        }
    };
    const html = '<html><body><script id="SIGI_STATE">' + JSON.stringify(data) + '</script></body></html>';
    const res = executeScript(douyinWebScriptPath, { url: 'https://www.douyin.com/note/2' }, { status: 200, body: html });
    assert(res && res.body);
    assert(res.body.includes('douyin-clean-bar'));
    assert(res.body.includes('https://cdn.example.test/video/play/sigi.mp4'));
});

runTest('Douyin purifier does not forge download permissions or watermark metadata', () => {
    const payload = {
        aweme_list: [{
            aweme_id: 'permission-1',
            prevent_download: true,
            aweme_acl: { download_general: { code: 2 } },
            video: { play_addr: { url_list: ['https://cdn.example.test/video/playwm/fallback.mp4'] } }
        }]
    };
    const res = executeScript(douyinScriptPath, { url: 'https://aweme.snssdk.com/aweme/v1/feed/' }, { status: 200, body: JSON.stringify(payload) });
    const item = JSON.parse(res.body).aweme_list[0];
    assert.strictEqual(item.prevent_download, true);
    assert.deepStrictEqual(item.aweme_acl, { download_general: { code: 2 } });
    assert.strictEqual(item.video.download_addr.url_list[0], 'https://cdn.example.test/video/play/fallback.mp4');
    assert.strictEqual(item.video.has_watermark, undefined);
});

runTest('Douyin web extractor parses nested _ROUTER_DATA without truncating inner braces', () => {
    const data = {
        page: { title: '文本包含 } 花括号' },
        nested: { media: { video: { play_addr: { url_list: ['https://cdn.example.test/video/playwm/router.mp4'] } } } }
    };
    const html = '<html><body><script>window._ROUTER_DATA = ' + JSON.stringify(data) + ';</script></body></html>';
    const res = executeScript(douyinWebScriptPath, { url: 'https://www.douyin.com/video/router' }, { status: 200, body: html });
    assert(res && res.body);
    assert(res.body.includes('douyin-clean-bar'));
    assert(res.body.includes('https://cdn.example.test/video/play/router.mp4'));
});

runTest('Douyin routing avoids the broad webcast kill switch across complete configurations', () => {
    const files = [
        'modules/douyin.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of files) {
        const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
        assert(!content.includes('DOMAIN-KEYWORD,webcast,REJECT'), `Broad webcast REJECT must not be present in ${relPath}`);
    }
});

// ---------------------------------------------------------
// GDT/JAD synchronization tests
// ---------------------------------------------------------
console.log('\n--- Testing synchronized GDT/JAD rules ---');
const gdtJadFiles = [
    'modules/coolapk.sgmodule',
    'modules/adblock-ultimate.sgmodule',
    'Shadowrocket_LazyGroup_Merged.conf',
    'Shadowrocket_AllInOne_Ultimate.conf'
];
const gdtJadRules = [
    'DOMAIN-SUFFIX,gdt.qq.com,REJECT',
    'DOMAIN,c.gdt.qq.com,REJECT',
    'DOMAIN,v.gdt.qq.com,REJECT',
    'DOMAIN,win.gdt.qq.com,REJECT',
    'DOMAIN,t.gdt.qq.com,REJECT',
    'DOMAIN,api.gdt.qq.com,REJECT',
    'DOMAIN,mi.gdt.qq.com,REJECT',
    'DOMAIN-SUFFIX,e.qq.com,REJECT',
    'DOMAIN,sdk.e.qq.com,REJECT',
    'DOMAIN,ad.qq.com,REJECT',
    'DOMAIN-SUFFIX,qzs.qq.com,REJECT',
    'DOMAIN-SUFFIX,pgdt.gtimg.cn,REJECT',
    'DOMAIN-SUFFIX,pgdt.ugdtimg.com,REJECT',
    'DOMAIN-SUFFIX,adsmind.gdtimg.com,REJECT',
    'DOMAIN-SUFFIX,adsmind.ugdtimg.com,REJECT',
    'DOMAIN-SUFFIX,splashqzs.gdtimg.com,REJECT',
    'DOMAIN-SUFFIX,qzs.gdtimg.com,REJECT',
    'DOMAIN-SUFFIX,v2.gdt.qq.com,REJECT',
    'DOMAIN-SUFFIX,tangram.e.qq.com,REJECT',
    'DOMAIN-SUFFIX,gdtimg.com,REJECT',
    'DOMAIN-SUFFIX,ugdtimg.com,REJECT',
    'DOMAIN-SUFFIX,gtimg.cn,REJECT',
    'DOMAIN-SUFFIX,tmead.y.qq.com,REJECT',
    'DOMAIN-SUFFIX,tmeadquic.y.qq.com,REJECT',
    'DOMAIN-SUFFIX,ad.tencentmusic.com,REJECT',
    'DOMAIN-SUFFIX,adstats.tencentmusic.com,REJECT',
    'DOMAIN-SUFFIX,jadyun.com,REJECT',
    'DOMAIN-SUFFIX,jad.jd.com,REJECT',
    'DOMAIN-SUFFIX,dsp-x.jd.com,REJECT',
    'DOMAIN-SUFFIX,ad.jd.com,REJECT',
    'IP-CIDR,119.29.29.98/32,REJECT,no-resolve',
    'IP-CIDR,182.254.116.0/24,REJECT,no-resolve'
];
runTest('GDT/JAD rules and Tencent HTTPDNS blocks are synchronized across all four surfaces', () => {
    for (const relPath of gdtJadFiles) {
        const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
        for (const rule of gdtJadRules) assert(content.includes(rule), `Missing ${rule} in ${relPath}`);
    }
});

runTest('Broad GDT image blocking wins before existing gtimg.cn DIRECT fallbacks in complete configs', () => {
    for (const relPath of ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf']) {
        const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
        const rejectAt = content.indexOf('DOMAIN-SUFFIX,gtimg.cn,REJECT');
        const directAt = content.indexOf('DOMAIN-SUFFIX,gtimg.cn,DIRECT');
        assert(rejectAt >= 0, `Missing GDT reject rule in ${relPath}`);
        assert(directAt < 0 || rejectAt < directAt, `gtimg.cn DIRECT must not shadow GDT REJECT in ${relPath}`);
    }
});

runTest('Coolapk startup routes use a valid HTTP request mock instead of reject-dict', () => {
    const files = [
        'modules/coolapk.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of files) {
        const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
        assert(content.includes('酷安_开屏Mock = type=http-request'), `Missing Coolapk startup mock in ${relPath}`);
        assert(content.includes('openscreen|open-screen'), `Coolapk mock must cover lowercase and hyphenated open-screen paths in ${relPath}`);
        assert(content.includes('launch_ad|launch-ad|launchad'), `Coolapk mock must cover launch-ad variants in ${relPath}`);
        assert(content.includes('startup_ad|startup-ad|startupad'), `Coolapk mock must cover startup-ad variants in ${relPath}`);
        assert(content.includes('api\\d*\\.coolapk'), `Coolapk API host pattern must support api, api2 and future numbered hosts in ${relPath}`);
        assert(!content.includes('(splash|launch|openScreen) - reject-dict'), `Coolapk startup must not use reject-dict in ${relPath}`);
    }
});

// ---------------------------------------------------------
// Perfect World Esports (完美世界电竞) Tests
// ---------------------------------------------------------
console.log('\n--- Testing pwesports.js ---');
const pwesportsScriptPath = path.join(__dirname, '../modules/scripts/pwesports.js');

runTest('Pwesports http-request mock (/app/v1/splash): returns status 200, code 0, and non-null data object to prevent NSNull crash', () => {
    const res = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/app/v1/splash' }, undefined);
    assert(res && res.response, 'Expected response object for http-request');
    assert.strictEqual(res.response.status, 200);
    const body = JSON.parse(res.response.body);
    assert.strictEqual(body.code, 0);
    assert.strictEqual(body.status, 0);
    assert(body.data && typeof body.data === 'object', 'data must be a non-null object to prevent NSNull iOS crash');
    assert.strictEqual(body.data.splash, null, 'data.splash must be null');
    assert(Array.isArray(body.data.list) && body.data.list.length === 0);
});

runTest('Pwesports http-request mock (/api/launch): returns status 200 and code 0 with valid data object', () => {
    const res = executeScript(pwesportsScriptPath, { url: 'https://app.pwesports.cn/api/launch' }, undefined);
    assert(res && res.response);
    assert.strictEqual(res.response.status, 200);
    const body = JSON.parse(res.response.body);
    assert.strictEqual(body.code, 0);
    assert(body.data && typeof body.data === 'object');
});

runTest('Pwesports http-response filtering (feed, match, articles & banners): strips ads and commercial jump URLs', () => {
    const mockFeedPayload = {
        code: 0,
        data: {
            banners: [
                { id: 1, title: "IEM 赛事日程", jump_url: "pwesports://match/101" },
                { id: 2, title: "完美商城外设特惠", jump_url: "https://mall.wanmei.com/union?cps=123" },
                { id: 3, title: "商业推广赞助商", is_ad: true }
            ],
            list: [
                { id: 10, title: "CS2 职业战队最新战绩", type: "news" },
                { id: 11, title: "外星人电竞椅特惠直降", type: "banner_ad" },
                { id: 12, title: "Major 晋级名单出炉", tag: "赛事速报" },
                { id: 13, title: "某品牌键鼠评测体验", tag: "推广" },
                { id: 14, title: "赛事下注推荐", ad_type: "commercial" }
            ],
            articles: [
                { id: 20, title: "官方战报", is_ad: false },
                { id: 21, title: "联名外设首发优惠", advertisement: true }
            ],
            popup: { id: 99, img: "popup.png" },
            pop_window: { id: 100 },
            dialog: { id: 101 }
        }
    };

    const res = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/app/v1/match/list' }, { status: 200, body: JSON.stringify(mockFeedPayload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.banners.length, 1, 'Only genuine match banner should remain');
    assert.strictEqual(parsed.data.banners[0].id, 1);
    assert.strictEqual(parsed.data.list.length, 2, 'Only genuine news items should remain');
    assert.strictEqual(parsed.data.list[0].id, 10);
    assert.strictEqual(parsed.data.list[1].id, 12);
    assert.strictEqual(parsed.data.articles.length, 1, 'Only genuine article should remain');
    assert.strictEqual(parsed.data.articles[0].id, 20);
    assert.strictEqual(parsed.data.popup, undefined, 'popup must be removed');
    assert.strictEqual(parsed.data.pop_window, undefined, 'pop_window must be removed');
    assert.strictEqual(parsed.data.dialog, undefined, 'dialog must be removed');
});

runTest('Pwesports http-request mock (/app/v1/open_screen & /boot_ad): returns status 200, code 0, and non-null data object', () => {
    const res1 = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/app/v1/open_screen' }, undefined);
    assert(res1 && res1.response);
    const body1 = JSON.parse(res1.response.body);
    assert.strictEqual(body1.code, 0);
    assert.strictEqual(body1.data.splash, null);

    const res2 = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/app/v1/boot_ad' }, undefined);
    assert(res2 && res2.response);
    const body2 = JSON.parse(res2.response.body);
    assert.strictEqual(body2.code, 0);
    assert.strictEqual(body2.data.splash, null);

    const res3 = executeScript(pwesportsScriptPath, { url: 'https://advert.pwesports.cn/app/v1/advert' }, undefined);
    assert(res3 && res3.response);
    const body3 = JSON.parse(res3.response.body);
    assert.strictEqual(body3.code, 0);
    assert.strictEqual(body3.data.splash, null);
});

runTest('Pwesports http-response filtering (/splash): strips gromore and pangle configs', () => {
    const mockSplashPayload = {
        code: 0,
        data: {
            splash: { img: "ad.jpg" },
            gromore_config: { sdk: 1 },
            pangle_config: { pos: "splash" }
        },
        gromore_config: { enabled: true }
    };
    const res = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/app/v1/splash' }, { status: 200, body: JSON.stringify(mockSplashPayload) });
    assert(res && res.body);
    const parsed = JSON.parse(res.body);
    assert.strictEqual(parsed.data.splash, null);
    assert.strictEqual(parsed.data.gromore_config, undefined);
    assert.strictEqual(parsed.data.pangle_config, undefined);
    assert.strictEqual(parsed.gromore_config, undefined);
});

runTest('Pwesports edge case: handles unexpected/non-matching URL gracefully', () => {
    const res = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/other/data' }, undefined);
    assert(res && typeof res === 'object');
});

runTest('Pwesports edge case: handles malformed JSON response gracefully', () => {
    const res = executeScript(pwesportsScriptPath, { url: 'https://api.pwesports.cn/app/v1/feed' }, { status: 200, body: 'INVALID_JSON' });
    assert(res && typeof res === 'object');
});

console.log('\n================================================================');
console.log('2. DEEP VERIFICATION: Universal Syntax & Regex Check Across All Files');
console.log('================================================================\n');

const repoRoot = path.join(__dirname, '..');
const confFiles = fs.readdirSync(repoRoot).filter(f => f.endsWith('.conf'));
const moduleFiles = fs.readdirSync(path.join(repoRoot, 'modules')).filter(f => f.endsWith('.sgmodule')).map(f => path.join('modules', f));
const allTargetFiles = [...confFiles, ...moduleFiles];

for (const relPath of allTargetFiles) {
    const fullPath = path.join(repoRoot, relPath);
    runTest(`Syntax & Regex check for ${relPath}`, () => {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        
        let currentSection = '';
        let lineNo = 0;
        
        for (let rawLine of lines) {
            lineNo++;
            const line = rawLine.trim();
            if (!line || line.startsWith('#') || line.startsWith(';')) {
                continue;
            }
            if (line.startsWith('[') && line.endsWith(']')) {
                currentSection = line.slice(1, -1);
                continue;
            }

            if (currentSection === 'Rule') {
                const parts = line.split(',');
                const ruleType = parts[0].trim();
                const validTypes = ['DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'IP-CIDR', 'IP-CIDR6', 'IP-ASN', 'GEOIP', 'USER-AGENT', 'URL-REGEX', 'RULE-SET', 'FINAL', 'PROCESS-NAME'];
                assert(validTypes.includes(ruleType), `Line ${lineNo} in ${relPath}: Unknown Rule type "${ruleType}"`);
                assert(parts.length >= 2, `Line ${lineNo} in ${relPath}: Rule must have at least 2 comma-separated fields: "${line}"`);
                if (ruleType === 'URL-REGEX') {
                    // Test regex compilation
                    new RegExp(parts[1].trim());
                }
            } else if (currentSection === 'URL Rewrite') {
                const hasRejectOrRedirect = line.includes('reject') || line.includes('302') || line.includes('307') || line.includes('header');
                assert(hasRejectOrRedirect, `Line ${lineNo} in ${relPath}: Invalid URL Rewrite line: "${line}"`);
                const tokens = line.split(/\s+/);
                const pattern = tokens[0];
                // Verify regex pattern is valid
                try {
                    new RegExp(pattern);
                } catch (e) {
                    assert.fail(`Line ${lineNo} in ${relPath}: Invalid regex pattern "${pattern}": ${e.message}`);
                }
            } else if (currentSection === 'Script') {
                assert(line.includes('='), `Line ${lineNo} in ${relPath}: Script line missing '=': "${line}"`);
                assert(line.includes('type='), `Line ${lineNo} in ${relPath}: Script line missing 'type=': "${line}"`);
                assert(line.includes('script-path='), `Line ${lineNo} in ${relPath}: Script line missing 'script-path=': "${line}"`);
                // Extract pattern if present and test regex
                const match = line.match(/pattern=([^,]+)/);
                if (match) {
                    const pattern = match[1].trim();
                    try {
                        new RegExp(pattern);
                    } catch (e) {
                        assert.fail(`Line ${lineNo} in ${relPath}: Invalid Script pattern "${pattern}": ${e.message}`);
                    }
                }
            } else if (currentSection === 'MITM') {
                if (line.startsWith('hostname')) {
                    assert(line.includes('='), `Line ${lineNo} in ${relPath}: hostname missing '=': "${line}"`);
                }
            }
        }
    });
}

console.log('\n================================================================');
console.log('3. DEEP VERIFICATION: Architecture Hygiene, Rule Conflict & MITM Consistency');
console.log('================================================================\n');

runTest('Check that DOMAIN,issuecdn.baidupcs.com,REJECT does NOT exist to prevent image loader timeouts', () => {
    for (const relPath of allTargetFiles) {
        const fullPath = path.join(repoRoot, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert(!content.includes('DOMAIN,issuecdn.baidupcs.com,REJECT'), `Found forbidden DOMAIN,issuecdn.baidupcs.com,REJECT in ${relPath}`);
    }
});

runTest('Check that issuecdn.baidupcs.com is included in MITM hostnames for instant 1x1 reject-img', () => {
    const requiredFiles = [
        'modules/baidunetdisk.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of requiredFiles) {
        const fullPath = path.join(repoRoot, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert(content.includes('issuecdn.baidupcs.com'), `Missing issuecdn.baidupcs.com in MITM hostname in ${relPath}`);
    }
});

runTest('Check that getsyscfg/getconfig are NOT rejected with reject-dict in LazyGroup config', () => {
    const lazyConf = fs.readFileSync(path.join(repoRoot, 'Shadowrocket_LazyGroup_Merged.conf'), 'utf8');
    assert(!lazyConf.includes('/api/getsyscfg - reject-dict'), 'Found /api/getsyscfg reject-dict in LazyGroup');
    assert(!lazyConf.includes('/api/getconfig - reject-dict'), 'Found /api/getconfig reject-dict in LazyGroup');
});

runTest('Check that pwesports_clean pattern includes all feed, match, article, and square endpoints across configs', () => {
    const targetConfigs = [
        'modules/pwesports.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('feed|news|community|home|banner|match|article|square|post|index'), `Pattern incomplete in ${relPath}`);
    }
});

runTest('Check that Pangle / CSJ domains are present across all modules and core configs', () => {
    const requiredFiles = [
        'modules/baidunetdisk.sgmodule',
        'modules/pwesports.sgmodule',
        'modules/adblock.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of requiredFiles) {
        const fullPath = path.join(repoRoot, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        assert(content.includes('pangolin-sdk-toutiao.com'), `Missing pangolin-sdk-toutiao.com in ${relPath}`);
        assert(content.includes('pangle-ads.com'), `Missing pangle-ads.com in ${relPath}`);
        assert(content.includes('pangle.io'), `Missing pangle.io in ${relPath}`);
        assert(content.includes('csjplatform.com'), `Missing csjplatform.com in ${relPath}`);
        assert(content.includes('pangolin.snssdk.com'), `Missing pangolin.snssdk.com in ${relPath}`);
        assert(content.includes('csjbi.com'), `Missing csjbi.com in ${relPath}`);
        assert(content.includes('isplusurl.com'), `Missing isplusurl.com in ${relPath}`);
        assert(content.includes('bytead.net'), `Missing bytead.net in ${relPath}`);
    }
});

runTest('Check that pwesports_splash pattern covers open_screen and boot_ad across configs', () => {
    const targetConfigs = [
        'modules/pwesports.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('splash|startup|launch|advert|open_screen|boot_ad'), `pwesports_splash pattern incomplete in ${relPath}`);
    }
});

runTest('Check that baidunetdisk_splash pattern accurately matches all real splash URLs across configs', () => {
    const targetConfigs = [
        'modules/baidunetdisk.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        const match = content.match(/baidunetdisk_splash\s*=\s*type=http-request[^,\n]*,.*pattern=([^,\n]+)/);
        assert(match, `Could not find baidunetdisk_splash pattern in ${relPath}`);
        const regexStr = match[1];
        const regex = new RegExp(regexStr.replace(/\\\\/g, '\\'));

        assert(regex.test('https://pan.baidu.com/splash/load'), `Must match pan.baidu.com/splash/load in ${relPath}`);
        assert(regex.test('https://pan.baidu.com/splash/list'), `Must match pan.baidu.com/splash/list in ${relPath}`);
        assert(regex.test('https://pan.baidu.com/api/splash'), `Must match pan.baidu.com/api/splash in ${relPath}`);
        assert(regex.test('https://pan.baidu.com/rest/2.0/splash'), `Must match pan.baidu.com/rest/2.0/splash in ${relPath}`);
        assert(regex.test('https://pan.baidu.com/rest/2.0/pcs/adx'), `Must match pan.baidu.com/rest/2.0/pcs/adx in ${relPath}`);
        assert(regex.test('https://pan.baidu.com/act/api/activityentry'), `Must match pan.baidu.com/act/api/activityentry in ${relPath}`);
    }
});

runTest('Check that baidunetdisk_clean response script exists across configs', () => {
    const targetConfigs = [
        'modules/baidunetdisk.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('baidunetdisk_clean = type=http-response'), `Missing baidunetdisk_clean in ${relPath}`);
    }
});

runTest('Check that advert is NOT rejected with reject-dict for pwesports across configs to prevent offline splash cache fallback', () => {
    const targetConfigs = [
        'modules/pwesports.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(!content.includes('(advert|feed/ad') && !content.includes('(advert|feed\\/ad'), `advert must not be in reject-dict in ${relPath}`);
    }
});

runTest('Check that ad.pwesports.cn and advert.pwesports.cn are NOT in [Rule] with REJECT across configs', () => {
    const targetConfigs = [
        'modules/pwesports.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(!content.includes('DOMAIN,ad.pwesports.cn,REJECT'), `ad.pwesports.cn must not be socket-rejected in ${relPath}`);
        assert(!content.includes('DOMAIN,advert.pwesports.cn,REJECT'), `advert.pwesports.cn must not be socket-rejected in ${relPath}`);
    }
});

runTest('Check that client.pwesports.cn, ad.pwesports.cn, advert.pwesports.cn and *.wanmei.com are in MITM hostnames across configs', () => {
    const targetConfigs = [
        'modules/pwesports.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('client.pwesports.cn'), `Missing client.pwesports.cn in MITM hostname in ${relPath}`);
        assert(content.includes('ad.pwesports.cn'), `Missing ad.pwesports.cn in MITM hostname in ${relPath}`);
        assert(content.includes('advert.pwesports.cn'), `Missing advert.pwesports.cn in MITM hostname in ${relPath}`);
        assert(content.includes('*.wanmei.com'), `Missing *.wanmei.com in MITM hostname in ${relPath}`);
    }
});

runTest('Check that Claude and Gemini policy groups in LazyGroup are locked to Singapore node', () => {
    const lazyConf = fs.readFileSync(path.join(repoRoot, 'Shadowrocket_LazyGroup_Merged.conf'), 'utf8');
    assert(lazyConf.includes('Claude = select,新加坡节点') && lazyConf.includes('policy-select-name=新加坡节点'), 'Claude policy group must be locked to 新加坡节点');
    assert(lazyConf.includes('Gemini = select,新加坡节点') && lazyConf.includes('policy-select-name=新加坡节点'), 'Gemini policy group must be locked to 新加坡节点');
});

runTest('Check that Apple authentication and CDN domains have always-real-ip and system DNS host mapping across confs', () => {
    const targetConfigs = ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf'];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('always-real-ip =') && content.includes('*.apple.com') && content.includes('*.mzstatic.com'), `Missing always-real-ip Apple domains in ${relPath}`);
        assert(content.includes('*.apple.com = server:system') && content.includes('*.itunes.com = server:system'), `Missing Apple server:system Host mappings in ${relPath}`);
        assert(content.includes('*.mzstatic.com') && content.includes('*.itunes.com') && content.includes('skip-proxy ='), `Missing App Store auth domains in skip-proxy in ${relPath}`);
    }
});

runTest('Check that global and domestic top ad networks (AdMob, AppLovin, Unity Ads, IronSource, Vungle, InMobi, ByteGoofy, Xiaomi/Huawei OEM) are present across core configs', () => {
    const targetConfigs = [
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    const requiredAdDomains = [
        'DOMAIN-SUFFIX,bytegoofy.com,REJECT',
        'DOMAIN-SUFFIX,ad.xiaomi.com,REJECT',
        'DOMAIN-SUFFIX,ad.huawei.com,REJECT',
        'DOMAIN-SUFFIX,admob.com,REJECT',
        'DOMAIN-SUFFIX,applovin.com,REJECT',
        'DOMAIN-SUFFIX,unityads.unity3d.com,REJECT',
        'DOMAIN-SUFFIX,ironsrc.com,REJECT',
        'DOMAIN-SUFFIX,vungle.com,REJECT',
        'DOMAIN-SUFFIX,inmobi.com,REJECT',
        'DOMAIN-SUFFIX,chartboost.com,REJECT',
        'DOMAIN-SUFFIX,fyber.com,REJECT',
        'DOMAIN-SUFFIX,an.facebook.com,REJECT',
        'DOMAIN-SUFFIX,amazon-adsystem.com,REJECT',
        'DOMAIN-SUFFIX,smaato.net,REJECT'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        for (const adRule of requiredAdDomains) {
            assert(content.includes(adRule), `Missing required global ad network rule ${adRule} in ${relPath}`);
        }
    }
});

console.log(`\n================================================================`);
console.log(`FINAL RESULTS: ${passedTests} / ${totalTests} tests passed.`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
