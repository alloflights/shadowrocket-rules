#!/usr/bin/env node
'use strict';
// 只检查 Shadowrocket 引用的公开远程规则，不执行下载的内容。
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const inputs = ['Shadowrocket_LazyGroup_Merged.conf', 'Shadowrocket_AllInOne_Ultimate.conf', ...fs.readdirSync(path.join(root, 'modules')).filter((n) => n.endsWith('.sgmodule')).map((n) => `modules/${n}`)];
const urls = new Map();
for (const file of inputs) {
  for (const line of fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/)) {
    const match = line.match(/^(RULE-SET|DOMAIN-SET),(https:\/\/[^,\s]+),/);
    if (match) urls.set(match[2], match[1]);
  }
}
async function check(url, type) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`HTTP ${response.status}`); }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 8 * 1024 * 1024) throw new Error('规则超过 8 MiB 上限');
        chunks.push(chunk);
      }
      const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
      if (!lines.length || /<(?:html|!doctype)/i.test(text.slice(0, 256))) throw new Error('空规则或返回 HTML');
      if (type === 'RULE-SET' && !/^(DOMAIN(?:-SUFFIX|-KEYWORD|-WILDCARD|-REGEX)?|IP-CIDR6?|IP-ASN|GEOIP|USER-AGENT|URL-REGEX|AND|OR|NOT|PROCESS-NAME|DST-PORT),/.test(lines[0])) throw new Error(`非预期规则格式：${lines[0].slice(0, 80)}`);
      if (type === 'DOMAIN-SET' && !/^(?:\+\.|\.)?[a-z0-9_*.-]+$/i.test(lines[0])) throw new Error('非预期域名集格式');
      console.log(`OK ${url} (${lines.length} lines)`);
      return;
    } catch (error) { lastError = error; }
  }
  throw new Error(`${url}: ${lastError.message}`);
}
(async () => {
  const entries = [...urls]; let cursor = 0; let failed = 0;
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, async () => {
    while (cursor < entries.length) {
      const [url, type] = entries[cursor++];
      try { await check(url, type); } catch (error) { failed++; console.error(`FAIL ${error.message}`); }
    }
  }));
  console.log(`Checked ${entries.length} remote rule URLs, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
