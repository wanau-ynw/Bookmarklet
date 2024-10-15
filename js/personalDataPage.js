const PLAY_DATA_URL = "https://p.eagate.573.jp/game/popn/jamfizz/playdata/mu_lv.html"
// const GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet"
const GITHUB_URL = "https://ynws.github.io/Bookmarklet"

const PD_STORAGE_KEY = {
    PERSONAL_DATA: "personal_data",
    GRAPH_MODE_PERCENT: "graph_mode_percent",
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
      li.querySelector('.col_music_lv div:nth-of-type(1)').textContent,
      parseInt(li.children[3].textContent.trim()),
      medalurlToInt(li.children[3].firstChild.src),
      li.children[3].children.length >= 2 ? rankurlToInt(li.children[3].children[1].src) : getErrorMedalID(),
    ])
    .map(([song, genre, score, medal, rank]) => {
      return { song, genre, score, medal, rank};
    });
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

// 曲一覧描画用のプレースホルダをHTMLに追加する
function appendMusicListBase() {
  let t = document.createElement('h2');
  t.id = 'musiclist-title';
  t.textContent = "曲一覧";
  document.body.appendChild(t);

  const table = document.createElement('table');
  table.id = 'musiclist-table';
  table.className = 'table table-striped table-bordered table-sm';

  // テーブルのヘッダーを作成
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  const headers = ['Lv', 'ジャンル名', '曲名', 'メダル', 'スコア'];

  headers.forEach(headerText => {
    const th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);
  document.body.appendChild(table);
}

async function moveToMusicList(e, lv=null, medalmode=null, medalid=null, nomedal=false) {
  e.preventDefault();
  refreshMusicList(lv, medalmode, medalid, nomedal);
  document.getElementById('musiclist-title').scrollIntoView({ behavior: "smooth" });
}

// 曲一覧の再描画
async function refreshMusicList(lv=null, medalmode=null, medalid=null, nomedal=false) {
  let data = await getLocalStorage(PD_STORAGE_KEY.PERSONAL_DATA, () => wapper_personal());
  if (!data || data.length == 0 || !data[0]) {
    showMessage("プレイデータの読み取りに失敗しました", true, true);
    return;
  }
  // タイトル変更
  let t = document.getElementById('musiclist-title');
  t.innerHTML = "曲一覧";
  if(lv){
    t.innerHTML += ` / レベル条件${lv}`;
  }
  if (medalmode == "medal") {
    t.innerHTML += ` / クリアメダル条件:<img src="${GITHUB_URL}/c_icon/c_${medalid}.png" height="32px" _pageexpand_="32"></img>`;
  } else if (medalmode == "rank") {
    t.innerHTML += ` / クリアランク条件:<img src="${GITHUB_URL}/c_icon/s_${medalid}.png" height="32px" _pageexpand_="32"></img>`;
  }
  if(nomedal){
    t.innerHTML += ` / 未プレイ`;
  }
  
  // 曲一覧データ変更
  let scriptInnerHTML = `
  var data = [`;
  data.forEach(lvdata => {
    // Lvフィルタ
    if(lv && lv != lvdata.lv)return;
    lvdata.data.forEach(d => {
      // Lv/メダルフィルタ
      if (nomedal && d.score != 0)return;
      if (!nomedal && d.score == 0)return;
      if (medalmode == "medal" && d.medal != medalid)return;
      if (medalmode == "rank" && d.rank != medalid)return;
      scriptInnerHTML += `
          {
              "lv": ${lvdata.lv},
              "genre": '${d.genre.replace(/'/g, "\\'").replace(/"/g, '\\"')}',
              "title": '${d.song.replace(/'/g, "\\'").replace(/"/g, '\\"')}',
              "mymedal": '<div hidden>${medalIDsTotext(d.rank, d.medal)}</div>${medalIDsToImg(d.rank, d.medal, GITHUB_URL)}',
              "score": '${d.score}'
          },`;
    });
  });
  scriptInnerHTML += `
      ]
  $(document).ready(function() {
      if ($.fn.DataTable.isDataTable('#musiclist-table')) {
          $('#musiclist-table').DataTable().destroy();
      }
      $('#musiclist-table').DataTable({
          displayLength: 50,
          data: data,
          columns: [
              { data: "lv" },
              { data: "genre" },
              { data: "title" },
              { data: "mymedal" },
              { data: "score" }
          ],
          "columnDefs": [
              { className: "text-right", targets: [0,4] },
              { width: '78px', targets: [3] }
          ]
      });
  });
  `;
  addScript("dynamic-musiclist", scriptInnerHTML);
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
  let percentMode = await getSessionStorage(PD_STORAGE_KEY.GRAPH_MODE_PERCENT, () => false);

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
  td.innerHTML = txt;
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
        if(value === 0){
          cell.style = "color:#999999"  // 値が0のセルはグレーにして目立たせなくする
          cell.innerHTML = value;
        }else{
          cell.innerHTML = `<a href='#musiclist-title' onclick="moveToMusicList(event, ${key}, '${idbase}', ${colLen-index})">${value}</a>`;
        }
        rowtotal += value;
        columnTotals[index] += value;
        row.appendChild(cell);
      });
      // カラム合計を表示
      row.appendChild(makeTd(`<a href='#musiclist-title' onclick="moveToMusicList(event, ${key})">${rowtotal}</a>`));
      // メダルがない曲数
      row.appendChild(makeTd(`<a href='#musiclist-title' onclick="moveToMusicList(event, ${key}, null, null, true)">${songcount[key] - rowtotal}</a>`));
      nomedalTotal += songcount[key] - rowtotal;

      tbody.appendChild(row);
      grandTotal += rowtotal;
    }
  }
  // 最後に、合計行を追加
  const totalRow = document.createElement("tr");
  totalRow.appendChild(makeTd("合計"));

  // 各列の合計をセルに追加
  columnTotals.forEach((columnTotal, index) => {
    totalRow.appendChild(makeTd(`<a href='#musiclist-title' onclick="moveToMusicList(event, null, '${idbase}', ${colLen-index})">${columnTotal}</a>`));
  });
  totalRow.appendChild(makeTd(`<a href='#musiclist-title' onclick="moveToMusicList(event)">${grandTotal}</a>`));
  totalRow.appendChild(makeTd(`<a href='#musiclist-title' onclick="moveToMusicList(event, null, null, null, true)">${nomedalTotal}</a>`));

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
function addPersonalDatapageTopButton(calcdata, mainpagecallback) {
  // 一覧に戻るボタン
  let backbtn = document.createElement('button');
  backbtn.className = "btn btn-primary mr-4";
  backbtn.textContent = "一覧に戻る";
  backbtn.addEventListener('click', async () => { await Promise.resolve(mainpagecallback()) });
  document.body.appendChild(backbtn);

  // グラフの描画モード切替
  let graphModeSwitch = document.createElement('button');
  graphModeSwitch.className = "btn btn-info mr-4";
  graphModeSwitch.innerText = "曲数グラフ/割合グラフ";
  graphModeSwitch.addEventListener('click', async () => {
    let before = await getSessionStorage(PD_STORAGE_KEY.GRAPH_MODE_PERCENT, () => false);
    setSessionStorage(PD_STORAGE_KEY.GRAPH_MODE_PERCENT, !before);
    refreshGraphImage("medal", calcdata);
    refreshGraphImage("rank", calcdata);
  });
  document.body.appendChild(graphModeSwitch);

  // 表を隠すボタン
  let hidebtn = document.createElement('button');
  hidebtn.className = "btn btn-info mr-4";
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
async function personal_datapage(mainpagecallback) {
  showMessage("プレイデータの読み込み中・・・", true);
  let data = await getLocalStorage(PD_STORAGE_KEY.PERSONAL_DATA, () => wapper_personal());
  if (!data || data.length == 0 || !data[0]) {
    showMessage(
      "プレイデータの読み取りに失敗しました。<br>" + 
      "公式サイトにアクセスして、データが参照できるか確認してください。", false, true);
    return;
  }
  let calcdata = calcPersonalData(data);

  cleanupHTML();

  // 設定ボタンなど
  addPersonalDatapageTopButton(calcdata, mainpagecallback);
  // 各種グラフ
  appendGraphBase("クリアメダル分布と平均スコア", "medal");
  createDataTable("クリアメダル一覧", "medal", `${GITHUB_URL}/c_icon/c_`, calcdata.lvMedalCount, 11, calcdata.lvSongCount);
  appendGraphBase("クリアランク分布と平均スコア", "rank");
  createDataTable("クリアランク一覧", "rank", `${GITHUB_URL}/c_icon/s_`, calcdata.lvRankCount, 8, calcdata.lvSongCount);
  // 平均スコア表
  createScoreTable(calcdata.lvScoreAve, calcdata.lvPlayCount);
  // 曲一覧
  appendMusicListBase();

  // メダル取得グラフ描画 (数と割合で切り替えるため、画面更新を別関数化)
  refreshGraphImage("medal", calcdata);
  refreshGraphImage("rank", calcdata);
  refreshMusicList();

  // TODO : データ更新ボタン。前回の取得日時と時差を表示しておく。となると、ローカルの自動更新は1wより長くていいか？週1プレイヤーは更新いらないだろう
}

// 個人統計情報ページへの遷移ボタンを画面に追加
async function allpage_sub_personal(mainpagecallback) {
  // タイトル
  let t = document.createElement('h2');
  t.textContent = "個人データ参照";
  document.body.appendChild(t);
  // 遷移用ボタン
  let maindiv = document.createElement('div');
  maindiv.className = "button-container";
  let subdiv = document.createElement('div');
  let b = document.createElement('button');
  b.textContent = "Lv40～50 まとめ";
  b.addEventListener('click', async () => {
    await personal_datapage(mainpagecallback);
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
