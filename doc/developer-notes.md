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
├── list/                         難易度表の曲名配置データ(c46~c50.txt, f45~f48.txt、タブ区切り)
└── tools/
    ├── compress-images.ps1       難易度表ベース画像(img/c*.jpg, f*.jpg)の再圧縮スクリプト
    └── compress-images.bat       上記をbatから実行するためのラッパー
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

- ~~**`GITHUB_URL` のハードコード**~~:**解消済み**。以前は配信元URLが `fullcomboList.js`、`poptomo.js`、
  `js/personalDataPage.js` の複数箇所に直書きされており、テスト環境(`ynws`)とリリース環境(`wanau-ynw`)を
  切り替えるたびに手動書き換えが必要だった(issue #17)。
  現在は `fullcomboList.js` / `poptomo.js` が **自身のロード元URL(`import.meta.url`)から `GITHUB_URL` を自動算出**する。
  - `fullcomboList.js` は算出した値を `window.GITHUB_URL` としても公開し、`js/personalDataPage.js`・
    `js/difficultyPage.js`(モジュールではなく通常の `<script>` として読み込まれるため `import.meta` を使えない)
    はこのグローバル変数を参照する。
  - `poptomo.js` は単一ファイル完結のため、モジュールスコープの `GITHUB_URL` のみで完結する。
  - この結果、テスト時はブックマークレットの `import()` 先URLを自分のgithub-pagesに向けるだけでよく、
    ソースの書き換えは不要になった。
  - 一部のモバイル環境で`import.meta.url`の取得に失敗するケースが確認されたため、失敗時は
    リリース用URL(`https://wanau-ynw.github.io/Bookmarklet`)にフォールバックする処理を追加している。
- **`js/webtool.js` 内の `loadImage` 関数重複定義**:同名関数が2回定義されており、後者が前者を上書きする形になっている。意図した挙動か要確認。
- git remoteの`origin`は`https://github.com/ynws/Bookmarklet`(ソースリポジトリ)。GitHub Pages配信元は
  リリース用が`wanau-ynw`、テスト用が`ynws`のアカウントとなっている。

## 5. 主要ロジックのポイント

- **`js/webtool.js`**:公式サイトの HTML をスクレイピングする共通処理。文字コード判定(Shift_JIS/UTF-8)、
  メダル/ランク画像URL→ID変換テーブル、アイコン画像のプリロードなどを担う。すべてのツールの土台。
- **`js/difficultyPage.js`**:`list/*.txt` の曲名配置マトリクスと `img/c*.jpg`・`img/f*.jpg` のベース画像を
  突合し、Canvas 上にメダル/ランクアイコンを重ね描画。対応Lvはクリア46-50・フルコン45-48。
- **`js/personalDataPage.js`**:Lv40-50 全曲データを取得する。公式サイトへの負荷配慮として、
  1件ずつの完全逐次ではなく`PERSONAL_FETCH_BATCH_SIZE`(既定4)ページずつまとめて並列取得し、
  バッチ間に`PERSONAL_FETCH_BATCH_INTERVAL_MS`(既定500ms)だけ待機する。単一バーストで大量の
  同時リクエストを送らないことが目的で、完全な逐次実行が必須という訳ではない。新しいLv範囲を
  追加する際もこの配慮(バッチ化+待機)を踏襲すること。
- **`js/storage.js`**:`STORAGE_VER` 定数によるキャッシュバージョン管理。1ヶ月経過 or バージョン不一致で
  localStorage を再取得する仕組み。難易度表データ更新時は `STORAGE_VER` のインクリメントが必要になる場合がある。

### 難易度表ベース画像のファイルサイズ

`img/c46.jpg`(1840x6179px, 約8.4MB)など、難易度表ベース画像は解像度の割にファイルサイズが大きく、
生成のたびにこれをダウンロード・デコード・Canvas再エンコードするため、体感速度・通信量・端末メモリ負荷の面で
ユーザーへの悪影響がある。ピクセルサイズは`js/difficultyPage.js`の描画座標(アイコン貼り付け位置)に
直結しているため変更できないが、**JPEG圧縮品質のみを下げてファイル容量を圧縮**することは可能。

`tools/compress-images.ps1`(`tools/compress-images.bat`からも実行可)で、ピクセルサイズを変えずに
再圧縮できる。画像を新しく受け取って`img/`配下を更新した際は、コミット前に実行すること。
実行結果(各ファイルの圧縮前後サイズ・削減率のサマリ)はbat実行後もコンソールに表示されたままになる(`pause`で待機)。

```
tools\compress-images.bat
tools\compress-images.bat -Quality 80   -- 品質を指定する場合(デフォルトは92)
```

内部的には.NET(`System.Drawing`)のJPEGエンコーダを使用しており、追加のツールインストールは不要。
圧縮後に元画像とピクセルサイズが変わっていないことをスクリプト内で検証し、変わっていた場合は
エラーで中断する(描画ロジックへの影響を防ぐため)。

JPEGは非可逆圧縮のため、同じファイルに何度も実行すると再エンコードのたびに画質が劣化していく。
これを避けるため、圧縮後のファイルハッシュを`tools/.compress-state.json`に記録し、
前回実行時から内容が変わっていないファイルは自動的にスキップする(このファイルもコミット対象)。
意図的に再圧縮したい場合のみ`-Force`オプションを付ける。

## 6. 直近の変更傾向(git log より)

- 直近コミット `953512f add Google Analytics`(2026-07-20)で、`fullcomboList.js` / `poptomo.js` の
  `export default` 関数冒頭に gtag.js(`G-L4LJ7D9TB1`)読み込みを追加し、README にも利用告知を追記。
- それ以前は概ね **難易度表データ(`list/*.txt`, `img/*.jpg`)のメンテナンスと機能追加**
  (EXモード追加、HighCheers対応など)が中心で、インフラ・ビルド周りの変更はほぼ無い。

## 7. 開発時の注意点まとめ

- ビルド不要・素のJSなので、変更後は GitHub Pages でホストして実機(ブックマークレット経由)で動作確認する必要がある(`doc/how-to-develop.md` 参照)。
- `GITHUB_URL` は自動算出されるため、新規ファイル追加時に配信元URLを意識する必要はない。ただし
  `js/personalDataPage.js` や `js/difficultyPage.js` のような非moduleスクリプトを新設する場合、
  `import.meta.url` は使えないので `window.GITHUB_URL`(`fullcomboList.js`が設定)を参照すること。
- 公式サイトへのスクレイピング処理を追加する際は `personalDataPage.js` のスリープ配慮のように、サーバー負荷を考慮すること。テスト用に `testdata.txt` が用意されている。
- Lv範囲(難易度表: クリア46-50/フルコン45-48)を拡張する場合、`img/`・`list/` に対応するファイルを追加し、`js/difficultyPage.js` の対象Lv定義も合わせて更新する必要がある。
