/**
 * 539 開獎號碼自動抓取腳本
 * 來源：https://www.nfd.com.tw/lottery/39-year/39-2026.htm
 * 執行：每天 21:30 台灣時間（GitHub Actions）
 */

const https = require('https');
const fs   = require('fs');
const path = require('path');

const iconv   = require('iconv-lite');
const cheerio = require('cheerio');

// ── 設定 ──────────────────────────────────────────────
const YEAR     = new Date().getFullYear();
const URL      = `https://www.nfd.com.tw/lottery/39-year/39-${YEAR}.htm`;
const DATA_DIR = path.join(__dirname, '..', 'data');
const CSV_PATH = path.join(DATA_DIR, 'lottery.csv');
const CSV_HEADER = '期數,日期,號碼1,號碼2,號碼3,號碼4,號碼5';

// ── 工具函式 ──────────────────────────────────────────
function fetchBuffer(url, redirectCount = 0) {
  if (redirectCount > 5) return Promise.reject(new Error('太多重導向'));
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-TW,zh;q=0.9',
        'Connection': 'keep-alive',
      }
    };
    const req = https.get(url, options, (res) => {
      // 處理重導向
      if ([301, 302, 303, 307].includes(res.statusCode)) {
        const loc = res.headers.location;
        const next = loc.startsWith('http') ? loc : new URL(loc, url).href;
        return fetchBuffer(next, redirectCount + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), headers: res.headers }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('請求逾時')); });
  });
}

function decodeHtml(buffer, headers) {
  const ct = (headers['content-type'] || '').toLowerCase();
  // 先從 HTTP header 判斷
  if (ct.includes('big5') || ct.includes('gb2312')) {
    return iconv.decode(buffer, 'big5');
  }
  if (ct.includes('utf-8')) {
    return buffer.toString('utf8');
  }
  // 從原始 bytes 掃描 meta charset
  const raw = buffer.slice(0, 2000).toString('binary');
  if (/charset=big5/i.test(raw) || /charset="big5"/i.test(raw)) {
    return iconv.decode(buffer, 'big5');
  }
  // 預設嘗試 UTF-8
  return buffer.toString('utf8');
}

// ── 解析開獎資料 ──────────────────────────────────────
function parseResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  // 策略一：找 <td> 裡含有 5 個 1~39 的號碼型態
  $('tr').each((_, tr) => {
    const cells = $(tr).find('td').map((_, td) => $(td).text().trim()).get();
    if (cells.length < 3) return;

    // 嘗試從每格找出號碼群（空白或逗號分隔的數字）
    let period = '';
    let date   = '';
    let nums   = [];

    for (const cell of cells) {
      // 期數格：純數字，5-7碼
      if (/^\d{5,7}$/.test(cell) && !period) {
        period = cell;
        continue;
      }
      // 日期格：yyyy/mm/dd 或 yyyy-mm-dd
      if (/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/.test(cell) && !date) {
        date = cell.match(/\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/)[0].replace(/-/g, '/');
        continue;
      }
      // 號碼格：含有多個 01~39 的數字
      const extracted = cell.match(/\b([1-9]|[1-3][0-9])\b/g) || [];
      const valid = extracted.filter(n => +n >= 1 && +n <= 39);
      if (valid.length === 5) {
        nums = valid.map(n => String(n).padStart(2, '0'));
      }
    }

    // 若同一列沒抓到，嘗試號碼在不同td各自一個的格式
    if (nums.length === 0) {
      const numCells = cells.filter(c => /^\d{1,2}$/.test(c) && +c >= 1 && +c <= 39);
      if (numCells.length >= 5) {
        nums = numCells.slice(0, 5).map(n => String(n).padStart(2, '0'));
      }
    }

    if (date && nums.length === 5) {
      results.push({ period, date, nums });
    }
  });

  return results;
}

// ── 讀取現有 CSV ──────────────────────────────────────
function loadExistingCsv() {
  if (!fs.existsSync(CSV_PATH)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CSV_PATH, CSV_HEADER + '\n', 'utf8');
    return new Set();
  }
  const lines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(l => l.trim());
  const dates = new Set();
  for (const line of lines.slice(1)) {  // 跳過 header
    const cols = line.split(',');
    if (cols[1]) dates.add(cols[1].trim());
  }
  return dates;
}

// ── 主程式 ──────────────────────────────────────────
async function main() {
  console.log(`\n📡 開始抓取 ${YEAR} 年今彩539開獎號碼...`);
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
    console.warn('⚠️  未解析到資料，可能頁面結構已更動，請手動確認');
    // 儲存 debug 用 HTML
    fs.writeFileSync(path.join(DATA_DIR, 'debug.html'), html, 'utf8');
    console.log('   已儲存 data/debug.html 供人工排查');
    process.exit(0);
  }

  // 載入已有資料，避免重複
  const existingDates = loadExistingCsv();
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

  // 追加寫入 CSV
  fs.appendFileSync(CSV_PATH, newRows.join('\n') + '\n', 'utf8');
  console.log(`\n✅ 已寫入 ${newRows.length} 筆新資料 → ${CSV_PATH}`);
}

main().catch(err => {
  console.error('❌ 執行錯誤：', err);
  process.exit(1);
});
