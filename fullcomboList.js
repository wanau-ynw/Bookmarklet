const GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet"

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

// 公開用関数
// mode 0 = 機能一覧表示
// mode 1 = フルコン難易度 (デフォルト)
// mode 2 = クリア難易度
export default async (lv, mode=1) => {
  // 初回アクセス時のみ、ヘッダに必要情報を取り込む
  document.head.innerHTML = "";
  document.body.innerHTML = "初期化中・・・";
  // セッションストレージを初期化
  sessionStorage.clear();
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
  } catch (error) {
    console.error("Error loading script:", error.message);
    document.body.innerHTML = "初期化処理でエラーが発生しました " + error.message;
    return
  }

  // メダルカウント表示用フォント
  await loadCSS("https://fonts.googleapis.com/css2?family=Varela+Round&display=swap");
  
  if (mode == 0){
    allpage();
  }else{
    main(lv, mode);
  }
};