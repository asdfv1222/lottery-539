/**
 * 539 開獎號碼自動抓取腳本 v2
 * 網頁格式：年份 | 月/日 | 年內期數 | 號碼1~5 | 總期數
 */
const https   = require('https');
const fs      = require('fs');
const path    = require('path');
const iconv   = require('iconv-lite');
const cheerio = require('cheerio');

const YEAR     = new Date().getFullYear();
const URL      = `https://www.nfd.com.tw/lottery/39-year/39-${YEAR}.htm`;
const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_PATH = path.join(DATA_DIR, 'lottery.csv');
const CSV_HEADER = '期數,日期,號碼1,號碼2,號碼3,號碼4,號碼5';

// ── 抓頁面 ──────────────────────────────────────────
function fetchBuffer(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('太多重導向'));
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'zh-TW,zh;q=0.9',
      }
    }, (res) => {
      if ([301,302,303,307].includes(res.statusCode)) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return fetchBuffer(next, redirectCount+1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('請求逾時')); });
  });
}

// ── 解碼 HTML ────────────────────────────────────────
function decodeHtml(buffer, headers) {
  const ct = (headers['content-type'] || '').toLowerCase();
  if (ct.includes('big5') || ct.includes('gb2312')) return iconv.decode(buffer, 'big5');
  const raw = buffer.slice(0, 2000).toString('binary');
  if (/charset=big5/i.test(raw)) return iconv.decode(buffer, 'big5');
  return buffer.toString('utf8');
}

// ── 解析開獎資料 ──────────────────────────────────────
// 網頁 table 格式：
// Col0=年份  Col1=月/日  Col2=年內期  Col3~7=號碼  Col8=總期數
function parseResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('table tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().replace(/\s+/g,' ').trim()).get();
    if (cells.length < 9) return;

    const yearVal   = cells[0].replace(/\D/g, '');   // 年份 → 純數字
    const dateRaw   = cells[1].replace(/\s/g, '');   // 月/日 → 去空格 "01/01"
    const n1 = cells[3], n2 = cells[4], n3 = cells[5], n4 = cells[6], n5 = cells[7];
    const totalPeriod = cells[8].replace(/\D/g, ''); // 總期數

    // 驗證
    if (!yearVal || yearVal.length !== 4) return;
    if (!/^\d{1,2}\/\d{1,2}$/.test(dateRaw)) return;
    const nums = [n1,n2,n3,n4,n5].map(n => parseInt(n));
    if (nums.some(n => isNaN(n) || n < 1 || n > 39)) return;
    if (!totalPeriod || totalPeriod.length < 4) return;

    // 組合日期 YYYY/MM/DD
    const [mm, dd] = dateRaw.split('/');
    const date = `${yearVal}/${mm.padStart(2,'0')}/${dd.padStart(2,'0')}`;

    results.push({
      period: totalPeriod,
      date,
      nums: nums.map(n => String(n).padStart(2,'0'))
    });
  });

  return results;
}

// ── 讀取已有 CSV ──────────────────────────────────────
function loadExistingDates() {
  if (!fs.existsSync(CSV_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CSV_PATH, CSV_HEADER + '\n', 'utf8');
    return new Set();
  }
  const lines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(l => l.trim());
  const dates = new Set();
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    if (cols[1]) dates.add(cols[1].trim());
  }
  return dates;
}

// ── 主程式 ─────────────────────────────────────────
async function main() {
  console.log(`\n📡 抓取 ${YEAR} 年今彩539開獎號碼`);
  console.log(`   來源：${URL}\n`);

  let buffer, headers;
  try {
    ({ buffer, headers } = await fetchBuffer(URL));
    console.log(`✅ 頁面抓取成功（${buffer.length} bytes）`);
  } catch (err) {
    console.error(`❌ 抓取失敗：${err.message}`);
    process.exit(1);
  }

  const html    = decodeHtml(buffer, headers);
  const results = parseResults(html);
  console.log(`📊 解析到 ${results.length} 筆開獎資料`);

  if (results.length === 0) {
    fs.writeFileSync(path.join(DATA_DIR, 'debug.html'), html, 'utf8');
    console.warn('⚠️  未解析到資料，已儲存 debug.html');
    process.exit(0);
  }

  const existingDates = loadExistingDates();
  const newRows = [];

  for (const r of results) {
    if (!existingDates.has(r.date)) {
      newRows.push([r.period, r.date, ...r.nums].join(','));
      console.log(`  ➕ 新增：${r.date}  ${r.nums.join(' ')}`);
    }
  }

  if (newRows.length === 0) {
    console.log('ℹ️  今日資料已是最新，無需更新');
    return;
  }

  fs.appendFileSync(CSV_PATH, newRows.join('\n') + '\n', 'utf8');
  console.log(`\n✅ 已寫入 ${newRows.length} 筆新資料`);
}

main().catch(err => {
  console.error('❌ 執行錯誤：', err);
  process.exit(1);
});
