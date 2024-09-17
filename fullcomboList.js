const PLAY_DATA_URL = "https://p.eagate.573.jp/game/popn/unilab/playdata/mu_lv.html"
const MEDAL_IMAGE_URL = "https://eacache.s.konaminet.jp/game/popn/unilab/images/p/common/medal";
const GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet"
const ERROR_MEDAL_ID = 0

// 動作モード
const M_ALL = 0
const M_FULLCOMBO = 1
const M_CLEAR = 2

// 取得したHTMLの文字コードを整える
function resToText(res) {
  return res.arrayBuffer().then((buffer) => {
    if (res.headers.get("Content-Type").includes("UTF-8")) {
      return new TextDecoder().decode(buffer);
    } else {
      return new TextDecoder("Shift_JIS").decode(buffer)
    }
  })
}

// メダルのURLを元にメダル番号を振る
function medalurlToInt(murl) {
  const MEDAL_ID = {
    "a": 11,
    "b": 10,
    "c": 9,
    "d": 8,
    "e": 7,
    "f": 6,
    "g": 5,
    "h": 3,
    "i": 2,
    "j": 1,
    "k": 4,
    "none": ERROR_MEDAL_ID,
  };
  let alp = murl.replace(`${MEDAL_IMAGE_URL}/meda_`, "").replace(".png", "")
  return MEDAL_ID[alp]
}

// 画面上に文字を表示する
async function showMessage(txt, clean = false, error = false) {
  if (clean) {
    cleanupHTML();
  }
  let html = "";
  if (error){
    html += '<div class="errormsg">';
  }
  html += txt;
  if (error){
    html += '</div">';
  }
  html += "<br>";
  document.body.innerHTML += html;
}

// 画面を消去する
async function cleanupHTML() {
  document.body.innerHTML = "";
}

// 特定のLv曲一覧が、何ページあるか調べる
async function getMaxLvPageNum(lv) {
  let url = `${PLAY_DATA_URL}?page=0&level=${lv}`
  let htmltxt = await fetch(url).then(resToText);
  // ページ末尾にある改ページ用のURLを抽出し、最大ページ番号を求める
  const pattern = /mu_lv.html\?page=(\d+)/g;
  let match;
  let maxNumber = -Infinity;
  while ((match = pattern.exec(htmltxt)) !== null) {
    const number = parseInt(match[1], 10);
    if (number > maxNumber) {
      maxNumber = number;
    }
  }
  if (maxNumber === -Infinity) {
    showMessage("曲一覧ページの最大数取得時にエラーが発生しました", false, true);
    return 0;
  }
  // リンクのページ番号は0から始まっているので、ページ数はそれに+1する
  return maxNumber + 1;
}

// URLを読み込み、そのページ内の全データを返す
async function whatever(url) {
  console.log("load url : " + url)
  let domparser = new DOMParser();
  // スコア情報テーブルを探す
  let tables = await fetch(url)
    .then(resToText)
    .then((text) => domparser.parseFromString(text, "text/html"))
    .then((doc) => doc.querySelectorAll(".mu_list_table"))

  if (tables.length != 1) {
    console.log("table not found : " + url)
    showMessage("プレイデータ読み込み時にエラーが発生しました", false, true);
    return
  }
  let tableRows = tables[0].querySelectorAll("li")

  // テーブルの各列から保存したい要素を抽出する。
  return Array.from(tableRows)
    .filter((li) => li.firstElementChild.className === "col_music_lv")  // 曲データだけ抽出
    .map((li) => [
      li.children[0].firstElementChild.textContent,
      li.children[3].textContent.trim(),
      medalurlToInt(li.children[3].firstChild.src),
    ])
    .map(([song, score, medal]) => {
      return { song, score, medal, };
    });
}

// 対象の全ページに対し、データの取得を行う
async function wapper(lv) {
  const size = await getMaxLvPageNum(lv);
  let pagelist = Array.from({ length: size }, (_, i) => [i, lv]);

  const promises = pagelist.map(([page, level]) =>
    whatever(`${PLAY_DATA_URL}?page=${page}&level=${level}`)
  );

  const s = (await Promise.all(promises)).flat();

  // Lv50 特別処理。ポパクロ通常版とUPPERの区別がつかないので、力技で書き換え。先に取得したほうが通常版。
  // TODO: おそらく、将来的に通常版とUPPERの間にページ区切りが入った場合にうまく動かなくなる。正式な対応が必要。
  if (lv == 50){
    for (let i = 0; i < s.length; i++) {
      if(s[i]["song"] == "Popperz Chronicle"){
        s[i]["song"] = "Popperz Chronicle A"
        break
      }
    }
  }
  return s
}

