# Dicky 心晴手帳

心理健康自助日記，包含今日打卡、證據簿、細步階梯、週回顧、抽卡及寵物。

- 本機優先；在「設計理念・設定」登入 Google 後，記錄同步到 Firebase Firestore。
- Firebase 專案：dicky-supplement-tracker-2026（獨立 Web App / mentalHealthJournal 命名空間）。
- 使用 /users/{uid}/mentalHealthJournal 及 Firestore 依登入 UID 的規則控制資料存取。
- 資料內容不會被上傳到 GitHub；但 HTML 內的預設示例文字屬公開原始碼。
- 雲端不是端對端加密。可用設定中的「匯出備份」下載 JSON。
- 如 Google 登入失敗，請檢查 Firebase Authentication 的 Google provider 與 authorized domains。

本工具不能取代專業評估或治療。
