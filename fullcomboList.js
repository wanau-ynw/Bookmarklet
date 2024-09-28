const PLAY_DATA_URL = "https://p.eagate.573.jp/game/popn/jamfizz/playdata/mu_lv.html"
const MEDAL_IMAGE_URL = "https://eacache.s.konaminet.jp/game/popn/jamfizz/images/p/common/medal";
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
  return alp in MEDAL_ID ? MEDAL_ID[alp] : ERROR_MEDAL_ID;
}

// ランクのURLを元にランク番号を振る
// Note: 未クリアだとAA以上にならない仕様があるため、スコアから計算して出してはいけない
function rankurlToInt(murl) {
  const MEDAL_ID = {
    "s": 8,
    "a3": 7,
    "a2": 6,
    "a1": 5,
    "b": 4,
    "c": 3,
    "d": 2,
    "e": 1,
    "none": ERROR_MEDAL_ID,
  };
  let alp = murl.replace(`${MEDAL_IMAGE_URL}/rank_`, "").replace(".png", "")
  return alp in MEDAL_ID ? MEDAL_ID[alp] : ERROR_MEDAL_ID;
}

// 曲名の比較用に一部表記ゆれがある文字をトリム・置換する
// TODO: 表記ゆれ対応の改善 記号やカッコが半角・全角あってないケースが多い
// 既知の公式ミス？
// - Lv46 スクリーンHyに後置空白が入っている
// - jam fizzで、曲名にある～が＼に置き換わってしまっている
function songtrim(s) {
  return s.trim().replaceAll("～","").replaceAll("〜","").replaceAll("＼","");
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
  let url = `${PLAY_DATA_URL}?page=0&lv=${lv}`
  let domparser = new DOMParser();
  // ページ末尾にある改ページ用のリストから、最大ページ番号を求める
  let pagelist = await fetch(url)
    .then(resToText)
    .then((text) => domparser.parseFromString(text, "text/html"))
    .then((doc) => doc.getElementById("s_page"))
  if (!pagelist || pagelist.children.length == 0) {
    showMessage("曲一覧ページの最大数取得時にエラーが発生しました", false, true);
    return 0;
  }
  return pagelist.children.length;
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
      songtrim(li.children[0].firstElementChild.textContent),
      li.children[3].textContent.trim(),
      medalurlToInt(li.children[3].firstChild.src),
      li.children[3].children.length >= 2 ? rankurlToInt(li.children[3].children[1].src) : ERROR_MEDAL_ID,
    ])
    .map(([song, score, medal, rank]) => {
      return { song, score, medal, rank};
    });
}

