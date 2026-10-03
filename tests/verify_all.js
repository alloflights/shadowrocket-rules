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
        RegExp: RegExp
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

runTest('Check that baidunetdisk_splash pattern covers splash subpath across configs', () => {
    const targetConfigs = [
        'modules/baidunetdisk.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('pcs/adx?|membership/advertise|splash') || content.includes('pcs\\/adx?|membership\\/advertise|splash'), `baidunetdisk_splash pattern incomplete in ${relPath}`);
    }
});

runTest('Check that client.pwesports.cn and *.wanmei.com are in MITM hostnames across configs', () => {
    const targetConfigs = [
        'modules/pwesports.sgmodule',
        'modules/adblock-ultimate.sgmodule',
        'Shadowrocket_LazyGroup_Merged.conf',
        'Shadowrocket_AllInOne_Ultimate.conf'
    ];
    for (const relPath of targetConfigs) {
        const content = fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
        assert(content.includes('client.pwesports.cn'), `Missing client.pwesports.cn in MITM hostname in ${relPath}`);
        assert(content.includes('*.wanmei.com'), `Missing *.wanmei.com in MITM hostname in ${relPath}`);
    }
});

console.log(`\n================================================================`);
console.log(`FINAL RESULTS: ${passedTests} / ${totalTests} tests passed.`);
console.log('================================================================\n');

if (passedTests !== totalTests) {
    process.exit(1);
}