// フルコン難易度表CSVを読み込む
async function loadCSVData(filepath) {
  const response = await fetch(filepath);
  const text = await response.text();
  return text.trim().split('\n')
    .map(line => line.split('\t').map(x => x.trim()));
}

// 結果用メダル画像を読み込む (動作モードによってメダル画像の種類を変えている)
function loadMedals(mode){
  let iconbasename = "icon"
  if (mode == M_CLEAR){
    iconbasename = "c_icon"
  }
  async function load(id){
      let src = GITHUB_URL + "/" + iconbasename + "/c_" + id + ".png";
      const img = new Image()
      img.src = src
      img.crossOrigin = "anonymous"; // 画像ダウンロード用
      await img.decode()
      return img
  }
  let list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  return Promise.all(list.map(id => load(id)))
}

function drawIcons(ctx, data, mlist, icon, x, y, dx, dy, iconsize) {
  console.log("draw icons")
  for (let d of data) {
    if (d["medal"] == ERROR_MEDAL_ID){
      continue;
    }
    // 表データ内から曲を探す。もっといい方法がありそうだけど、せいぜい数百件のデータなので性能問題は無いでしょう
    for (let i = 0; i < mlist.length; i++) {
      for (let j = 0; j < mlist[i].length; j++) {
        // TODO:
        // 曲名の比較、公式サイト上の表記ゆれに対応したほうがいいかも。
        // 難易度表を自分で書いた時の表記とずれてHitしないトラブルあり。
        // 記号やカッコが半角・全角あってないケースが多い
        // とりあえず、Lv46 スクリーンHyに後置空白が入っていることが分かったので、比較前にトリムだけはかけておく
        if (mlist[i][j] === d["song"].trim()) {
          // 見つかった場所に描画する。アイコンサイズは貼り付け先画像のサイズに合わせて変える
          // console.log("hit : " + (j+1) + ":" + (i+1) + " : " + "medal " + d["medal"]  + ":" + d["song"])
          ctx.drawImage(icon[d["medal"] - 1], x + dx * j, y + dy * i, iconsize, iconsize)
          break;
        };
      }
    }
  }
}

async function loadCSS(href) {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.onload = () => resolve(href);
    link.onerror = () => reject(new Error(`Failed to load CSS: ${href}`));
    document.head.appendChild(link);
  });
}

async function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
    img.crossOrigin = "anonymous"; // 画像ダウンロード用
  });
}

// データと対象Lvをもとに画像を作成する
// 元画像に対するメダルアイコンの描画基準位置(左上座標を指定)と、バナーの間隔を指定
async function createFullListImg(data, icon, target, ext, x, y, dx, dy, iconsize) {
  // 難易度表データ読み込み (タブ区切り UTF-8)
  showMessage("難易度表読み込み中・・・", true);
  let mlist = await loadCSVData(GITHUB_URL + "/list/" + target + ".txt")
  showMessage("画像作成中・・・", true);
  // ベース画像を作成し、ユーザデータをもとにアイコンを張り付けていく
  const img = await loadImage(GITHUB_URL + "/img/" + target + ext);
  let c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  let ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  drawIcons(ctx, data, mlist, icon, x, y, dx, dy, iconsize);

  // canvasから画像を作成し、img要素を生成する
  showMessage("画像の変換中・・・", true);
  const imgElement = document.createElement('img');
  imgElement.src = c.toDataURL('image/png');
  return imgElement;
}

// 画像ダウンロード用のファイル名を作成する
function makeImgName(lv, mode, id) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  let modestr = (mode == M_FULLCOMBO ? "fullcombo" : "clear");
  
  return `${year}${month}${day}_${lv}_${modestr}${id}.png`;
}

// キャンバスの画像をダウンロードするボタンを追加する
// 画像が複数あった時のために、id 引数で識別子を付ける。ただし、画像が1つの場合は空文字が渡される
async function appendImgDLbtn(img, lv, mode, id) {
  let filename = makeImgName(lv, mode, id);
  const button = document.createElement('button');
  button.textContent = 'Download' + id;
  
  button.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = img.src;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
  document.body.appendChild(button);
}

