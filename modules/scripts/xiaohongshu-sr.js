// 异常响应原样放行；每次请求只完成一次。
(function safeResponse() {
try {
// 小火箭专用：评论图片保存标记兼容；未知结构原样保留。
// 维护: allofights
const url = $request.url;
const isQuanX = typeof $task !== "undefined";
if (typeof $response === 'undefined' || !$response || !$response.body) return $done({});

let obj;
try {
  obj = JSON.parse($response.body);
} catch (e) {
  return $done({});
}

if (!obj || typeof obj !== "object") return $done({});

// Cache only URLs already returned in the same media's feed/comment response.
// Match by note/video ID, retain signed URLs intact, and expire bounded entries.
const streamKey = "xhs_sr_media_streams_v1";
const streamTTL = 30 * 60 * 1000;
function loadStreams() {
  try {
    const raw = isQuanX ? $prefs.valueForKey(streamKey) : $persistentStore.read(streamKey);
    const saved = JSON.parse(raw || "[]");
    const now = Date.now();
    return Array.isArray(saved) ? saved.filter(x => x && (x.kind === "note" || x.kind === "comment") && typeof x.id === "string" && x.id && typeof x.url === "string" && /^https?:\/\//i.test(x.url) && typeof x.time === "number" && x.time <= now && now - x.time < streamTTL).slice(-80) : [];
  } catch (e) { return []; }
}
function storeStreams(entries) {
  if (!entries.length) return;
  try {
    let cache = loadStreams();
    for (const entry of entries) {
      if (!entry || !entry.id || !entry.url) continue;
      cache = cache.filter(x => !(x.kind === entry.kind && x.id === entry.id));
      cache.push({ kind: entry.kind, id: entry.id, url: entry.url, time: Date.now() });
    }
    const value = JSON.stringify(cache.slice(-80));
    if (isQuanX) $prefs.setValueForKey(value, streamKey);
    else $persistentStore.write(value, streamKey);
  } catch (e) {}
}
function streamURL(media) {
  const streams = media && media.stream;
  if (!streams || typeof streams !== "object") return "";
  for (const codec of ["h265", "h264"]) {
    const list = streams[codec];
    if (!Array.isArray(list)) continue;
    let best = null;
    for (const item of list) {
      if (!item || typeof item.master_url !== "string" || !/^https?:\/\//i.test(item.master_url)) continue;
      const score = (Number(item.width) || 0) * (Number(item.height) || 0);
      const bestScore = best ? (Number(best.width) || 0) * (Number(best.height) || 0) : -1;
      if (!best || score > bestScore || (score === bestScore && (Number(item.avg_bitrate) || 0) > (Number(best.avg_bitrate) || 0))) best = item;
    }
    if (best) return best.master_url;
  }
  return "";
}
function cachedStream(kind, id) {
  if (id === undefined || id === null || String(id) === "") return "";
  const found = loadStreams().find(x => x.kind === kind && x.id === String(id));
  return found ? found.url : "";
}

// 媒体保存标记；不修改图片像素，也不能修复已烘焙水印。
function patchMedia(item) {
  if (!item || typeof item !== "object") return;
  if (item.media_save_config) {
    item.media_save_config.disable_save = false;
    item.media_save_config.disable_watermark = true;
    item.media_save_config.disable_weibo_cover = true;
  }
  // Newer clients expose download permission in explicit function switches.
  if (Array.isArray(item.function_switch)) {
    item.function_switch.forEach(entry => {
      if (entry && (entry.type === "image_download" || entry.type === "video_download")) {
        entry.enable = true;
        if (entry.reason) delete entry.reason;
      }
    });
  }
  if (item.share_info?.function_entries?.length > 0) {
    let entries = item.share_info.function_entries;
    if (entries[0]?.type !== "video_download") {
      entries.unshift({ type: "video_download" });
    }
  }
}

// 限制递归深度与节点数量；超限时整份响应不改写。
let visited = 0;
function traverse(node, depth = 0) {
  if (!node || typeof node !== "object") return;
  if (++visited > 12000 || depth > 40) throw new Error("media budget");
  patchMedia(node);
  if (Array.isArray(node)) {
    for (let child of node) traverse(child, depth + 1);
  } else {
    for (let key of Object.keys(node)) {
      if (typeof node[key] === "object") traverse(node[key], depth + 1);
    }
  }
}

// 1. 笔记媒体保存兼容；未知接口结构需要继续跟踪。
if (/\/note\/(imagefeed|feed|videofeed|detail)/.test(url) || url.includes("/note/")) {
  traverse(obj);

  // Live Photo 实况照片元数据持久化
  try {
    let imagesList = null;
    if (obj?.data?.[0]?.note_list?.[0]?.images_list) {
      imagesList = obj.data[0].note_list[0].images_list;
    } else if (obj?.data?.note_list?.[0]?.images_list) {
      imagesList = obj.data.note_list[0].images_list;
    } else if (obj?.data?.[0]?.images_list) {
      imagesList = obj.data[0].images_list;
    }
    if (imagesList) {
      if (isQuanX) {
        $prefs.setValueForKey(JSON.stringify(imagesList), "redBookLivePhoto");
      } else {
        $persistentStore.write(JSON.stringify(imagesList), "redBookLivePhoto");
      }
    }
  } catch (e) {}
}

// Feed supplies a playback stream; only reuse it for a matching note_id.
if (/\/note\/videofeed(?:[?#]|$)/.test(url) && Array.isArray(obj.data)) {
  const streams = [];
  obj.data.forEach(item => {
    if (!item || typeof item !== "object") return;
    const id = item.id || item.note_id;
    const master = streamURL(item.video_info_v2?.media);
    if (id && master) streams.push({ kind: "note", id: String(id), url: master });
  });
  storeStreams(streams);
}
if (/\/note\/video\/save(?:[?#]|$)/.test(url) && obj.data && typeof obj.data === "object") {
  const master = cachedStream("note", obj.data.note_id);
  if (master && typeof obj.data.download_url === "string") obj.data.download_url = master;
}

// Comment endpoints verified against fmz200/wool_scripts at
// 5d5f63fcf98bc69d5f8f1b1bae6f86a01ee4bb97 (own implementation).
// No red-id replacement, logging, external requests or cross-media URL substitution.
if (/\/note\/comment\/(?:list|sub_comments)(?:[?]|$)/.test(url)) {
  let count = 0;
  const commentStreams = [];
  function comments(node, depth = 0, media = false) {
    if (!node || typeof node !== "object") return;
    if (++count > 12000 || depth > 40) throw new Error("comment budget");
    if (Array.isArray(node)) { node.forEach(n => comments(n, depth + 1, media)); return; }
    // Reuse only an explicitly identified comment video/live stream.
    for (const group of [node.pictures, node.videos]) {
      if (!Array.isArray(group)) continue;
      group.forEach(video => {
        if (!video || !video.video_id || !video.video_info) return;
        try {
          const info = typeof video.video_info === "string" ? JSON.parse(video.video_info) : video.video_info;
          const master = streamURL(info);
          if (master) commentStreams.push({ kind: "comment", id: String(video.video_id), url: master });
        } catch (e) {}
      });
    }
    if (Array.isArray(node.pictures)) {
      // These types control native vs. decorated/exported comment media.
      if (node.comment_type === 3) node.comment_type = 2;
      if (node.media_source_type === 1) node.media_source_type = 0;
    }
    if (media || Array.isArray(node.pictures)) {
      if (!node.media_save_config || typeof node.media_save_config !== "object" || Array.isArray(node.media_save_config)) node.media_save_config = {};
      patchMedia(node);
    }
    Object.keys(node).forEach(k => {
      // Do not invent an original URL or strip signed query parameters.
      // Existing CDN rendition/signature strings are left byte-for-byte intact.
      if (k !== "media_save_config") comments(node[k], depth + 1, /^(?:pictures|image_list|images_list)$/.test(k));
    });
  }
  comments(obj);
  storeStreams(commentStreams);
}
if (/\/interaction\/comment\/video\/download(?:[?#]|$)/.test(url) && obj.data?.video) {
  const video = obj.data.video;
  const master = cachedStream("comment", video.video_id);
  if (master && typeof video.video_url === "string") video.video_url = master;
}

// 2. 实况照片原视频保存请求
if (url.includes("/live_photo/save")) {
  let livePhoto;
  let newDatas = [];
  try {
    if (isQuanX) {
      livePhoto = JSON.parse($prefs.valueForKey("redBookLivePhoto"));
    } else {
      livePhoto = JSON.parse($persistentStore.read("redBookLivePhoto"));
    }
  } catch (e) {}

  if (livePhoto?.length > 0) {
    for (let item of livePhoto) {
      if (item.live_photo_file_id && item.live_photo?.media?.stream?.h265?.[0]?.master_url) {
        newDatas.push({
          file_id: item.live_photo_file_id,
          video_id: item.live_photo.media.video_id,
          url: item.live_photo.media.stream.h265[0].master_url
        });
      }
    }
  }
  if (obj?.data?.datas?.length > 0) {
    obj.data.datas.forEach((itemA) => {
      newDatas.forEach((itemB) => {
        if (itemB.file_id === itemA.file_id && itemA.url?.includes(".mp4")) {
          itemA.url = itemB.url;
        }
      });
    });
  } else if (newDatas.length > 0) {
    obj = { code: 0, success: true, msg: "成功", data: { datas: newDatas } };
  }
}

// 3. 搜索栏热搜、热榜与填充词净化
if (url.includes("/search/banner_list") && obj?.data) obj.data = {};
if (url.includes("/search/hot_list") && obj?.data?.items) obj.data.items = [];
if (url.includes("/search/hint") && obj?.data?.hint_words) obj.data.hint_words = [];
if (url.includes("/search/trending")) {
  if (obj?.data?.queries) obj.data.queries = [];
  if (obj?.data?.hint_word) obj.data.hint_word = {};
}

// 4. 全局系统配置与开屏广告阻断
if (url.includes("/system_service/config") && obj?.data) {
  const delKeys = ["app_theme", "loading_img", "splash", "store"];
  delKeys.forEach(k => delete obj.data[k]);
}
if (url.includes("/system_service/splash_config") && obj?.data?.ads_groups) {
  for (let group of obj.data.ads_groups) {
    group.start_time = 3818332800; // 2090年失效
    group.end_time = 3818419199;
    if (group?.ads) {
      for (let ad of group.ads) {
        ad.start_time = 3818332800;
        ad.end_time = 3818419199;
      }
    }
  }
}

// 5. 详情页商业推广小部件
if (url.includes("/note/widgets") && obj?.data) {
  ["cooperate_binds", "generic", "note_next_step"].forEach(k => delete obj.data[k]);
}

// 6. 首页信息流去广告 (赞助卡片/带货商品/直播推荐)
// 只认明确广告标记：ads_info 只要存在且非 null（对象、字符串均算），或 is_ads/is_ad 为真、
// model_type 为广告类型，或笔记卡片内嵌 ads_info；普通 card_icon 不作为判断依据。
function hasAdsField(o) {
  if (!o || typeof o !== "object" || !Object.prototype.hasOwnProperty.call(o, "ads_info")) return false;
  const v = o.ads_info;
  return v !== null && v !== undefined && v !== false && v !== "";
}
function isFeedAd(item) {
  if (!item || typeof item !== "object") return true;
  if (item.model_type === "live_v2" || item.model_type === "ads" || item.model_type === "ad") return true;
  if (item.is_ads === true || item.is_ad === true) return true;
  if (hasAdsField(item) || hasAdsField(item.note_card) || hasAdsField(item.note) || hasAdsField(item.data)) return true;
  if (Array.isArray(item.note_attributes) && item.note_attributes.includes("goods")) return true;
  return false;
}
function cleanFeed(list) {
  return list.filter(item => {
    if (isFeedAd(item)) return false;
    if (item.related_ques) delete item.related_ques;
    return true;
  });
}
if (url.includes("/homefeed") && obj) {
  if (Array.isArray(obj.data)) obj.data = cleanFeed(obj.data);
  else if (obj.data && typeof obj.data === "object") {
    for (const k of ["items", "notes", "list"]) if (Array.isArray(obj.data[k])) obj.data[k] = cleanFeed(obj.data[k]);
  }
}

// 7. 搜索结果去广告
if (url.includes("/search/notes") && Array.isArray(obj?.data?.items)) {
  obj.data.items = obj.data.items.filter(i => i.model_type === "note");
}

$done({ body: JSON.stringify(obj) });

} catch (error) { $done({}); }
})();
