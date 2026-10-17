const r = String.raw;
const W = r`^https:\/\/api\.weibo\.cn\/2\/`;
module.exports = {
  id: 'weibo',
  name: '微博净化',
  desc: '去除微博开屏、时间线 / 关注流 / 热搜 / 评论区推广、浮窗与签到提醒。',
  rules: [],
  rewrites: [
    W + r`(ug\/checkin\/list|push\/daily)\? - reject-dict`,
    W + r`!\/live\/media_homelist\? - reject-dict`,
    W + r`comments\/bullet_screens\? - reject-dict`,
    W + r`photo\/info\? - reject-dict`,
    W + r`statuses\/(container_positive|push_info)\? - reject-dict`,
    W + r`vote\/get_vote_detail\? - reject-dict`,
    W + r`!\/chaohua\/discovery\/home_bottom\/switch\? - reject-dict`,
    W + r`!\/huati\/(discovery_home_bottom_getdotinfo|mobile_discovery_searchchange)\? - reject-dict`,
    W + r`!\/wbox\/\w+\/(home_bottom_modal|interest_category)\? - reject-dict`,
    W + r`search\/container_discover\? - reject-dict`,
    W + r`hot\/hours_spotlight\? - reject-dict`,
    W + r`video\/redpacket\? - reject-dict`,
    r`^https:\/\/api\.weibo\.cn\/!\/sug\/list\/finderchange\? - reject-dict`,
    r`^https:\/\/bootrealtime\.uve\.weibo\.com\/v[23]\/ad\/realtime - reject-dict`,
    r`^https:\/\/sdkapp\.uve\.weibo\.com\/interface\/sdk\/(get-lbs-cell-info\.php|sdkconfig\.php) - reject`,
    r`^https:\/\/card\.weibo\.com\/article\/m\/aj\/(reward|uvead)\? - reject-dict`,
    r`^https:\/\/weibo\.com\/ttarticle\/x\/m\/aj\/(reward|uvead)\? - reject-dict`,
  ],
  scripts: [
    { name: 'weibo_main', type: 'response', pattern: r`^https?:\/\/api\.weibo\.cn\/2\/(cardlist|page|statuses\/(container_timeline|extend|show)|checkin\/show|client\/publisher_list|push\/active|groups\/allgroups\/v2|comments\/build_comments|profile\/(container_timeline|me|userinfo)|search\/(container_timeline|finder)|video\/tiny_stream_video_list)`, script: 'weibo.js', maxSize: 2097152, timeout: 30 },
    { name: 'weibo_preload', type: 'response', pattern: r`^https?:\/\/(sdkapp|bootpreload|wbapp)\.uve\.weibo\.com\/(interface\/sdk\/sdkad\.php|v[12]\/ad\/preload|wbapplua\/wbpullad\.lua|preload\/get_ad)`, script: 'weibo.js', maxSize: 1048576, timeout: 30 },
  ],
  mitm: ['api.weibo.cn', '*.uve.weibo.com', 'card.weibo.com', 'weibo.com'],
};
