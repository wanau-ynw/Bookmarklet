# 開発者向けメモ

このドキュメントは、リポジトリ全体のコード資産を解析して作成した開発者向けの技術メモです。
利用者向けの説明は [README.md](../README.md)、開発参加の手順は [how-to-develop.md](./how-to-develop.md) を参照してください。

## 1. プロジェクト概要

pop'n music アーケード版の公式サイト(e-amusement / p.eagate.573.jp)のプレイデータをスクレイピングし、
難易度表への自動記入やフレンド(ポプとも)比較などを行う**ブックマークレット集**。

- ビルドツール・パッケージマネージャ(`package.json` 等)は**存在しない**。素の HTML/CSS/JS を GitHub Pages でそのまま配信する構成。
- リンタ・テストフレームワークも未導入。CI ワークフロー(`.github/`)も存在しない。
- 「ビルド」に相当する工程はなく、GitHub Pages の静的ホスティング自体が配布機構。

## 2. ディレクトリ構成

```
├── README.md                  利用者向け説明(ブックマークレット登録方法など)
├── fullcomboList.js            ブックマークレット①: フルコン/クリア難易度表 自動記入
├── poptomo.js                  ブックマークレット②: ポプとも比較ツール
├── pairscore.html               独立ツール: ペアスコアタ祭り部門 組み合わせ検索
├── pairscoreEX.html             独立ツール: ペアスコアタEX部門 組み合わせ検索
├── testdata.txt                 開発用テストデータ(公式サイト負荷軽減用)
├── doc/
│   ├── how-to-develop.md        開発参加手順(フォーク→GitHub Pages公開→PR)
│   └── developer-notes.md       本ドキュメント
├── css/                          style.css(独自) + bootstrap/dataTables/normalize(vendor)
├── js/
│   ├── webtool.js                公式サイト共通スクレイピング処理
│   ├── logger.js                 画面メッセージ表示ユーティリティ
│   ├── storage.js                session/localStorage ラッパー
│   ├── difficultyPage.js         難易度表描画のメイン処理
│   ├── personalDataPage.js       個人統計ページのメイン処理
│   └── jquery/popper/bootstrap/dataTables/Chart.bundle (vendor, 自前ホスト)
├── img/                          難易度表ベース画像(c46~c50.jpg, f45~f48.jpg)、ロゴ、サンプル画像
├── icon/                         メダル(c_1~c_12.png)・ランク(s_1~s_12.png)アイコン
└── list/                         難易度表の曲名配置データ(c46~c50.txt, f45~f48.txt、タブ区切り)
```

## 3. 各ツールの役割

| ツール | エントリファイル | 目的 | 入力 | 出力 |
|---|---|---|---|---|
| フルコン/クリア難易度表 自動記入 | `fullcomboList.js`(`(lv, mode)`) | 公式サイトのプレイデータを取得し、難易度表ベース画像にメダル/ランクアイコンを自動描画 | `lv`(対象Lv、0で一覧選択画面)、`mode`(0:一覧, 1:フルコン, 2:クリア) | 難易度表画像(JPG・DLボタン付き)、個人統計グラフ、曲一覧DataTables |
| ポプとも比較ツール | `poptomo.js`(引数なし) | 「ポプとも」対戦成績を取得し、Lv別のスコア比較・勝敗円グラフを表示 | 比較相手・比較Lv(1-50)の選択 | 勝敗数/平均スコア、Chart.js円グラフ、曲別比較表 |
| ペアスコアタ祭り部門 組み合わせ検索 | `pairscore.html`(単体ページ) | 2人×2曲のペア戦で合計スコア差が最小になる割当を探索 | 各人・各曲のスコア候補(カンマ区切り複数可) | 最小差の組み合わせ、合計スコア |
| ペアスコアタEX部門 組み合わせ検索 | `pairscoreEX.html`(単体ページ) | 2人で4曲を分担し合計スコア最大になる割当を6通り総当たりで探索 | 各曲・各人のスコア | 最適割当と合計スコア |

`pairscore.html` / `pairscoreEX.html` は README・他ソースからリンクされておらず、GitHub Pages 上に単独で置かれている運用と見られる。

