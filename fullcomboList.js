const PLAY_DATA_URL = "https://p.eagate.573.jp/game/popn/jamfizz/playdata/mu_lv.html"
// const GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet"
const GITHUB_URL = "https://ynws.github.io/Bookmarklet"

const STORAGE_KEY = {
    LV_DATA: (lv) => `mydata_${lv}`,
    PERSONAL_DATA: "personal_data",
    HAS_SCORE_RANK: "has_score_rank",
    GRAPH_MODE_PERCENT: "graph_mode_percent",
}


// 動作モード
const M_ALL = 0
const M_FULLCOMBO = 1
const M_CLEAR = 2

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
      parseInt(li.children[3].textContent.trim()),
      medalurlToInt(li.children[3].firstChild.src),
      li.children[3].children.length >= 2 ? rankurlToInt(li.children[3].children[1].src) : getErrorMedalID(),
    ])
    .map(([song, score, medal, rank]) => {
      return { song, score, medal, rank};
    });
}

// 対象の全ページに対し、データの取得を行う
async function wapper(lv) {
  const size = await getMaxLvPageNum(`${PLAY_DATA_URL}?page=0&lv=${lv}`);
  if (size == -1){
    showMessage("曲一覧ページの最大数取得時にエラーが発生しました", false, true);
    return null;
  }
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 個人データ参照のため、特定のレベル範囲の曲をすべて取得する。
// 公式サイト負荷軽減のため、並列処理は行わずにゆっくり取得
async function wapper_personal() {
  await showMessage("注意：");
  await showMessage("公式サイトに負荷をかけないように、データ取得速度に制限をかけています");
  await showMessage("すべてのデータを取得するのに２分くらいかかるので、ゆっくりお待ちください");
  await showMessage("※取得したデータはデバイス上に保管するので、今後のアクセスはここまで時間かかりません");
  const s = [];
  for (let lv = 40; lv <= 50; lv++) {
    await showMessage(`Lv${lv} データ取得開始`);
    const size = await getMaxLvPageNum(`${PLAY_DATA_URL}?page=0&lv=${lv}`);
    if (size == -1) {
      await showMessage("曲一覧ページの最大数取得時にエラーが発生しました", false, true);
      return null;
    }

    let pagelist = Array.from({ length: size }, (_, i) => [i, lv]);
    let results = [];
    await showMessage(`Lv${lv} 0/${size}`);
    for (let [page, level] of pagelist) {
      const result = await whatever(`${PLAY_DATA_URL}?page=${page}&lv=${level}`);
      results.push(...result); // 配列の要素を展開してpush
      await replaceLastMessage(`Lv${lv} ${page+1}/${size}`);
      await sleep(1000);
    }
    s.push({lv: lv, data: results});
    await deleteLastMessage();
    await replaceLastMessage(`Lv${lv} データ取得完了`);
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

// データをもとに、キャンバスにメダル画像を張り付けていく。
// scoreicon が設定されている場合、クリアランクも表示する (引数の仕様がわかりにくいかも)
// 返り値として、描いたクリアメダルの数の一覧を返す
function drawIcons(ctx, data, mlist, icon, scoreicon, x, y, dx, dy, iconsize) {
  console.log("draw icons")
  let drawcounts = Array(11).fill(0);
  for (let d of data) {
    if (isErrorMedalID(d["medal"])){
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
            if (!isErrorMedalID(rank)) {
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
async function main(lv, mode) {
  showMessage("プレイデータの読み込み中・・・", true);
  let data = await getSessionStorage(STORAGE_KEY.LV_DATA(lv), () => wapper(lv));
  if (!data || data.length == 0 || !data[0]) {
    showMessage(
      "プレイデータの読み取りに失敗しました。<br>" + 
      "公式サイトにアクセスして、データが参照できるか確認してください。", false, true);
    return;
  }
  showMessage("画像素材の読み込み中・・・", true);
  let icon = await loadMedals(GITHUB_URL, mode == M_FULLCOMBO); // フルコンボ表の時はメダル画像に縁取りを付ける
  let scoreicon = null;
  if (await getSessionStorage(STORAGE_KEY.HAS_SCORE_RANK, () => false)) {
    scoreicon =  await loadRankMedals(GITHUB_URL);
  }
  showMessage("画像作成処理開始", true);

  // 一覧に戻るボタン
  let b = document.createElement('button');
  b.textContent = "一覧に戻る";
  b.addEventListener('click', async () => { await allpage() });

  // 一覧表作成
  let c1 = null;
  if (mode == M_CLEAR) {
    const targetname = "c" + lv;
    c1 = await createFullListImg(data, icon, scoreicon, targetname, ".jpg", 149, 213, 334, 92, 42)
  }
  else if (mode == M_FULLCOMBO) {
    const targetname = "f" + lv;
    c1 = await createFullListImg(data, icon, scoreicon, targetname, ".jpg", 277, 94, 276, 87, 73)
  } else {
    showMessage("動作エラーです。ブックマークに登録するURLが間違っていないか確認してください", false, true);
    return;
  }

  // もとのドキュメントを消し去って、ページを構築
  cleanupHTML();
  document.body.appendChild(b);
  if(c1)await appendImgDLbtn(c1, lv, mode, "");
  document.body.appendChild(document.createElement('br'));
  if(c1)document.body.appendChild(c1);
}

// 個人プレイデータから統計情報を計算する
function calcPersonalData(data) {
  let lvSongCount = {};
  let lvPlayCount = {};
  let lvScoreSum = {};
  let lvScoreAve = {};
  let lvMedalCount = {};
  let lvRankCount = {};

  data.forEach(lvdata => {
    let lv = lvdata.lv;
    lvSongCount[lv] = lvdata.data.length;
    lvPlayCount[lv] = 0;
    lvScoreSum[lv] = 0;
    lvMedalCount[lv] = Array(11+1).fill(0);
    lvRankCount[lv] = Array(8+1).fill(0);

    lvdata.data.forEach(d => {
      // 未プレイ曲スキップ
      if(d.score === 0){
        return;
      }
      lvPlayCount[lv] ++;
      lvScoreSum[lv] += d.score;
      lvMedalCount[lv][d.medal] ++;
      lvRankCount[lv][d.rank] ++;
    });
    lvScoreAve[lv] = (lvPlayCount[lv] > 0 ? (lvScoreSum[lv] / lvPlayCount[lv]) : 0);

  });
  return {
    lvSongCount,
    lvPlayCount,
    lvScoreAve,
    lvMedalCount,
    lvRankCount,
  };
}

// メダル一覧グラフ描画用のキャンバスをHTMLに追加する
function appendGraphBase(title, id) {
  let t = document.createElement('h2');
  t.textContent = title;
  document.body.appendChild(t);

  let c = document.createElement('canvas');
  c.id = `${id}graph`;
  c.width = 640;
  c.height = 400;
  c.style = "width:640; height:400;";
  document.body.appendChild(c);
}

// グラフの再描画
async function refreshGraphImage(target, calcdata) {
  let labels = ["黒●", "黒◆", "黒★", "緑●", "銅●", "銅◆", "銅★", "銀〇", "銀◇", "銀☆", "金☆"];
  let colors = ["#000000", "#202020", "#404040", "#00a000", "#6E2A13", "#8E4A33", "#aE6A53", "#808080", "#a0a0a0", "#c0c0c0", "#c0c000"];
  let data = calcdata.lvMedalCount;
  if (target === "rank") {
    labels = ["E", "D", "C", "B", "A", "AA", "AAA", "S"];
    colors = ["#71588f", "#4198af", "#89a54e", "#db843d", "#f8b1df", "#ef637e", "#da163e", "#c0c000"];
    data = calcdata.lvRankCount;
  }
  let percentMode = await getSessionStorage(STORAGE_KEY.GRAPH_MODE_PERCENT, () => false);

  // スクリプトの追加
  let scriptInnerHTML = `
    option = {
        scales: {
            xAxes: [{
                stacked: true,
                categoryPercentage:1.2
            }],
            yAxes: [{
                id: "medalY",
                position: "right",
                stacked: true,
                ${ percentMode ? "ticks: {min: 0, max: 100}," : "" }
            },
            {
                id: "scoreY",
                position: "left",
            }]
        },
        responsive: false,
        maintainAspectRatio: false,
        legend: {
            labels: {
                boxWidth:30,
                padding:20
            },
            display: true
        },
        tooltips:{
            mode:'label',
            itemSort: function(a, b) { return b.datasetIndex - a.datasetIndex},
            ${ percentMode ? `callbacks: {
                label: function(tooltipItem, data) {
                    const dataset = data.datasets[tooltipItem.datasetIndex];
                    if(dataset.label === 'score'){return dataset.label + ': ' + dataset.data[tooltipItem.index];}
                    return dataset.label + ': ' + dataset.rawdata[tooltipItem.index] + ' (' + dataset.data[tooltipItem.index].toFixed(1) + '%)';
                }
            }` : ""}
        }
    }
    if (myChart${target}) {
      myChart${target}.destroy();
    }
    var lv_labels = ["Lv40","Lv41", "Lv42", "Lv43", "Lv44", "Lv45", "Lv46", "Lv47", "Lv48", "Lv49", "Lv50"];
    var ctx = document.getElementById("${target}graph");
    var myChart${target} = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: lv_labels,
            datasets: [
                {
                label: 'score',
                type: 'line',
                lineTension: 0,
                borderColor: "rgba(40,40,40,0.8)",
                pointBackgroundColor: "rgba(40,40,40,0.8)",
                fill: false,
                yAxisID: 'scoreY',
                data: [`
  for (const key in calcdata.lvScoreAve) {
    scriptInnerHTML += `${calcdata.lvScoreAve[key].toFixed(1)}, `;
  }
  scriptInnerHTML += `
                ]
                },
                `
  for (let i = 0; i < labels.length; i++) {
    scriptInnerHTML += `
                {
                label: '${labels[i]}',
                borderWidth:1,
                backgroundColor: '${colors[i]}',
                borderColor: '${colors[i]}',
                yAxisID: 'medalY',
                data: [`
    for (const key in data) {
      // メダル数の配列は、[0]にエラーメダル番号が入っているので[1]から。
      // lvPlayCountは 0 かもしれないので、割り算できるように0なら1にしておく
      scriptInnerHTML += `${percentMode ? (data[key][i + 1]*100 / (calcdata.lvPlayCount[key] || 1)) : data[key][i + 1]},`
    }
    scriptInnerHTML += `],
                rawdata: [`
    for (const key in data) {
      scriptInnerHTML += `${data[key][i + 1]},`
    }
    scriptInnerHTML += `]
                },`
  }
  scriptInnerHTML += `
            ]
        },
        options: option
    });
  `
  addScript(`dynamic-${target}-graph`, scriptInnerHTML);
}

function makeTd(txt) {
  const td = document.createElement("td");
  td.textContent = txt;
  return td;
}

// メダル数テーブルを作成する
// テーブルヘッダにはメダル画像を利用するので、そのベースとなるURLを引数に与える
function createDataTable(title, idbase, headbase, data, colLen, songcount){
  // ボタンで表示切り替えする対象
  const hideitemsdiv = document.createElement("div");
  hideitemsdiv.id = idbase + "-table";
  hideitemsdiv.className = "collapse hideitems";

  let t = document.createElement('h2');
  t.textContent = title;
  hideitemsdiv.appendChild(t);

  const table = document.createElement("table");
  table.className ="table medal-table table-striped table-bordered table-sm col-md-8 col-sm-12";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = [""];
  for (let i = colLen; i > 0; i--) {
    headers.push(`<img src="${headbase}${i}.png" height="32px" _pageexpand_="32"></img>`);
  } 
  headers.push("合計");
  headers.push("メダルなし");

  headers.forEach(headerText => {
    const th = document.createElement("th");
    th.innerHTML = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  // 各列の合計を保持する配列
  const columnTotals = new Array(colLen).fill(0);
  let grandTotal = 0; // 全体の合計
  let nomedalTotal = 0; // メダルがない曲の合計

  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const row = document.createElement("tr");
      let rowtotal = 0;

      // 最初のセルはキーの値(Lv)
      row.appendChild(makeTd(`Lv${key}`));

      // 値の配列をループしてセルを追加(最初のデータはエラーメダルデータ数なのでスキップする)
      data[key].slice(1).reverse().forEach((value, index) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        if(value === 0){
          cell.style = "color:#999999"  // 値が0のセルはグレーにして目立たせなくする
        }
        rowtotal += value;
        columnTotals[index] += value;
        row.appendChild(cell);
      });
      // カラム合計を表示
      row.appendChild(makeTd(rowtotal));
      // メダルがない曲数
      row.appendChild(makeTd(songcount[key] - rowtotal));
      nomedalTotal += songcount[key] - rowtotal;

      tbody.appendChild(row);
      grandTotal += rowtotal;
    }
  }
  // 最後に、合計行を追加
  const totalRow = document.createElement("tr");
  totalRow.appendChild(makeTd("合計"));

  // 各列の合計をセルに追加
  columnTotals.forEach(columnTotal => {
    totalRow.appendChild(makeTd(columnTotal));
  });
  totalRow.appendChild(makeTd(grandTotal));
  totalRow.appendChild(makeTd(nomedalTotal));

  tbody.appendChild(totalRow);
  table.appendChild(tbody);
  hideitemsdiv.appendChild(table);
  document.body.appendChild(hideitemsdiv);
  document.body.appendChild(document.createElement('br'));
}

// スコアテーブルを作成する
function createScoreTable(scores, plays){
  // ボタンで表示切り替えする対象
  const hideitemsdiv = document.createElement("div");
  hideitemsdiv.id = "score-table";
  hideitemsdiv.className = "collapse hideitems";

  let t = document.createElement('h2');
  t.textContent = "平均スコア";
  hideitemsdiv.appendChild(t);

  const table = document.createElement("table");
  table.className ="table score-table table-striped table-bordered table-sm col-md-5";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const headers = ["", "平均スコア", "対象曲数"];

  headers.forEach(headerText => {
    const th = document.createElement("th");
    th.innerHTML = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  let grandTotal = 0; // 全体の合計
  let totalDivNum = 0;

  for (const key in scores) {
    if (scores.hasOwnProperty(key)) {
      const row = document.createElement("tr");

      row.appendChild(makeTd(`Lv${key}`));
      row.appendChild(makeTd(scores[key].toFixed(1)));
      row.appendChild(makeTd(plays[key]));

      tbody.appendChild(row);
      grandTotal += scores[key] * plays[key];
      totalDivNum += plays[key];
    }
  }
  // 最後に、合計行を追加
  const totalRow = document.createElement("tr");
  totalRow.appendChild(makeTd("全体"));
  totalRow.appendChild(makeTd((grandTotal/totalDivNum).toFixed(1)));
  totalRow.appendChild(makeTd(totalDivNum));

  tbody.appendChild(totalRow);
  table.appendChild(tbody);

  hideitemsdiv.appendChild(table);
  document.body.appendChild(hideitemsdiv);
  document.body.appendChild(document.createElement('br'));
}

// 個人情報表ページの最上部ボタン群
function addPersonalDatapageTopButton(calcdata) {
  let btnClass = "btn btn-primary mr-4";
  // 一覧に戻るボタン
  let backbtn = document.createElement('button');
  backbtn.className = btnClass;
  backbtn.textContent = "一覧に戻る";
  backbtn.addEventListener('click', async () => { await allpage() });
  document.body.appendChild(backbtn);

  // グラフの描画モード切替
  let graphModeSwitch = document.createElement('button');
  graphModeSwitch.className = btnClass;
  graphModeSwitch.innerText = "曲数グラフ/割合グラフ";
  graphModeSwitch.addEventListener('click', async () => {
    let before = await getSessionStorage(STORAGE_KEY.GRAPH_MODE_PERCENT, () => false);
    setSessionStorage(STORAGE_KEY.GRAPH_MODE_PERCENT, !before);
    refreshGraphImage("medal", calcdata);
    refreshGraphImage("rank", calcdata);
  });
  document.body.appendChild(graphModeSwitch);

  // 表を隠すボタン
  let hidebtn = document.createElement('button');
  hidebtn.className = btnClass;
  hidebtn.setAttribute("data-toggle", "collapse");
  hidebtn.setAttribute("data-target", ".hideitems");
  hidebtn.setAttribute("aria-expanded", "false");
  hidebtn.setAttribute("aria-controls", "medal-table rank-table score-table");
  hidebtn.innerText = "詳細を見る/隠す";
  document.body.appendChild(hidebtn);

  document.body.appendChild(document.createElement('br'));
  document.body.appendChild(document.createElement('br'));
}

// 個人情報表ページ
async function personal_datapage() {
  showMessage("プレイデータの読み込み中・・・", true);
  let data = await getLocalStorage(STORAGE_KEY.PERSONAL_DATA, () => wapper_personal());
  if (!data || data.length == 0 || !data[0]) {
    showMessage(
      "プレイデータの読み取りに失敗しました。<br>" + 
      "公式サイトにアクセスして、データが参照できるか確認してください。", false, true);
    return;
  }
  let calcdata = calcPersonalData(data);

  cleanupHTML();

  // 設定ボタンなど
  addPersonalDatapageTopButton(calcdata);
  // 各種グラフ
  appendGraphBase("クリアメダル分布と平均スコア", "medal");
  createDataTable("クリアメダル一覧", "medal", `${GITHUB_URL}/c_icon/c_`, calcdata.lvMedalCount, 11, calcdata.lvSongCount);
  appendGraphBase("クリアランク分布と平均スコア", "rank");
  createDataTable("クリアランク一覧", "rank", `${GITHUB_URL}/c_icon/s_`, calcdata.lvRankCount, 8, calcdata.lvSongCount);
  // 平均スコア表
  createScoreTable(calcdata.lvScoreAve, calcdata.lvPlayCount);

  // メダル取得グラフ描画 (将来的に数と割合で切り替えるため、画面更新を別関数化)
  refreshGraphImage("medal", calcdata);
  refreshGraphImage("rank", calcdata);

  // TODO : 曲一覧表 メダル表やグラフをクリックすると、その条件でフィルタリングされた曲一覧に更新されて、その表示位置にジャンプ
  // TODO : データ更新ボタン。前回の取得日時と時差を表示しておく。となると、ローカルの自動更新は1wより長くていいか？週1プレイヤーは更新いらないだろう
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
      await main(i, mode);
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

// 個人統計情報ページへの遷移ボタンを画面に追加
async function allpage_sub_personal() {
  // タイトル
  let t = document.createElement('h2');
  t.textContent = "個人データ参照";
  document.body.appendChild(t);
  // 遷移用ボタン
  let maindiv = document.createElement('div');
  maindiv.className = "button-container";
  let subdiv = document.createElement('div');
  let b = document.createElement('button');
  b.textContent = "Lv40～50 統計";
  b.addEventListener('click', async () => {
    await personal_datapage();
  });
  // 注意事項
  let p = document.createElement('p');
  p.textContent = "注意: 初回はデータ読み込みに時間がかかります"
  // 各要素を画面に追加
  subdiv.appendChild(b);
  subdiv.appendChild(p);
  maindiv.appendChild(subdiv);
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
  allpage_sub(M_CLEAR, "クリア難易度表", 46, 50)
  // フルコン難易度表
  allpage_sub(M_FULLCOMBO, "フルコン難易度表", 45, 48)

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
  srankcheck.checked = await getSessionStorage(STORAGE_KEY.HAS_SCORE_RANK, () => false);
  srankcheck.addEventListener('change', async (event) => {
    setSessionStorage(STORAGE_KEY.HAS_SCORE_RANK, event.target.checked);
  });
  let sranklabel = document.createElement('label');
  sranklabel.htmlFor = "iddrawscorerank";
  sranklabel.innerText = "クリアランク表示";
  optiondiv.appendChild(srankcheck);
  optiondiv.appendChild(sranklabel);
  document.body.appendChild(optiondiv);
  document.body.appendChild(document.createElement('br'));

  // 個人情報ページ
  allpage_sub_personal();

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
export default async (lv, mode=1) => {
  // 初回アクセス時のみ、ヘッダに必要情報を取り込む
  document.head.innerHTML = "";
  document.body.innerHTML = "初期化中・・・";
  // セッションストレージを初期化
  sessionStorage.clear();
  // js/cssの取り込み
  await loadScript(GITHUB_URL + "/js/jquery-3.3.1.slim.min.js"); // 注意: 読み込む順番を変えてはいけない
  await loadScript(GITHUB_URL + "/js/popper.min.js");
  await loadScript(GITHUB_URL + "/js/bootstrap.min.js");
  await loadScript(GITHUB_URL + "/js/jquery.dataTables.min.js");
  await loadScript(GITHUB_URL + "/js/dataTables.bootstrap4.min.js");
  await loadScript(GITHUB_URL + "/js/Chart.bundle.min.js");
  await loadScript(GITHUB_URL + "/js/logger.js");
  await loadScript(GITHUB_URL + "/js/storage.js");
  await loadScript(GITHUB_URL + "/js/webtool.js");

  await loadCSS(GITHUB_URL + "/css/normalize.css");
  await loadCSS(GITHUB_URL + "/css/bootstrap.min.css");
  await loadCSS(GITHUB_URL + "/css/dataTables.bootstrap4.min.css");
  await loadCSS(GITHUB_URL + "/css/style.css");

  // メダルカウント表示用フォント
  await loadCSS("https://fonts.googleapis.com/css2?family=Varela+Round&display=swap");
  
  if (mode == M_ALL){
    allpage();
  }else{
    main(lv, mode);
  }
};