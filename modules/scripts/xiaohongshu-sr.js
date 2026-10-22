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

// 媒体保存标记；不修改图片像素，也不能修复已烘焙水印。
function patchMedia(item) {
  if (!item || typeof item !== "object") return;
  if (item.media_save_config) {
    item.media_save_config.disable_save = false;
    item.media_save_config.disable_watermark = true;
    item.media_save_config.disable_weibo_cover = true;
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

// Comment endpoints verified against fmz200/wool_scripts at
// 5d5f63fcf98bc69d5f8f1b1bae6f86a01ee4bb97 (own implementation).
// No red-id replacement, logging, external requests or cross-note media cache.
if (/\/note\/comment\/(?:list|sub_comments)(?:[?]|$)/.test(url)) {
  let count = 0;
  function comments(node, depth = 0, media = false) {
    if (!node || typeof node !== "object") return;
    if (++count > 12000 || depth > 40) throw new Error("comment budget");
    if (Array.isArray(node)) { node.forEach(n => comments(n, depth + 1, media)); return; }
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
if (url.includes("/homefeed") && Array.isArray(obj?.data)) {
  obj.data = obj.data.filter(item => {
    if (!item) return false;
    if (item.model_type === "live_v2") return false;
    if (item.ads_info && typeof item.ads_info === "object" && Object.keys(item.ads_info).length > 0) return false;
    if (item?.note_attributes?.includes("goods")) return false;
    if (item?.related_ques) delete item.related_ques;
    return true;
  });
}

// 7. 搜索结果去广告
if (url.includes("/search/notes") && Array.isArray(obj?.data?.items)) {
  obj.data.items = obj.data.items.filter(i => i.model_type === "note");
}

$done({ body: JSON.stringify(obj) });

} catch (error) { $done({}); }
})();