## 4. 配布の仕組み(ブックマークレットのロード方式)

ビルド・圧縮は一切行わず、以下のような **動的 import + 多段スクリプトローディング** で完結している。

1. ユーザーはブラウザのブックマークに次の1行を登録する(README記載の形式):
   ```js
   javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(0, 0));
   ```
2. `fullcomboList.js` / `poptomo.js` の `export default async (...) => {...}` が実行され、その中で
   `document.createElement('script'|'link')` を使い、jQuery → Popper → Bootstrap → DataTables → Chart.js →
   自前JS(`logger.js` → `storage.js` → `webtool.js` → `personalDataPage.js` / `difficultyPage.js`) → CSS群
   の順に**逐次**読み込む(`loadScript`/`loadCSS` ヘルパー)。
3. vendor ライブラリは CDN を使わず `.min.js` / `.min.css` をリポジトリに同梱・自前ホストしている。

### 既知の技術的負債

- **`GITHUB_URL` のハードコード**:配信元URL(`https://wanau-ynw.github.io/Bookmarklet`)が
  `fullcomboList.js`、`poptomo.js`、`js/personalDataPage.js` の複数箇所に直書きされている。
  フォークして開発する際は各ファイルでこの値を書き換える必要があり、`doc/how-to-develop.md` でも
  issue #17 として既知の課題に挙げられている。共通設定化されていない点は注意。
- **`js/webtool.js` 内の `loadImage` 関数重複定義**:同名関数が2回定義されており、後者が前者を上書きする形になっている。意図した挙動か要確認。
- リモートの実運用先は `https://github.com/ynws/Bookmarklet`、`GITHUB_URL` 内の `wanau-ynw` は
  フォーク/開発用アカウントの名残とみられる。

## 5. 主要ロジックのポイント

- **`js/webtool.js`**:公式サイトの HTML をスクレイピングする共通処理。文字コード判定(Shift_JIS/UTF-8)、
  メダル/ランク画像URL→ID変換テーブル、アイコン画像のプリロードなどを担う。すべてのツールの土台。
- **`js/difficultyPage.js`**:`list/*.txt` の曲名配置マトリクスと `img/c*.jpg`・`img/f*.jpg` のベース画像を
  突合し、Canvas 上にメダル/ランクアイコンを重ね描画。対応Lvはクリア46-50・フルコン45-48。
- **`js/personalDataPage.js`**:Lv40-50 全曲データを**1秒スリープを挟みながら逐次取得**しており、
  公式サイトへの負荷配慮が明示的に実装されている(新しいLv範囲を追加する際もこの配慮を踏襲すること)。
- **`js/storage.js`**:`STORAGE_VER` 定数によるキャッシュバージョン管理。1ヶ月経過 or バージョン不一致で
  localStorage を再取得する仕組み。難易度表データ更新時は `STORAGE_VER` のインクリメントが必要になる場合がある。

## 6. 直近の変更傾向(git log より)

- 直近コミット `953512f add Google Analytics`(2026-07-20)で、`fullcomboList.js` / `poptomo.js` の
  `export default` 関数冒頭に gtag.js(`G-L4LJ7D9TB1`)読み込みを追加し、README にも利用告知を追記。
- それ以前は概ね **難易度表データ(`list/*.txt`, `img/*.jpg`)のメンテナンスと機能追加**
  (EXモード追加、HighCheers対応など)が中心で、インフラ・ビルド周りの変更はほぼ無い。

## 7. 開発時の注意点まとめ

- ビルド不要・素のJSなので、変更後は GitHub Pages でホストして実機(ブックマークレット経由)で動作確認する必要がある(`doc/how-to-develop.md` 参照)。
- 新規ファイル追加時は `GITHUB_URL` ハードコードの影響範囲(3ファイル)を意識する。
- 公式サイトへのスクレイピング処理を追加する際は `personalDataPage.js` のスリープ配慮のように、サーバー負荷を考慮すること。テスト用に `testdata.txt` が用意されている。
- Lv範囲(難易度表: クリア46-50/フルコン45-48)を拡張する場合、`img/`・`list/` に対応するファイルを追加し、`js/difficultyPage.js` の対象Lv定義も合わせて更新する必要がある。
