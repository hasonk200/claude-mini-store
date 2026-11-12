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

## 日後新增欄位的發佈順序

**先部署規則，再部署網站。** 現有 `isValidCore` 對同一份 `fields` 同時使用 `hasAll` 和 `hasOnly`：缺少必需欄位、或多出未允許欄位，都會拒絕整份 `core` 寫入。`settings`、`plan` 等內層欄位亦有獨立限制，修改時須一併核對。

1. 修改資料格式、規則及 Emulator 測試。新欄位先加入允許清單，保留原有必需清單，並只在欄位存在時檢查型別／範圍，或用安全預設值檢查。不能把新欄位直接加入現有共用 `fields`，令舊版 payload 缺欄位而失敗。參考官方[必需及可選欄位規則](https://firebase.google.com/docs/firestore/security/rules-fields#combining_required_and_optional_fields)。
2. 驗證新規則接受舊版與新版的建立／修改，同時仍拒絕其他帳戶、未允許欄位及無效新欄位。網站也要能讀取缺少新欄位的舊資料及舊備份。
3. 通過 `npm run test:rules` 和上面的規則 dry run 後，先部署新專案規則，確認生效；再合併／發佈使用新欄位的網站。Journal checks 只測試，綠燈不代表規則已部署。
4. 如日後需要把新欄位改成必需，先完成資料遷移及舊版用戶端的升級／停寫安排，再收緊規則。網站更新不會令已開啟的舊分頁自動升級；回退網站時亦須保留相容規則。

目前 `core` 是整份 `set`，舊版寫入仍可能移除新版新增的欄位。依賴新欄位保存重要資料前，須另行處理舊版寫入與資料版本；上述發佈順序只解決規則相容性。

## 容量限制與後續工作

Firestore 單份文件上限是 **1 MiB（1,048,576 bytes）**，適用於 `core` 及每個打卡／抽卡分區。現時 `evidence`、`pet`、週回顧等都在 `core`；`evidence.size() <= 10000` 只限制條數，沒有保證每條內容及整份文件總量合規，可能未到 10,000 條便超限。官方依據：[文件上限](https://firebase.google.com/docs/firestore/quotas#collections_documents_and_fields)、[文件大小計算](https://firebase.google.com/docs/firestore/storage-size#document_size)。

目前未量度用戶實際 `core` 大小，不能據此判斷何時會超限。寫入錯誤現時共用「暫時同步唔到」提示；文件過大不會因重新連線而解決。尚未實作的後續工作：

- 按 Firestore 計算方式量度實際寫入的文件，接近上限時提示；不能把 `JSON.stringify(...).length` 當成文件 bytes，中文 UTF-8、欄位名稱、文件路徑及額外開銷都要計算。
- 區分已確認的容量超限、權限與網絡失敗，提供清楚原因及下載備份入口；未確認原因時不把一般寫入錯誤誤判成容量問題，也不自動截斷或刪除記錄。
- 優先評估將證據簿移到獨立文件或有容量上限的分區。搬遷須保留既有記錄，更新載入／同步／備份還原／清除流程及規則，並驗證重試不重複、部分失敗可恢復；只按年月分區仍須檢查每個分區的實際大小。

## 舊資料銜接與正式切換

2026-10-24 已複製一個手帳帳戶及三份手帳文件，逐份比對資料一致。只複製手帳使用者的 Google 身分，保留原 Firebase UID；沒有複製補充品記錄、密碼、權限 claims 或其他登入方式，亦沒有刪除舊資料。本機 `dicky-care-v1` 及按 UID 分帳戶的暫存沿用。

`scripts/migrate-firebase.cjs` 使用已登入的 Firebase CLI 身分。預設只預覽，加入 `--apply` 才寫入固定的新專案；資料在記憶體直接搬遷，輸出只含數量。新專案的私有收據記下複製內容的 hash，重跑時若發現新專案已有後續修改便停止；寫入使用版本條件及原子 commit，避免覆蓋讀取後的新修改。

PR 尚未合併，正式 GitHub Pages 仍使用舊專案 `dicky-supplement-tracker-2026`，**目前沒有把舊手帳鎖為唯讀**。正式切換時，先確認新專案規則已部署；再把舊手帳路徑設為唯讀，重跑最後一次搬遷，然後才切換網頁。不能只靠關閉已知分頁停寫，也不能等切換完才鎖舊專案，否則搬遷與切換期間仍可能有舊頁面寫入。

在手帳目錄預覽及套用搬遷：

```sh
npm run migrate:firebase -- --account your-google-account@example.com
npm run migrate:firebase -- --apply --account your-google-account@example.com
```

1. 確認新專案規則與本次網站相容並已生效。下載各裝置的 JSON 備份，先同步可送出的本機記錄，然後關閉舊分頁；離線或尚未同步的內容不會包含在雲端搬遷內，必須另行保留。
2. 備份舊專案目前的完整規則，再按下節把手帳路徑設為唯讀，保留其他應用原有權限。先用 Emulator 驗證完整規則，再部署至明確指定的舊專案；確認本人可讀、create／update／delete 均被拒絕，才繼續搬遷。若有使用 IAM／Admin SDK 的舊寫入工作，也須暫停；這些工作不受用戶端規則限制。
3. 預覽後套用搬遷，逐份核對兩邊的文件數及內容 hash；若新專案已有改動，指令會停止，先比對記錄再決定合併，勿強行覆寫。
4. 合併 PR 並發佈網站後，重新載入各裝置的網頁並登入 Google，確認連到新專案。既有登入狀態不會跨 Firebase 專案保留。
5. 用真實帳戶驗證同一筆打卡能在另一部裝置讀到，再繼續使用；核對各裝置備份中的未同步記錄，避免直接用整份舊備份蓋過新資料。
6. 切換後再次確認舊手帳仍只可讀、不可寫；保留舊資料作核對，避免舊版頁面或離線待送的寫入繼續分流到舊專案。

### 舊專案手帳唯讀規則

以下是要整合到**舊專案完整規則**的片段，只處理 `users/{uid}/mentalHealthJournal/{document}`；不能用本目錄的新專案 `firestore.rules` 整份覆蓋舊專案，否則會影響共用該專案的補充品等應用。

```text
match /users/{userId}/mentalHealthJournal/{document} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow create, update, delete: if false;
}
```

**必須一併檢查重疊規則。** 如果舊專案仍有 `users/{userId}/{document=**}` 等廣泛的 `allow write`，上面的 `false` 不會覆蓋另一條已允許的規則；要把舊的寫入條款收窄，或明確排除手帳路徑及其巢狀內容，並保留其他應用所需權限。官方說明：[重疊 match 的允許語意](https://firebase.google.com/docs/firestore/security/rules-structure#overlapping_match_statements)。

正式部署前，測試的是**整合後完整舊規則**，不只是片段：本人可讀既有手帳，任何用戶端對手帳建立／修改／刪除都被拒絕，未登入及其他帳戶不能讀取，手帳巢狀路徑沒有繞過，補充品原有合法讀寫及帳戶隔離仍通過。部署後以測試帳戶確認規則已生效，不對真實手帳做試寫；保留規則版本及驗證結果。

回退網頁不會把新專案新增的資料搬回舊專案；回退前先匯出新資料。不可為了回退頁面就直接重開舊手帳寫入；須先停止新專案寫入並核對、回搬新增資料，避免兩邊各自繼續累積。

## 尚未驗證

瀏覽器已驗證真實 SDK 通過 SRI、初始化新專案，以及開啟 Google 帳戶登入頁。沒有代使用者輸入帳戶憑證，故未完成真實 Google OAuth 回程；已用合成帳戶測試頁面登入成功、失敗重試及登出。

兩個模擬器用戶端的先後讀寫通過，兩部真實裝置同時修改尚未測試。core 仍採整份文件最後寫入方式；同時修改同一份資料可能互相覆蓋，這次沒有聲稱解決並行衝突。
