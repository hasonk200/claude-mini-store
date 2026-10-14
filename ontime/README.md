# ONTIME 作息紀錄（Daybreak 新版）

記錄出門、通勤、上班、用餐和睡眠。夜班跨過午夜時，仍然知道這是哪一個工作日，同時看得到事件的真實日期。

## 怎樣開啟

這是不需要建置的靜態網頁 App（HTML、CSS、JavaScript 模組），放在任何靜態網站伺服器即可：

```bash
cd ontime
npx serve .          # 或 python3 -m http.server
```

用手機瀏覽器開啟後，選「加到主畫面」就可以像 App 一樣使用。首次開啟後可以離線記錄。

開發時可以在網址加上：

- `?now=2026-10-13T03:18`：固定「現在」的時間，方便看夜班情境。
- `?nosw`：不註冊 Service Worker，避免快取舊檔案。

第一次使用可以到「我的 › 安裝與示範」載入示範資料。

## 頁面

| 頁面 | 手機 | 桌面 |
| --- | --- | --- |
| 今天 | 頂部動畫場景、現在狀態、主按鈕、睡前時間、通勤進度 | 另加四行時間軸、紀錄表與檢視面板（可直接改時間） |
| 時間線 | 工作日／日曆日切換、本週日期列 | 同時顯示分行時間軸 |
| 一週與班表 | 由「時間線」右上角進入 | 一週時間軸、範本、最下面的大月曆（可多選日期批次排班） |
| 睡眠 | 計時圓環、所屬工作日、近七天、計畫 | 兩欄排版 |
| 用餐 | 安排／確認、相片 | 兩欄排版 |
| 統計 | 工時、計薪、按單實收、CSV 匯出 | 五個重點數字與出勤明細 |
| 我的 | 個人設定、工作設定、**JSON 備份匯入／匯出**、CSV 匯出、示範資料 | 同左 |

快捷鍵（桌面）：`N` 開啟補登，`Esc` 關閉面板。

## 程式結構

```
ontime/
  index.html            入口
  css/app.css           Daybreak 設計語言、手機與桌面排版、場景動畫
  js/time.js            日期與時間工具（當地時間、夏令時間）
  js/logic.js           作息規則：工作日、睡眠歸屬、睡前預算、日曆日分配、收入（純函式）
  js/store.js           本機 IndexedDB 儲存
  js/sync.js            Google 登入與 Firestore 雲端同步
  js/actions.js         使用者動作、匯入匯出、示範資料
  js/app.js             頁面切換、按鈕與表單處理
  js/views/*.js         各頁畫面；hero.js 是頂部動畫場景
  sw.js                 Service Worker（快取 App 外殼與字體）
  tests/logic.test.mjs  作息規則測試
  tests/hero-gallery.html  所有場景狀態的預覽頁（加 ?compact 看手機版）
```

## 測試

```bash
cd ontime
npm test
```

測試使用 `America/Toronto` 時區，包含夜班跨午夜、下班後睡眠歸屬、睡前未安排時間、夏令時間結束當天、按單收入等情境。

## 發佈新版本

修改任何檔案後，把 `sw.js` 裡的 `VERSION` 加一（例如 `ontime-v2`），使用者下次開啟時會看到「有新版本」提示。

## 目前的限制

- 雲端同步：到「我的 › 雲端同步」用 Google 登入。資料存在 Firebase 專案 `dicky-quota-tracker-2026` 的 `users/{uid}/apps/ontime`，相片另存為 `ontime-photo-{餐次 id}`。兩部裝置同時改同一筆紀錄時，以最後儲存的為準（還沒有逐筆的版本衝突處理）。
- App 部署的網址要加入 Firebase Authentication 的「授權網域」，Firestore 規則要允許登入者讀寫自己 `users/{uid}` 底下的文件，否則登入或同步會失敗。
- 匯入可以讀新版的 JSON 備份，也可以讀舊版 ONTIME 的備份（`dicky-ontime-backup`）。
- 設計思路、需求與每一頁的說明見 [DESIGN.md](DESIGN.md)。
