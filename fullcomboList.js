const PLAY_DATA_URL = "https://p.eagate.573.jp/game/popn/unilab/playdata/mu_lv.html"
const MEDAL_IMAGE_URL = "https://eacache.s.konaminet.jp/game/popn/unilab/images/p/common/medal";
const GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet"
const ERROR_MEDAL_ID = 0

// 動作モード
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
  // レベルごとのページリスト。曲が増えてページ数が増えた場合に書き換えが必要
  // TODO: リファクタリング。こんなふうに列挙しなくてもいいはず。
  // TODO: 最大ページ番号の自動取得
  let pagelist
  if (lv == 49){
    pagelist = [
      [0, 49], [1, 49], [2, 49], [3, 49], [4, 49], [5, 49],
    ]
  } else if (lv == 47){
    pagelist = [
      [0, 47], [1, 47], [2, 47], [3, 47], [4, 47], [5, 47], [6, 47], [7, 47], [8, 47], [9, 47], [10, 47],
    ]
  } else {
    // 旧互換のため、そのほかの指定はすべてLv46扱いで動かす。
    pagelist = [
      [0, 46], [1, 46], [2, 46], [3, 46], [4, 46], [5, 46], [6, 46], [7, 46], [8, 46], [9, 46], [10, 46], [11, 46], [12, 46], 
    ]
  }

  const promises = pagelist.map(([page, level]) =>
    whatever(`${PLAY_DATA_URL}?page=${page}&level=${level}`)
  );

  const s = (await Promise.all(promises)).flat();
  return s
}

// フルコン難易度表CSVを読み込む
async function loadCSVData(filepath) {
  const response = await fetch(filepath);
  const text = await response.text();
  return text.trim().split('\n')
    .map(line => line.split('\t').map(x => x.trim()));
}

// 結果用メダル画像を読み込む (動作モードによってメダル種類が変わる)
function loadMedals(mode){
  let iconbasename = "icon"
  if (mode == M_CLEAR){
    iconbasename = "c_icon"
  }
  async function load(id){
      let src = GITHUB_URL + "/" + iconbasename + "/c_" + id + ".png";
      const img = new Image()
      img.src = src
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
          console.log("hit : " + (j+1) + ":" + (i+1) + " : " + "medal " + d["medal"]  + ":" + d["song"])
          ctx.drawImage(icon[d["medal"] - 1], x + dx * j, y + dy * i, iconsize, iconsize)
          break;
        };
      }
    }
  }
}

// データと対象Lvをもとに画像を作成する
// 元画像に対するメダルアイコンの描画基準位置(左上座標を指定)と、バナーの間隔を指定
async function addFullListImg(data, icon, target, x, y, dx, dy, iconsize) {
  // 難易度表データ読み込み (タブ区切り UTF-8)
  let mlist = await loadCSVData(GITHUB_URL + "/list/" + target + ".txt")
  // ベース画像を作成し、ユーザデータをもとにアイコンを張り付けていく
  var img = new Image();
  img.onload = function () {
    let c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    let ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    drawIcons(ctx, data, mlist, icon, x, y, dx, dy, iconsize)
    document.body.appendChild(c);
  };
  img.src = GITHUB_URL + "/img/" + target + ".png";
}

// 公開用関数
// mode 1 = フルコン難易度 (デフォルト)
// mode 2 = クリア難易度
export default async (lv, mode=1) => {
  let data = await wapper(lv);
  let icon = await loadMedals(mode)

  // もとのドキュメントを消し去って、ページを構築
  document.body.innerHTML = "";
  if (lv == 49 && mode == M_CLEAR) {
    await addFullListImg(data, icon, "c49", 151, 215, 334, 92, 38)
  }
  else if (lv == 46 && mode == M_FULLCOMBO) {
    await addFullListImg(data, icon, "46_2", 277, 94, 276, 87, 73)
    await addFullListImg(data, icon, "46_1", 277, 94, 276, 87, 73)
  }
  else if (lv == 47 && mode == M_FULLCOMBO) {
    await addFullListImg(data, icon, "47_2", 277, 94, 276, 87, 73)
    await addFullListImg(data, icon, "47_1", 277, 94, 276, 87, 73)
  } else {
    document.body.innerHTML = "ブックマークに登録するURLが間違っていないか確認してください";
  }
  // TODO: 画像ダウンロードボタン
};