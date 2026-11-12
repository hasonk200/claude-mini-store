# 心晴小島場景素材

2026-10-23 使用 OpenAI ImageGen 為本專案生成，轉成 WebP（品質 88）以減少下載大小。原牌卡與寵物繼續使用專案既有 SVG；尋路棋盤、樹木、箱子、門及機關以程式 SVG 繪製，確保視覺與碰撞格一致。

| 檔案 | 用途 | 大小 |
| --- | --- | --- |
| `island-day.webp` | 日光主地圖、探索明信片 | 約 510 KiB |
| `island-night.webp` | 同一小島的夜色主地圖 | 約 459 KiB |
| `lakeside.webp` | 湖畔休息場景 | 約 425 KiB |

## 生成方向（提示詞摘要）

- 日光：溫暖的手繪微縮島嶼，湖水環繞，左上綠屋頂小屋、右上圓頂觀星書屋、左下玻璃溫室、中央噴泉廣場、右側木碼頭。秋日金光、細緻植物與石路、柔和景深。3:2 構圖，無字、無人物、無介面。
- 夜色：沿用日光地圖的位置與鏡頭，轉為深藍月夜，屋內暖燈、庭園燈、柔和水面倒影；保留同一島嶼，無字、無介面。
- 湖畔：同一故事世界的近景木碼頭與長凳，安靜湖水、遠山、金色陽光，留出可放伙伴的位置。3:2 構圖，無字、無人物、無介面。

使用時保留圖片原比例，熱點以 HTML 按鈕覆蓋，不把文字烘焙進圖片。

## 3D 場景：程式庫與素材

3D 場景（`js/scene3d/`）全部以程式生成：模型由 three.js 基本幾何組合，地板、牆身、地氈、天空、小島地面與湖面、樹葉及寵物表情以 canvas 即時繪畫成貼圖。**沒有使用任何外部 3D 模型、貼圖或字型檔。**

| 檔案 | 來源 | 授權 |
| --- | --- | --- |
| `vendor/three/three.module.min.js` | [three.js](https://github.com/mrdoob/three.js) 0.170.0 `build/three.module.min.js` | MIT（見 `vendor/three/LICENSE`） |
| `vendor/three/addons/controls/OrbitControls.js` | three.js 0.170.0 `examples/jsm/controls/OrbitControls.js` | MIT |

- `vendor/three/` 由 `npm run vendor:three`（`scripts/vendor-three.cjs`）由 `node_modules/three` 原封不動複製，不要手改。升級版本時改 `package.json` 的 `three` 版本及腳本內的 `EXPECTED_VERSION`，再重新執行。
- `npm run vendor:check`（CI 會執行）比對 vendor 檔案與 npm 套件的 SHA-256，不一致就失敗。
- 網站仍然是純靜態、無需編譯：瀏覽器以 `index.html` 的 import map 直接載入 `vendor/three/`，而且只在開啟 3D 並進入有 3D 場景的頁面時才下載。
- 日後如加入 glTF 模型，只可使用 CC0 素材（例如 Kenney、Quaternius），放在 `assets/models/` 並在此列明來源。
