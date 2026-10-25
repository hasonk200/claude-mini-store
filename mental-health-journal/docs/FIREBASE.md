# 手帳專用 Firebase

專案：`dicky-heartland-journal-2026`，Web App：`1:260948103377:web:909e5e17a4c3ce65a175f0`。Firestore 的 `(default)` 資料庫位於 Toronto（`northamerica-northeast2`），Google 登入已啟用。

設定檔 `.firebaserc`、`firebase.json`、`firestore.rules` 均放在手帳目錄。網頁 SDK 設定在 `index.html`；API key 是公開的用戶端設定，存取權由 Authentication 與 Firestore 規則決定。三個固定版本 SDK 腳本另設 SHA-384 SRI；升級 SDK 時必須同步更新 hash。

## 登入

登入控制器在 `js/auth.js`，直接測試其初始化、錯誤及登入／登出流程。準備期間和視窗開啟期間會停用登入掣；點擊直接開 popup，不會先等待非同步初始化而丟失瀏覽器的使用者操作狀態。視窗被阻擋或取消時，顯示對應說明，讓使用者重試。

GitHub Pages 與 Firebase authDomain 並非同一網站，這版移除 popup 失敗後自動跳轉的處理。Firebase 官方說明見 [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)。

Google provider 由 `firebase deploy --only auth` 設定。CLI 15.32.1 的 auth 部署沒有處理 authorized domains；目前已在後端另行設定：

- `hasonk200.github.io`
- `localhost`
- `dicky-heartland-journal-2026.firebaseapp.com`
- `dicky-heartland-journal-2026.web.app`

若使用另一個預覽網址，需先在 Firebase Console → Authentication → Settings → Authorized domains 加入該 hostname。登出保留本機記錄，避免刪除未同步內容；共用裝置需由使用者自行下載並清除記錄。

## 規則與測試

規則只開放帳戶本人的 `users/{uid}/mentalHealthJournal/{document}`，可寫入文件限定為 `core`、`ci-YYYY`、`dr-YYYY-MM`。其他服務、巢狀子集合與搬遷收據不開放；網頁以空分區處理清除，不開放 delete。

這是一套已有測試的規則初稿：驗證帳戶歸屬、核心必需欄位、頂層資料型別及數量、設定和計畫文字長度；新增和修改共用驗證。動態巢狀日記／遊戲資料仍由用戶端檢查，未宣稱所有巢狀內容均由伺服器驗證。Firestore Rules 沒有通用迴圈去檢查任意 map/list 的每個成員；日後如要完整逐項驗證，需先調整資料模型。

在手帳目錄執行（Node.js 24、Java 21）：

```sh
npm ci
npm run check
npm test
npm run format:check
npm run test:rules
```

規則測試使用 `demo-heartland-journal` 模擬器，毋須正式帳戶或 CI secrets。測試程式在沒有模擬器環境變數時直接停止，不連正式資料庫。

| 測試 | 結果 |
| --- | --- |
| 本人建立／讀取／修改 core、打卡及抽卡分區 | 通過 |
| 未登入與另一帳戶的讀取、查詢、建立、修改、刪除 | 全部拒絕 |
| users 根文件、補充品資料、任意文件、巢狀路徑及搬遷收據 | 拒絕寫入 |
| 建立後再移除必需欄位、插入權限欄位、錯誤型別、超量集合／文字 | 拒絕 |
| 無效分區名稱、超量分區、空分區清除 | 按規則拒絕／允許 |
| 兩個獨立用戶端使用實際 storage.js 先後寫入、重新載入 | 通過，保留兩日記錄 |

沒有共享權限、角色、不可變建立時間、對外圖片路徑或需要防重播的付款計數器，對應攻擊不適用。帳戶 UID 由路徑和 token 決定，文件不能變更所有權；任何其他帳戶均不能讀取私人資料。既有動態 map/list 的巢狀型別及每項長度未做完整服務端驗證，是已知限制。

後端語法檢查與部署：

```sh
npx firebase deploy --only firestore:rules --dry-run --project dicky-heartland-journal-2026
npx firebase deploy --only firestore:rules --project dicky-heartland-journal-2026
```

規則已通過上述 dry run，並已部署至新專案。此工作沒有更改補充品追蹤專案的規則。

## 舊資料銜接與正式切換

2026-10-24 已複製一個手帳帳戶及三份手帳文件，逐份比對資料一致。只複製手帳使用者的 Google 身分，保留原 Firebase UID；沒有複製補充品記錄、密碼、權限 claims 或其他登入方式，亦沒有刪除舊資料。本機 `dicky-care-v1` 及按 UID 分帳戶的暫存沿用。

`scripts/migrate-firebase.cjs` 使用已登入的 Firebase CLI 身分。預設只預覽，加入 `--apply` 才寫入固定的新專案；資料在記憶體直接搬遷，輸出只含數量。新專案的私有收據記下複製內容的 hash，重跑時若發現新專案已有後續修改便停止；寫入使用版本條件及原子 commit，避免覆蓋讀取後的新修改。

PR 尚未合併，正式 GitHub Pages 仍使用舊專案。**合併前須先停止舊版寫入，重跑搬遷，然後才切換網頁**：

```sh
npm run migrate:firebase -- --account your-google-account@example.com
npm run migrate:firebase -- --apply --account your-google-account@example.com
```

1. 關閉其他裝置／分頁的舊版手帳，下載當前備份。
2. 預覽後套用搬遷；若新專案已有改動，指令會停止，先比對記錄再決定合併，勿強行覆寫。
3. 合併 PR 後，重新載入各裝置的網頁並登入 Google。既有登入狀態不會跨 Firebase 專案保留。
4. 用真實帳戶驗證同一筆打卡能在另一部裝置讀到，再繼續使用。

回退網頁不會把新專案新增的資料搬回舊專案；回退前先匯出新資料。

## 尚未驗證

瀏覽器已驗證真實 SDK 通過 SRI、初始化新專案，以及開啟 Google 帳戶登入頁。沒有代使用者輸入帳戶憑證，故未完成真實 Google OAuth 回程；已用合成帳戶測試頁面登入成功、失敗重試及登出。

兩個模擬器用戶端的先後讀寫通過，兩部真實裝置同時修改尚未測試。core 仍採整份文件最後寫入方式；同時修改同一份資料可能互相覆蓋，這次沒有聲稱解決並行衝突。