// 対象の全ページに対し、データの取得を行う
async function wapper(lv) {
  const size = await getMaxLvPageNum(lv);
  let pagelist = Array.from({ length: size }, (_, i) => [i, lv]);

  const promises = pagelist.map(([page, level]) =>
    whatever(`${PLAY_DATA_URL}?page=${page}&lv=${level}`)
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
    .map(line => line.split('\t').map(x => songtrim(x)));
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

// クリアランク用メダル画像を読み込む
function loadRankMedals(){
  let iconbasename = "icon"
  async function load(id){
      let src = GITHUB_URL + "/" + iconbasename + "/s_" + id + ".png";
      const img = new Image()
      img.src = src
      img.crossOrigin = "anonymous"; // 画像ダウンロード用
      await img.decode()
      return img
  }
  let list = [1, 2, 3, 4, 5, 6, 7, 8]
  return Promise.all(list.map(id => load(id)))
}

// データをもとに、キャンバスにメダル画像を張り付けていく。
// scoreicon が設定されている場合、クリアランクも表示する (引数の仕様がわかりにくいかも)
// 返り値として、描いたクリアメダルの数の一覧を返す
function drawIcons(ctx, data, mlist, icon, scoreicon, x, y, dx, dy, iconsize) {
  console.log("draw icons")
  let drawcounts = Array(11).fill(0);
  for (let d of data) {
    if (d["medal"] == ERROR_MEDAL_ID){
      continue;
    }
    // 表データ内から曲を探す。もっといい方法がありそうだけど、せいぜい数百件のデータなので性能問題は無いでしょう
    for (let i = 0; i < mlist.length; i++) {
      for (let j = 0; j < mlist[i].length; j++) {
        if (mlist[i][j] === d["song"]) {
          // 見つかった場所に描画する。アイコンサイズは貼り付け先画像のサイズに合わせて変える
          // console.log("hit : " + (j+1) + ":" + (i+1) + " : " + "medal " + d["medal"]  + ":" + d["song"])
          ctx.drawImage(icon[d["medal"] - 1], x + dx * j, y + dy * i, iconsize, iconsize)
          drawcounts[d["medal"] - 1] ++;
          // クリアランク表示
          if (scoreicon){
            let rank = d["rank"];  
            if(rank != ERROR_MEDAL_ID){
              ctx.drawImage(scoreicon[rank - 1], x + dx * j, y + dy * i, iconsize, iconsize)
            }
          }
          break;
        };
      }
    }
  }
  return drawcounts;
}

// データをもとに、キャンバスにメダル数を記載する
// 位置などは決め打ちしている。
function drawMedalCounts(ctx, medalcounts) {
  console.log("draw medal counts")
  ctx.font = '22px "Varela Round"';
  ctx.fillStyle = '#0C2D57';
  ctx.textAlign = 'right';
  let posy = 164;
  // 配列は 0:黒丸～10:金の順番で入っているが、画像では逆順なので位置に注意
  let total = 0;
  for (let i=0;i<medalcounts.length;i++) {
    let n = medalcounts[i];
    let posx = 1710 - (98*i);
    ctx.fillText(n.toString(), posx, posy);
    total += n;
  }
  // 総計を書き込む
  ctx.textAlign = 'center';
  let posx = 1770;
  ctx.fillText("/ " + total.toString(), posx, posy);
}

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
async function createFullListImg(data, icon, scoreicon, target, ext, x, y, dx, dy, iconsize) {
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
  let drawcounts = drawIcons(ctx, data, mlist, icon, scoreicon, x, y, dx, dy, iconsize);

  // クリア難易度表の場合、メダルの数も書き込む
  // クリア難易度表かどうかの判定方法が微妙・・・
  if(target.includes("c")){
    drawMedalCounts(ctx, drawcounts);
  }

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
// hasscorerank : メダル情報にクリアランクを重ねて表示するか (TODO: 関数間を持ちまわっているが、もっといい方法がありそう。)
async function main(lv, mode, hasscorerank) {
  showMessage("プレイデータの読み込み中・・・", true);
  let data = await wapper(lv);
  if (!data || data.length == 0 || !data[0]) {
    showMessage(
      "プレイデータの読み取りに失敗しました。<br>" + 
      "公式サイトにアクセスして、データが参照できるか確認してください。", false, true);
    return;
  }
  showMessage("画像素材の読み込み中・・・", true);
  let icon = await loadMedals(mode);
  let scoreicon = null;
  if(hasscorerank){
    scoreicon =  await loadRankMedals();
  }
  showMessage("画像作成処理開始", true);

  // 一覧に戻るボタン
  let b = document.createElement('button');
  b.textContent = "一覧に戻る";
  b.addEventListener('click', async () => { await allpage(hasscorerank) });

  // 一覧表作成
  let c1 = null;
  let c2 = null;
  if (mode == M_CLEAR) {
    const targetname = "c" + lv
    c1 = await createFullListImg(data, icon, scoreicon, targetname, ".jpg", 149, 213, 334, 92, 42)
  }
  else if (lv == 46 && mode == M_FULLCOMBO) {
    c1 = await createFullListImg(data, icon, scoreicon, "46_2", ".png", 277, 94, 276, 87, 73)
    c2 = await createFullListImg(data, icon, scoreicon, "46_1", ".png", 277, 94, 276, 87, 73)
  }
  else if (lv == 47 && mode == M_FULLCOMBO) {
    c1 = await createFullListImg(data, icon, scoreicon, "47_2", ".png", 277, 94, 276, 87, 73)
    c2 = await createFullListImg(data, icon, scoreicon, "47_1", ".png", 277, 94, 276, 87, 73)
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
    b.addEventListener('click', async ()=> {
      const elements = document.getElementsByName("drawscorerank");
      await main(i, mode, (elements.length == 1 && elements[0].checked));
    });
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
  document.body.appendChild(document.createElement('br'));
}

// 現在表示できるリストの一覧を表示して選択してもらうためのページ
async function allpage(hasscorerank) {
  cleanupHTML();
  // タイトルロゴ
  let logo = document.createElement('img');
  logo.src = GITHUB_URL + "/img/popnlogo.png";
  document.body.appendChild(logo);
  document.body.appendChild(document.createElement('br'));

  // クリア難易度表
  allpage_sub(M_CLEAR, "クリア難易度表", 46, 50)
  // フルコン難易度表
  allpage_sub(M_FULLCOMBO, "フルコン難易度表", 46, 47)

  // オプション
  let t = document.createElement('h2');
  t.textContent = "オプション";
  document.body.appendChild(t);
  let optiondiv = document.createElement('div');
  optiondiv.className = "toggle-area";
  // クリアランクメダル表示切り替えスイッチ
  let srankcheck = document.createElement('input');
  srankcheck.type = "checkbox";
  srankcheck.id = "iddrawscorerank";
  srankcheck.name = "drawscorerank";
  srankcheck.checked = hasscorerank;
  let sranklabel = document.createElement('label');
  sranklabel.htmlFor = "iddrawscorerank";
  sranklabel.innerText = "クリアランク表示";
  optiondiv.appendChild(srankcheck);
  optiondiv.appendChild(sranklabel);
  document.body.appendChild(optiondiv);

  // フッター
  document.body.appendChild(document.createElement('br'));
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
export default async (lv, mode=1, hasscorerank=false) => {
  // 初回アクセス時のみ、cssを取り込む
  cleanupHTML();
  document.head.innerHTML = "";
  await loadCSS(GITHUB_URL + "/css/normalize.css");
  await loadCSS(GITHUB_URL + "/css/style.css");
  // メダルカウント表示用フォント
  await loadCSS("https://fonts.googleapis.com/css2?family=Varela+Round&display=swap");

  if (mode == M_ALL){
    allpage(hasscorerank);
  }else{
    main(lv, mode, hasscorerank);
  }
};