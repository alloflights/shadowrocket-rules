// 小红书去广告、无水印原图保存与 LivePhoto 增强 (全版本自适应版)
// 维护: allofights
const url = $request.url;
const isQuanX = typeof $task !== "undefined";
if (!$response.body) $done({});

let obj;
try {
  obj = JSON.parse($response.body);
} catch (e) {
  $done({});
}

// 核心函数：遍历并解锁媒体保存、去水印与视频下载
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

// 深度递归遍历器：无论小红书将笔记包装在 data[0].note_list、data.items 还是任意深层，均能100%命中
function traverse(node) {
  if (!node || typeof node !== "object") return;
  patchMedia(node);
  if (Array.isArray(node)) {
    for (let child of node) traverse(child);
  } else {
    for (let key of Object.keys(node)) {
      if (typeof node[key] === "object") traverse(node[key]);
    }
  }
}

// 1. 笔记详情 / 推荐流 / 图片流 / 视频流 (正则通配，彻底免疫 v1/v2/v3/v4 接口版本迭代)
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
    if (item.hasOwnProperty("ads_info")) return false;
    if (item.hasOwnProperty("card_icon")) return false;
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