// メイン処理。レベルと動作モードを指定して一覧表を出力する
async function main(lv, mode) {
  showMessage("プレイデータの読み込み中・・・", true);
  let data = await wapper(lv);
  if (!data || data.length == 0 || !data[0]) {
    showMessage(
      "プレイデータの読み取りに失敗しました。<br>" + 
      "公式サイトにアクセスして、データが参照できるか確認してください。", false, true);
    return;
  }
  showMessage("画像素材の読み込み中・・・", true);
  let icon = await loadMedals(mode)
  showMessage("画像作成処理開始", true);

  // 一覧に戻るボタン
  let b = document.createElement('button');
  b.textContent = "一覧に戻る";
  b.addEventListener('click', async () => { await allpage() });

  // 一覧表作成
  let c1 = null;
  let c2 = null;
  if (mode == M_CLEAR) {
    const targetname = "c" + lv
    c1 = await createFullListImg(data, icon, targetname, ".jpg", 149, 213, 334, 92, 42)
  }
  else if (lv == 46 && mode == M_FULLCOMBO) {
    c1 = await createFullListImg(data, icon, "46_2", ".png", 277, 94, 276, 87, 73)
    c2 = await createFullListImg(data, icon, "46_1", ".png", 277, 94, 276, 87, 73)
  }
  else if (lv == 47 && mode == M_FULLCOMBO) {
    c1 = await createFullListImg(data, icon, "47_2", ".png", 277, 94, 276, 87, 73)
    c2 = await createFullListImg(data, icon, "47_1", ".png", 277, 94, 276, 87, 73)
  } else {
    showMessage("動作エラーです。ブックマークに登録するURLが間違っていないか確認してください", false, true);
    return;
  }

  // もとのドキュメントを消し去って、ページを構築
  cleanupHTML();
  document.body.appendChild(b);
  if(c1)await appendImgDLbtn(c1, lv, mode, (c2?"-1":"")); // 画像が2つあるなら、区別するためのidを追加しておく
  if(c2)await appendImgDLbtn(c2, lv, mode, "-2");
  document.body.appendChild(document.createElement('br'));
  if(c1)document.body.appendChild(c1);
  if(c2)document.body.appendChild(c2);
}

// 現在表示できるリストの一覧を表示して選択してもらうためのページ部品。
// 動作モードやタイトルを指定することで、フルコン用とクリア用の処理を共通化
async function allpage_sub(mode, title, minlv, maxlv) {
  // タイトル
  let t = document.createElement('h2');
  t.textContent = title;
  document.body.appendChild(t);
  // 全体を囲むdiv要素
  let maindiv = document.createElement('div');
  maindiv.className = "button-container";
  // TODO: ブックマーク用のURLをクリップボードに貼る機能？READMEと重複するので別にいいか
  for (let i = minlv; i <= maxlv; i++) {
    // 各要素を囲むdiv
    let subdiv = document.createElement('div');
    // 機能ボタン
    let b = document.createElement('button');
    b.textContent = "Lv" + i;
    b.addEventListener('click', async ()=> {await main(i, mode)});
    // ボタン更新日 (仮)
    // let p = document.createElement('p');
    // p.textContent = "yyyy/mm/dd更新"
    // 各要素を画面に追加
    subdiv.appendChild(b);
    // subdiv.appendChild(p);
    maindiv.appendChild(subdiv);
  }
  document.body.appendChild(maindiv);
  document.body.appendChild(document.createElement('br'));
}

// 現在表示できるリストの一覧を表示して選択してもらうためのページ
async function allpage() {
  cleanupHTML();
  // タイトルロゴ
  let logo = document.createElement('img');
  logo.src = GITHUB_URL + "/img/popnlogo.png";
  document.body.appendChild(logo);
  document.body.appendChild(document.createElement('br'));

  // クリア難易度表
  allpage_sub(M_CLEAR, "クリア難易度表", 47, 50)

  document.body.appendChild(document.createElement('br'));

  // フルコン難易度表
  allpage_sub(M_FULLCOMBO, "フルコン難易度表", 46, 47)

  // フッター
  let footer = document.createElement('footer');
  let help = document.createElement('a');
  help.innerText = "ヘルプ(README)";
  help.href = GITHUB_URL;
  let copyright = document.createElement('p');
  copyright.innerText = "製作者: @PopnYnw / クリア難易度表: @kotatsu_popn / フルコン難易度表: @meumeuptt";
  footer.appendChild(help);
  footer.appendChild(copyright);
  document.body.appendChild(footer);
}

// 公開用関数
// mode 0 = 機能一覧表示
// mode 1 = フルコン難易度 (デフォルト)
// mode 2 = クリア難易度
export default async (lv, mode=1) => {
  // 初回アクセス時のみ、cssを取り込む
  cleanupHTML();
  document.head.innerHTML = "";
  await loadCSS(GITHUB_URL + "/css/normalize.css");
  await loadCSS(GITHUB_URL + "/css/style.css");

  if (mode == M_ALL){
    allpage();
  }else{
    main(lv, mode);
  }
};