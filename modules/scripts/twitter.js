/**
 * X (Twitter) & 海外流媒体信息流深度无感净化脚本 (GraphQL & REST v2)
 *
 * 核心能力：
 * 1. 递归剥离 HomeTimeline / HomeLatestTimeline / TweetDetail / SearchTimeline / UserTweets / ListLatestTweetsTimeline
 *    中的 Promoted Tweets（推广推文）、商业视频广告、评论区插播广告与带货卡片；
 * 2. 精准识别 entryId (promoted-tweet / promoted-trend / promoted-user / who-to-follow 商业推荐) 与
 *    itemContent.promotedMetadata / adMetadataContainer，完整保留 cursor 分页游标，绝不造成时间线断流；
 * 3. 过滤 Explore / Trends 热搜榜中的 Promoted 商业买量词条；
 * 4. 兼容 YouTube / Spotify / Twitch JSON 播放配置与广告槽位剥离（playerAds / adPlacements / adSlots）。
 *
 * 兼容 Shadowrocket / Surge / Loon / Quantumult X：纯 ES5/ES2015 语法，零外部依赖，零弹窗打扰。
 */

(function overseasStreamPurify() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse) {
        // 请求阶段：针对明确的海外流媒体广告请求返回 200 空结构
        if (/(?:ads-api\.twitter\.com|ads-api\.x\.com|spclient\.wg\.spotify\.com\/(?:ads|ad-logic)\/|youtubei\/v1\/ad_break)/i.test(url)) {
            $done({
                response: {
                    status: 200,
                    headers: { "Content-Type": "application/json; charset=utf-8" },
                    body: "{}"
                }
            });
            return;
        }
        $done({});
        return;
    }

    if (!$response.body || typeof $response.body !== "string") {
        $done({});
        return;
    }

    try {
        var obj = JSON.parse($response.body);
        var lowerUrl = url.toLowerCase();

        // 1. YouTube JSON 接口净化 (player / next / browse / search / reel)
        if (lowerUrl.indexOf("youtube") !== -1 || lowerUrl.indexOf("googlevideo") !== -1) {
            sanitizeYouTubeJson(obj);
            $done({ body: JSON.stringify(obj) });
            return;
        }

        // 2. X (Twitter) GraphQL & REST API 净化
        sanitizeTwitterPayload(obj);
        $done({ body: JSON.stringify(obj) });
    } catch (e) {
        $done({});
    }

    function sanitizeYouTubeJson(root) {
        if (!root || typeof root !== "object") return;
        var ytAdKeys = [
            "adPlacements", "playerAds", "adSlots", "adBreakParams",
            "adBreakHeartbeatParams", "adSafetyReason", "MastheadAd", "masthead"
        ];
        for (var i = 0; i < ytAdKeys.length; i++) {
            delete root[ytAdKeys[i]];
        }
        if (root.playerResponse && typeof root.playerResponse === "object") {
            for (var j = 0; j < ytAdKeys.length; j++) {
                delete root.playerResponse[ytAdKeys[j]];
            }
        }
        scrubYouTubeNode(root);
    }

    function scrubYouTubeNode(node) {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
            var kept = [];
            for (var i = 0; i < node.length; i++) {
                var item = node[i];
                if (isYouTubeJsonAdItem(item)) continue;
                scrubYouTubeNode(item);
                kept.push(item);
            }
            node.length = 0;
            for (var j = 0; j < kept.length; j++) node.push(kept[j]);
            return;
        }
        var keys = Object.keys(node);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (key === "adPlacements" || key === "playerAds" || key === "adSlots" ||
                key === "adSlotRenderer" || key === "promotedSparklesWebRenderer" ||
                key === "searchPyvRenderer" || key === "bannerPromoRenderer" ||
                key === "statementBannerRenderer" || key === "inFeedAdLayoutRenderer") {
                delete node[key];
                continue;
            }
            if (node[key] && typeof node[key] === "object") {
                scrubYouTubeNode(node[key]);
            }
        }
    }

    function isYouTubeJsonAdItem(item) {
        if (!item || typeof item !== "object") return false;
        return !!(
            item.adSlotRenderer ||
            item.promotedSparklesWebRenderer ||
            item.promotedSparklesTextSearchRenderer ||
            item.searchPyvRenderer ||
            item.inFeedAdLayoutRenderer ||
            item.adPlacementRenderer ||
            item.playerBytesAdLayoutRenderer ||
            (item.richItemRenderer && item.richItemRenderer.content && (
                item.richItemRenderer.content.adSlotRenderer ||
                item.richItemRenderer.content.inFeedAdLayoutRenderer ||
                item.richItemRenderer.content.promotedSparklesWebRenderer
            ))
        );
    }

    function sanitizeTwitterPayload(node) {
        if (!node || typeof node !== "object") return;

        // 处理 REST v2 globalObjects.tweets / timeline.instructions
        if (node.globalObjects && typeof node.globalObjects === "object") {
            if (node.globalObjects.tweets && typeof node.globalObjects.tweets === "object") {
                var tweetIds = Object.keys(node.globalObjects.tweets);
                for (var t = 0; t < tweetIds.length; t++) {
                    var tid = tweetIds[t];
                    var tw = node.globalObjects.tweets[tid];
                    if (tw && (tw.promotedMetadata || tw.Supplemental_language || tw.card && tw.card.name && /promo|ad/i.test(tw.card.name))) {
                        if (tw.promotedMetadata) delete node.globalObjects.tweets[tid];
                    }
                }
            }
        }

        walkTwitterTree(node);
    }

    function walkTwitterTree(node) {
        if (!node || typeof node !== "object") return;

        if (Array.isArray(node)) {
            for (var i = 0; i < node.length; i++) {
                walkTwitterTree(node[i]);
            }
            return;
        }

        // GraphQL instructions 数组中的 entries / moduleItems 过滤
        if (Array.isArray(node.entries)) {
            node.entries = filterTwitterEntries(node.entries);
        }
        if (Array.isArray(node.moduleItems)) {
            node.moduleItems = filterTwitterModuleItems(node.moduleItems);
        }
        if (Array.isArray(node.items)) {
            node.items = filterTwitterModuleItems(node.items);
        }
        if (node.entry && isTwitterAdEntry(node.entry)) {
            delete node.entry;
        }

        var keys = Object.keys(node);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (key === "promotedMetadata" || key === "promoted_content" || key === "adMetadataContainer") {
                delete node[key];
                continue;
            }
            var val = node[key];
            if (val && typeof val === "object") {
                walkTwitterTree(val);
            }
        }
    }

    function filterTwitterEntries(entries) {
        var result = [];
        for (var i = 0; i < entries.length; i++) {
            var entry = entries[i];
            if (!entry || typeof entry !== "object") continue;
            if (isTwitterAdEntry(entry)) continue;

            // 若是 TimelineTimelineModule（如评论区对话串或推荐模块），过滤内部 items
            if (entry.content && Array.isArray(entry.content.items)) {
                var hadItems = entry.content.items.length > 0;
                entry.content.items = filterTwitterModuleItems(entry.content.items);
                if (hadItems && entry.content.items.length === 0) {
                    continue;
                }
            }
            walkTwitterTree(entry);
            result.push(entry);
        }
        return result;
    }

    function filterTwitterModuleItems(items) {
        var kept = [];
        for (var i = 0; i < items.length; i++) {
            var el = items[i];
            if (!el || typeof el !== "object") continue;
            if (isTwitterAdEntry(el)) continue;
            kept.push(el);
        }
        return kept;
    }

    function isTwitterAdEntry(entry) {
        if (!entry || typeof entry !== "object") return false;

        var entryId = String(entry.entryId || "");
        // 严格保护分页游标 cursor-top / cursor-bottom
        if (/^cursor-/i.test(entryId)) return false;

        if (/^(?:promoted-tweet|promotedTweet|promoted-trend|promotedTrend|promoted-user|SRP-promoted|who-to-follow| RelevancePrompt)/i.test(entryId) ||
            /(?:^|[-_])promoted(?:[-_]|$)/i.test(entryId)) {
            return true;
        }

        // 检查直接挂载的 promotedMetadata
        if (entry.promotedMetadata || entry.promoted_content) return true;

        var content = entry.content || entry.item;
        if (content && typeof content === "object") {
            if (content.promotedMetadata || content.promoted_content) return true;

            var itemContent = content.itemContent || (content.item && content.item.itemContent);
            if (itemContent && typeof itemContent === "object") {
                if (itemContent.promotedMetadata || itemContent.promoted_content) return true;
                if (itemContent.tweet_results && itemContent.tweet_results.result) {
                    var res = itemContent.tweet_results.result;
                    if (res.promotedMetadata || (res.tweet && res.tweet.promotedMetadata) ||
                        (res.legacy && res.legacy.promotedMetadata)) {
                        return true;
                    }
                }
                if (itemContent.user_results && itemContent.user_results.result &&
                    itemContent.user_results.result.promotedMetadata) {
                    return true;
                }
            }

            // 检查 Trend 趋势词条中的推广标记
            if (content.trendMetadata && content.trendMetadata.metaDescription &&
                /Promoted|推广|プロモーション|프로모션/i.test(String(content.trendMetadata.metaDescription))) {
                return true;
            }
            if (itemContent && itemContent.trendMetadata && itemContent.trendMetadata.metaDescription &&
                /Promoted|推广|プロモーション|프로모션/i.test(String(itemContent.trendMetadata.metaDescription))) {
                return true;
            }
        }

        return false;
    }
})();
