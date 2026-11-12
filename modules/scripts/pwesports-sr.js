/* Shadowrocket only. Based on the data.ad field in Kelee's open-screen rule:
 * https://github.com/fkingikelee/fkikelee/blob/main/lpx/PerfectWorldEsport_remove_ads.lpx
 * Keep other config and every JSON number intact; unknown/error responses pass through.
 */
(function () {
  try {
    if (!/^https?:\/\/api\.wmpvp\.com\/api\/v1\/config\/promote(?:[?#]|$)/i.test(String($request.url || ''))) return $done({});
    function headers(input, response) {
      var out = {};
      Object.keys(input || {}).forEach(function (key) {
        if (!(response ? /^(?:etag|last-modified|content-length|content-encoding|cache-control|expires)$/i : /^(?:if-none-match|if-modified-since|cache-control|pragma)$/i).test(key)) out[key] = input[key];
      });
      out['Cache-Control'] = response ? 'no-store' : 'no-cache';
      if (!response) out.Pragma = 'no-cache';
      return out;
    }
    // Ask for a fresh configuration rather than reusing an unfiltered 304 cache.
    if (typeof $response === 'undefined') return $done({ headers: headers($request.headers, false) });
    if (!$response || typeof $response.body !== 'string' || !$response.body) return $done({});
    var status = Number($response.status || $response.statusCode || 0);
    if (status && (status < 200 || status >= 300)) return $done({});
    var source = $response.body;
    var tokenRe = /"(?:[^"\\]|\\[\s\S])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
    var tokens = source.match(tokenRe) || [];
    var prefix = '__pwesports_exact_number_';
    // Encode all JSON numbers temporarily so JS cannot round IDs or cursors.
    while (tokens.some(function (t) { return t.charAt(0) === '"' && JSON.parse(t).indexOf(prefix) !== -1; })) prefix += 'x';
    var numbers = [];
    var prepared = source.replace(tokenRe, function (token) {
      if (token.charAt(0) === '"') return token;
      return JSON.stringify(prefix + (numbers.push(token) - 1) + '__');
    });
    var root = JSON.parse(prepared);
    if (!root || typeof root !== 'object' || Array.isArray(root) || !root.data || typeof root.data !== 'object' || Array.isArray(root.data) || !Object.prototype.hasOwnProperty.call(root.data, 'ad')) return $done({});
    delete root.data.ad;
    var body = JSON.stringify(root).replace(new RegExp('"' + prefix + '(\\d+)__"', 'g'), function (_, index) { return numbers[Number(index)]; });
    $done({ body: body, headers: headers($response.headers, true) });
  } catch (_) { $done({}); }
})();
