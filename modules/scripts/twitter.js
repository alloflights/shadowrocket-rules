/**
 * X (Twitter) & 海外流媒体信息流深度无感净化脚本 (GraphQL & REST v2 全量对齐版)
 *
 * 核心能力：
 * 1. 全面拦截 X (Twitter) iOS 客户端 GraphQL (HomeTimeline, HomeLatestTimeline, Following, ForYou,
 *    TweetDetail, ThreadedConversationWithInjectionsV2, SearchTimeline, UserTweets, ExplorePage 等)
 *    及 REST v1.1/v2 (/2/timeline/*, /2/guide.json, /2/search/adaptive.json) 中的推广内容；
 * 2. 多维识别：同时覆盖 entryId (promoted-tweet / promoted-trend / promoted-user / who-to-follow)、
 *    itemContent.promotedMetadata / tweetPromotedMetadata / adMetadataContainer、
 *    itemType === "TimelinePromotedTweet"、以及 clientEventInfo (urt_promoted / promoted_tweet)；
 * 3. 对话串（评论区）插播广告剥离：当 TweetDetail 的 conversationthread 模块内含推广回复时精准剔除，
 *    若整个 conversationthread 均为广告则整块移除，杜绝空白占位框，并严格保留 cursor-* 分页游标；
 * 4. 兼容 YouTube / Spotify JSON 播放配置与广告槽位剥离（playerAds / adPlacements / adSlots）。
 *
 * 兼容 Shadowrocket / Surge / Loon / Quantumult X：纯 ES5/ES2015 语法，零外部依赖，零弹窗打扰。
 */

(function overseasStreamPurify() {
    var request = (typeof $request !== "undefined" && $request) ? $request : null;
    var url = (request && request.url) ? String(request.url) : "";
    var hasResponse = typeof $response !== "undefined" && $response;

    if (!hasResponse) {
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
            "adBreakHeartbeatParams", "adSafetyReason", "MastheadAd", "masthead", "paidContentOverlay"
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

        // REST v2 globalObjects.tweets 过滤
        if (node.globalObjects && typeof node.globalObjects === "object") {
            if (node.globalObjects.tweets && typeof node.globalObjects.tweets === "object") {
                var tweetIds = Object.keys(node.globalObjects.tweets);
                for (var t = 0; t < tweetIds.length; t++) {
                    var tid = tweetIds[t];
                    var tw = node.globalObjects.tweets[tid];
                    if (tw && (tw.promotedMetadata || tw.promoted_content)) {
                        delete node.globalObjects.tweets[tid];
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

        // GraphQL & REST URT instructions 数组中的 entries / moduleItems 过滤
        if (Array.isArray(node.entries)) {
            node.entries = filterTwitterEntries(node.entries);
        }
        if (Array.isArray(node.moduleItems)) {
            node.moduleItems = filterTwitterModuleItems(node.moduleItems);
        }
        if (Array.isArray(node.items)) {
            node.items = filterTwitterModuleItems(node.items);
        }
        if (node.addEntries && Array.isArray(node.addEntries.entries)) {
            node.addEntries.entries = filterTwitterEntries(node.addEntries.entries);
        }
        if (node.entry && isTwitterAdEntry(node.entry)) {
            delete node.entry;
        }

        var keys = Object.keys(node);
        for (var k = 0; k < keys.length; k++) {
            var key = keys[k];
            if (key === "promotedMetadata" || key === "tweetPromotedMetadata" ||
                key === "promoted_content" || key === "adMetadataContainer") {
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

            // 若是 TimelineTimelineModule（如评论区 conversationthread 或推荐模块），过滤内部 items
            if (entry.content && Array.isArray(entry.content.items)) {
                var hadItems = entry.content.items.length > 0;
                entry.content.items = filterTwitterModuleItems(entry.content.items);
                if (hadItems && entry.content.items.length === 0) {
                    continue;
                }
            }
            if (entry.content && entry.content.timelineModule && Array.isArray(entry.content.timelineModule.items)) {
                var hadModItems = entry.content.timelineModule.items.length > 0;
                entry.content.timelineModule.items = filterTwitterModuleItems(entry.content.timelineModule.items);
                if (hadModItems && entry.content.timelineModule.items.length === 0) {
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

    function isPromotedClientEvent(ce) {
        if (!ce || typeof ce !== "object") return false;
        var comp = String(ce.component || "").toLowerCase();
        var elem = String(ce.element || "").toLowerCase();
        var action = String(ce.action || "").toLowerCase();
        if (comp.indexOf("promoted") !== -1 || elem.indexOf("promoted") !== -1 || action.indexOf("promoted") !== -1) {
            return true;
        }
        if (ce.details && ce.details.timelinesDetails && ce.details.timelinesDetails.injectionType &&
            /promoted|ad/i.test(String(ce.details.timelinesDetails.injectionType))) {
            return true;
        }
        return false;
    }

    function isTwitterAdEntry(entry) {
        if (!entry || typeof entry !== "object") return false;

        var entryId = String(entry.entryId || "");
        // 严格保护分页游标 cursor-top / cursor-bottom
        if (/^cursor-(?:top|bottom)/i.test(entryId)) return false;

        if (/^(?:promoted-tweet|promotedTweet|promoted-trend|promotedTrend|promoted-user|SRP-promoted|who-to-follow|who-to-subscribe|premium-upsell|superfollow|messageprompt|RelevancePrompt)/i.test(entryId) ||
            /(?:^|[-_])promoted(?:[-_]|$)/i.test(entryId)) {
            return true;
        }

        if (entry.promotedMetadata || entry.tweetPromotedMetadata || entry.promoted_content || entry.adMetadataContainer) {
            return true;
        }
        if (isPromotedClientEvent(entry.clientEventInfo)) return true;

        var content = entry.content || entry.item;
        if (content && typeof content === "object") {
            if (content.promotedMetadata || content.tweetPromotedMetadata || content.promoted_content || content.adMetadataContainer) {
                return true;
            }
            if (isPromotedClientEvent(content.clientEventInfo)) return true;

            // REST v2 URT 格式: content.item.content.tweet.promotedMetadata
            if (content.item && typeof content.item === "object") {
                if (isPromotedClientEvent(content.item.clientEventInfo)) return true;
                if (content.item.content && typeof content.item.content === "object") {
                    var rc = content.item.content;
                    if (rc.promotedMetadata || rc.tweetPromotedMetadata ||
                        (rc.tweet && (rc.tweet.promotedMetadata || rc.tweet.promoted_content)) ||
                        (rc.user && rc.user.promotedMetadata) ||
                        (rc.trend && rc.trend.promotedMetadata)) {
                        return true;
                    }
                }
            }

            var itemContent = content.itemContent || (content.item && content.item.itemContent);
            if (itemContent && typeof itemContent === "object") {
                if (itemContent.promotedMetadata || itemContent.tweetPromotedMetadata ||
                    itemContent.promoted_content || itemContent.adMetadataContainer ||
                    itemContent.itemType === "TimelinePromotedTweet") {
                    return true;
                }
                if (itemContent.tweet_results && itemContent.tweet_results.result) {
                    var res = itemContent.tweet_results.result;
                    if (res.promotedMetadata || res.tweetPromotedMetadata ||
                        (res.tweet && (res.tweet.promotedMetadata || res.tweet.tweetPromotedMetadata)) ||
                        (res.legacy && res.legacy.promotedMetadata)) {
                        return true;
                    }
                }
                if (itemContent.user_results && itemContent.user_results.result &&
                    itemContent.user_results.result.promotedMetadata) {
                    return true;
                }
            }

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
