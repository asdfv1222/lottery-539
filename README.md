# 🎱 今彩539 養號追蹤系統

全自動化 539 開獎追蹤 · GitHub Actions 每日抓取 · GitHub Pages 手機可看

---

## 🚀 第一次部署步驟（約15分鐘）

### 步驟一：建立 GitHub Repository

1. 登入 [github.com](https://github.com)
2. 右上角 **+** → **New repository**
3. Repository name 填：`lottery-539`（或自訂名稱）
4. 設定為 **Public**（GitHub Pages 免費版需要）
5. 點 **Create repository**

---

### 步驟二：上傳所有檔案

在電腦開啟「命令提示字元」(cmd)，依序執行：

```cmd
cd C:\Users\你的名字\Downloads\539system

git init
git add .
git commit -m "初始化 539 追蹤系統"
git branch -M main
git remote add origin https://github.com/你的帳號/lottery-539.git
git push -u origin main
```

---

### 步驟三：啟用 GitHub Pages

1. 進入你的 repo → **Settings** → 左側 **Pages**
2. Source 選：**Deploy from a branch**
3. Branch 選：**main** / **/(root)**
4. 點 **Save**
5. 約1分鐘後，你的網址會是：
   `https://你的帳號.github.io/lottery-539/`

---

### 步驟四：修改 index.html（填入你的資訊）

用記事本打開 `index.html`，找到這兩行並修改：

```javascript
const GITHUB_USER = 'YOUR_GITHUB_USERNAME';   // ← 改成你的 GitHub 帳號
const GITHUB_REPO = 'lottery-539';            // ← 改成你的 repo 名稱
```

修改後重新 push：
```cmd
git add index.html
git commit -m "設定帳號資訊"
git push
```

---

### 步驟五：測試自動抓取

1. 進入 repo → **Actions** 分頁
2. 左側點「每日抓取539開獎號碼」
3. 右側點 **Run workflow** → **Run workflow**
4. 等約1分鐘，應該看到綠色勾勾
5. 確認 `data/lottery.csv` 已有資料

---

## 📱 日常使用說明

### 每天要做的事（1分鐘）

1. 開啟 `https://你的帳號.github.io/lottery-539/` 看今日開獎
2. 下注後，編輯 GitHub 上的 `data/manual.json`，新增今日記錄：

```json
{
  "date": "2026/06/11",
  "bet": true,
  "cost": 500,
  "result": "未中獎",
  "note": ""
}
```

result 可填：`未中獎` / `中獎第5獎` / `中獎第4獎` / `中獎第3獎` / `中獎第2獎` / `中獎頭獎`

### 修改 manual.json 的方法

在 GitHub 網頁直接編輯：
1. 進入 repo → `data/manual.json`
2. 右上角鉛筆圖示
3. 新增一行到 `bets` 陣列
4. 點 **Commit changes**

---

## ⏰ 自動排程時間

- 每天 **21:30 台灣時間** 自動執行
- 開獎約 20:30，預留1小時確保資料上線
- 若當天休市（假日）會自動跳過，不做 commit

---

## 🛠 故障排除

| 問題 | 解法 |
|------|------|
| 網頁顯示「載入失敗」| 確認 index.html 裡的帳號設定正確 |
| Actions 失敗 | 進 Actions 頁面點進去看錯誤訊息 |
| 號碼沒有更新 | 手動到 Actions 點 Run workflow |
| 解析失敗 | 查看 `data/debug.html`，網站結構可能有變 |

---

## 📊 帳務更新

修改 `data/manual.json` 裡的 `config` 區段：

```json
"config": {
  "principal": 30000,
  "spent_before_now": 18800
}
```

---

*養號 17 · 18 · 25 · 36｜500元/期｜啟動：2026/05/30*
