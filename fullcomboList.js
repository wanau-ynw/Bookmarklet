// 配信元URLは、このファイル自身がロードされたURL(import.meta.url)から自動算出する。
// これにより、リリース用(wanau-ynw)・テスト用(各自のgithub-pages)のどちらから読み込んでも
// ソースの書き換え無しで動作する。
// NOTE: 他ファイル(js/personalDataPage.js等、moduleではなく通常のscriptとして読み込まれるファイル)
//       からも参照できるよう、windowにも公開しておく
// NOTE: 一部のモバイル環境ではimport.meta.urlの取得に失敗することがある。
//       ここで例外が発生するとモジュール自体の読み込みが失敗し、ブックマークレット側に
//       .catch()が無いため無言で処理が止まってしまう。そのため失敗時はリリース用URLに
//       フォールバックする
const FALLBACK_GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet";
let GITHUB_URL;
try {
  GITHUB_URL = new URL('.', import.meta.url).href.replace(/\/$/, "");
} catch (error) {
  console.error("GITHUB_URLの自動算出に失敗したため、フォールバックURLを使用します", error);
  GITHUB_URL = FALLBACK_GITHUB_URL;
}
window.GITHUB_URL = GITHUB_URL;

// 外部jacvascriptファイルを読み込む
// NOTE: ブックマークレットで動かしているせいか、export-importを用いた
//       外部モジュールの呼び出しが使えない模様。直接ファイルを読む
// NOTE: 性質上、この関数を外部ファイルに置くことができない・・・
async function loadScript(src) {
  return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.crossOrigin = "anonymous"; // CORSを許可するための設定
      script.onload = () => resolve(src);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.head.appendChild(script);
  });
}

/**
 * CSSファイルの取り込みを行う
 * webtool.jsに置いてもいいが、iOSの遅延ロード対策に抽出しておく(効果は無いかも)
 */
async function loadCSS(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.crossOrigin = "anonymous"; // iPhone対応
    link.onload = () => resolve(href);
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });
}

// 公開用関数
// mode 0 = 機能一覧表示
// mode 1 = フルコン難易度 (デフォルト)
// mode 2 = クリア難易度
export default async (lv, mode=1) => {
  // NOTE: 従来はhead初期化・viewport再設定等がtry/catchの外にあり、ここで例外が発生すると
  //       ブックマークレット側に.catch()が無いため無言で処理が止まっていた。
  //       原因調査のため、関数全体を外側のtry/catchで囲み、必ず画面にエラーを表示するようにする
  try {
    // 初回アクセス時のみ、ヘッダに必要情報を取り込む
    document.head.innerHTML = "";
    // 公式サイトが元々設定していたviewportが消えるため、スマホでの表示崩れを防ぐために再設定する
    document.head.innerHTML += `<meta name="viewport" content="width=device-width, initial-scale=1.0">`;
    document.body.innerHTML = "初期化中・・・";
    // セッションストレージを初期化
    sessionStorage.clear();
    // アクセス解析追加
    // NOTE: innerHTMLで挿入した<script>は実行されないため、loadScriptと同様にcreateElementで挿入する
    const gtagScript = document.createElement('script');
    gtagScript.async = true;
    gtagScript.src = "https://www.googletagmanager.com/gtag/js?id=G-L4LJ7D9TB1";
    document.head.appendChild(gtagScript);
    const gtagInit = document.createElement('script');
    gtagInit.textContent = "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-L4LJ7D9TB1');";
    document.head.appendChild(gtagInit);

    // js/cssの取り込み
    try {
      await loadScript(GITHUB_URL + "/js/jquery-3.3.1.slim.min.js"); // 注意: 読み込む順番を変えてはいけない
      await loadScript(GITHUB_URL + "/js/popper.min.js");
      await loadScript(GITHUB_URL + "/js/bootstrap.min.js");
      await loadScript(GITHUB_URL + "/js/jquery.dataTables.min.js");
      await loadScript(GITHUB_URL + "/js/dataTables.bootstrap4.min.js");
      await loadScript(GITHUB_URL + "/js/Chart.bundle.min.js");
      await loadScript(GITHUB_URL + "/js/logger.js");
      await loadScript(GITHUB_URL + "/js/storage.js");
      await loadScript(GITHUB_URL + "/js/webtool.js");
      // 関数間の呼び出しを行うため、各処理は別のjsに分離して明にページに読み込む
      await loadScript(GITHUB_URL + "/js/personalDataPage.js");
      await loadScript(GITHUB_URL + "/js/difficultyPage.js");

      await loadCSS(GITHUB_URL + "/css/normalize.css");
      await loadCSS(GITHUB_URL + "/css/bootstrap.min.css");
      await loadCSS(GITHUB_URL + "/css/dataTables.bootstrap4.min.css");
      await loadCSS(GITHUB_URL + "/css/style.css");
      // メダルカウント表示用フォント
      await loadCSS("https://fonts.googleapis.com/css2?family=Varela+Round&display=swap");
    } catch (error) {
      console.error("Error loading script:", error.message);
      document.body.innerHTML = "初期化処理でエラーが発生しました " + error.message;
      return
    }

    try {
      if (mode == 0) {
        allpage();
      } else {
        main(lv, mode);
      }
    } catch (error) {
      document.body.innerHTML = "実行中にエラーが発生しました " + error.message;
      return
    }
  } catch (error) {
    console.error("Error initializing:", error);
    document.body.innerHTML = "初期化準備中にエラーが発生しました: " + (error && error.message ? error.message : String(error));
  }
};