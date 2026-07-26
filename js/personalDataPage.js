const PLAY_DATA_URL = "https://p.eagate.573.jp/game/popn/popn29/playdata/mu_lv.html?version=-1&bemani=0&category=0&keyword=&sort=&sort_type=up&"
// GITHUB_URLは fullcomboList.js が window.GITHUB_URL として公開したものを利用する(difficultyPage.jsもこれを参照)

const PD_STORAGE_KEY = {
    PERSONAL_DATA: "personal_data",
    GRAPH_MODE_PERCENT: "graph_mode_percent",
    DIFF_HISTORY: "personal_diff_history",
}
// 差分履歴として保存しておく曲データの上限件数(古いものから間引く)
const DIFF_HISTORY_MAX_RECORDS = 500;

// URLを読み込み、そのページ内の全データを返す
async function whatever(url) {
  console.log("load url : " + url)
  let domparser = new DOMParser();

  let tables = await fetch(url)
    .then(resToText)
    .then((text) => domparser.parseFromString(text, "text/html"))
    .then((doc) => doc.querySelectorAll(".mu_list_lv_table"))  // ← クラス名変更

  if (tables.length != 1) {
    console.log("table not found : " + url)
    showMessage("プレイデータ読み込み時にエラーが発生しました", false, true);
    return
  }
  let tableRows = tables[0].querySelectorAll("li")

  return Array.from(tableRows)
    .filter((li) => !li.classList.contains("st_th"))  // ← ヘッダー行を除外
    .map((li) => [
      li.children[0].querySelector("a").textContent.trim(),          // 曲名
      li.children[0].querySelector("p:nth-of-type(1)").textContent,  // ジャンル (1つ目の<p>)
      parseInt(li.children[3].querySelector("p").textContent.trim()), // スコア (<p>から取得)
      medalurlToInt(li.children[3].querySelector("img:nth-of-type(1)").src),  // メダル
      li.children[3].querySelector("img:nth-of-type(2)")
        ? rankurlToInt(li.children[3].querySelector("img:nth-of-type(2)").src)
        : getErrorMedalID(),  // ランク
    ])
    .map(([song, genre, score, medal, rank]) => {
      return { song, genre, score, medal, rank };
    });
}

// 個人データ参照のため、特定のレベル範囲の曲をすべて取得する。
// 公式サイト負荷軽減のため、1件ずつの完全逐次取得ではなく、少数ページずつまとめて並列取得する
const PERSONAL_FETCH_BATCH_SIZE = 4; // 同時に取得するページ数
const PERSONAL_FETCH_BATCH_INTERVAL_MS = 500; // バッチごとの待機時間

async function wapper_personal() {
  await showMessage("注意：");
  await showMessage("公式サイトに負荷をかけないよう、少しずつまとめてデータを取得しています");
  await showMessage("すべてのデータを取得するのに30秒程度かかるので、少しお待ちください");
  await showMessage("※取得したデータはデバイス上に保管するので、今後のアクセスはここまで時間かかりません");
  const s = [];
  for (let lv = 40; lv <= 50; lv++) {
    await showMessage(`Lv${lv} データ取得開始`);
    const size = await getMaxLvPageNum(`${PLAY_DATA_URL}page=0&lv=${lv}`);
    if (size == -1) {
      await showMessage("曲一覧ページの最大数取得時にエラーが発生しました", false, true);
      return null;
    }

    let pagelist = Array.from({ length: size }, (_, i) => i);
    let results = [];
    await showMessage(`Lv${lv} 0/${size}`);
    for (let i = 0; i < pagelist.length; i += PERSONAL_FETCH_BATCH_SIZE) {
      const batch = pagelist.slice(i, i + PERSONAL_FETCH_BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map((page) => whatever(`${PLAY_DATA_URL}page=${page}&lv=${lv}`))
      );
      batchResults.forEach((result) => results.push(...result)); // 配列の要素を展開してpush
      await replaceLastMessage(`Lv${lv} ${Math.min(i + PERSONAL_FETCH_BATCH_SIZE, size)}/${size}`);
      await sleep(PERSONAL_FETCH_BATCH_INTERVAL_MS);
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
    lvMedalCount[lv] = Array(12+1).fill(0);
    lvRankCount[lv] = Array(12+1).fill(0);

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

// 旧データ・新データ(wapper_personalの返り値と同じ形式)を比較し、
// スコア・メダル・ランクのいずれかが変化した曲の一覧を返す。
// 旧データに存在しない曲(新曲追加等)は比較対象外として無視する
function computePersonalDataDiff(oldData, newData) {
  if (!oldData) return [];
  const oldMap = new Map();
  oldData.forEach(lvdata => {
    lvdata.data.forEach(d => {
      oldMap.set(`${lvdata.lv}_${d.song}`, d);
    });
  });

  const diffs = [];
  newData.forEach(lvdata => {
    lvdata.data.forEach(d => {
      const old = oldMap.get(`${lvdata.lv}_${d.song}`);
      if (!old) return;
      if (d.score === old.score && d.medal === old.medal && d.rank === old.rank) return;
      diffs.push({
        lv: lvdata.lv,
        genre: d.genre,
        song: d.song,
        oldScore: old.score,
        newScore: d.score,
        oldMedal: old.medal,
        newMedal: d.medal,
        oldRank: old.rank,
        newRank: d.rank,
      });
    });
  });
  return diffs;
}

// 差分履歴(更新日ごとの差分一覧)を読み込む
function loadDiffHistory() {
  let raw = localStorage.getItem(PD_STORAGE_KEY.DIFF_HISTORY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error("差分履歴の読み込みに失敗しました", e);
    return [];
  }
}

function saveDiffHistory(sessions) {
  localStorage.setItem(PD_STORAGE_KEY.DIFF_HISTORY, JSON.stringify(sessions));
}

// 今回の差分を履歴に追加する。合計件数がDIFF_HISTORY_MAX_RECORDSを超えたら古い更新日から間引く
// (最新の更新分は、それ単体で上限を超えていても残す)
function recordDiffHistory(diffs) {
  if (!diffs || diffs.length === 0) return;
  let sessions = loadDiffHistory();
  sessions.push({ timestamp: new Date().getTime(), diffs });

  let total = sessions.reduce((sum, s) => sum + s.diffs.length, 0);
  while (total > DIFF_HISTORY_MAX_RECORDS && sessions.length > 1) {
    total -= sessions.shift().diffs.length;
  }
  saveDiffHistory(sessions);
}

// 曲一覧描画用のプレースホルダをHTMLに追加する
function appendMusicListBase() {
  let t = document.createElement('h2');
  t.id = 'musiclist-title';
  t.textContent = "曲一覧";
  document.body.appendChild(t);

  const table = document.createElement('table');
  table.id = 'musiclist-table';
  table.className = 'table table-striped table-bordered table-sm col-md-12 col-sm-12';

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
    t.innerHTML += ` / クリアメダル条件:<img src="${GITHUB_URL}/icon/c_${medalid}.png" height="32px" _pageexpand_="32"></img>`;
  } else if (medalmode == "rank") {
    t.innerHTML += ` / クリアランク条件:<img src="${GITHUB_URL}/icon/s_${medalid}.png" height="32px" _pageexpand_="32"></img>`;
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
          displayLength: 25,
          data: data,
          responsive: true,
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
  let labels = ["黒●", "黒◆", "黒★", "緑●", "橙●", "銅●", "銅◆", "銅★", "銀〇", "銀◇", "銀☆", "金☆"];
  let colors = ["#111133", "#222244", "#444466", "#00a000", "#FF6D00", "#6E2A13", "#8E4A33", "#aE6A53", "#808080", "#a0a0a0", "#c0c0c0", "#c0c000"];
  let data = calcdata.lvMedalCount;
  if (target === "rank") {
    labels = ["E", "D", "C", "B", "B+", "A", "A+", "AA", "AA+", "AAA", "S", "S+"];
    colors = ["#71588f", "#4198af", "#89a54e", "#db843d", "#EA6509", "#f8b1df", "#ef637e", "#c71b3eff", "#D2042D", "#800020", "#b0b000", "#E8E810"];
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

// 「前回からの変化」エリアのベースをHTMLに追加する(サマリ・履歴選択・詳細テーブル)
function appendDiffBase() {
  let t = document.createElement('h2');
  t.textContent = "前回からの変化";
  document.body.appendChild(t);

  let summary = document.createElement('p');
  summary.id = 'diff-summary';
  document.body.appendChild(summary);

  // 履歴選択(更新日ごとに過去の差分をたどれる)
  let historyLabel = document.createElement('label');
  historyLabel.textContent = "表示する更新日: ";
  document.body.appendChild(historyLabel);
  let historySelect = document.createElement('select');
  historySelect.id = 'diff-history-select';
  historySelect.addEventListener('change', () => {
    let sessions = loadDiffHistory();
    let idx = parseInt(historySelect.value);
    if (isNaN(idx) || !sessions[idx]) return;
    renderDiffTable(sessions[idx].diffs);
  });
  document.body.appendChild(historySelect);
  document.body.appendChild(document.createElement('br'));

  // 詳細テーブルの表示切り替え
  let toggleBtn = document.createElement('button');
  toggleBtn.className = "btn btn-info mr-4";
  toggleBtn.setAttribute("data-toggle", "collapse");
  toggleBtn.setAttribute("data-target", "#diff-detail");
  toggleBtn.textContent = "詳細を見る/隠す";
  document.body.appendChild(toggleBtn);
  document.body.appendChild(document.createElement('br'));

  let detailDiv = document.createElement('div');
  detailDiv.id = 'diff-detail';
  detailDiv.className = 'collapse';

  let table = document.createElement('table');
  table.id = 'diff-table';
  table.className = 'table table-striped table-bordered table-sm';
  let thead = document.createElement('thead');
  let headerRow = document.createElement('tr');
  ['Lv', 'ジャンル名', '曲名', 'スコア変化', 'メダル変化'].forEach(headerText => {
    let th = document.createElement('th');
    th.textContent = headerText;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  detailDiv.appendChild(table);
  document.body.appendChild(detailDiv);
  document.body.appendChild(document.createElement('br'));
}

// 履歴選択プルダウンを、保存されている履歴(新しい順)で再構築する
function refreshDiffHistorySelect() {
  let sessions = loadDiffHistory();
  let select = document.getElementById('diff-history-select');
  select.innerHTML = '';
  // 表示は新しい順、valueには元の配列インデックスを持たせる
  sessions.slice().reverse().forEach((session, i) => {
    let originalIndex = sessions.length - 1 - i;
    let option = document.createElement('option');
    option.value = originalIndex;
    option.textContent = new Date(session.timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
    select.appendChild(option);
  });
}

// 指定した差分一覧を、サマリ・詳細テーブルに反映する
function renderDiffTable(diffs) {
  let scoreUpCount = diffs.filter(d => d.newScore > d.oldScore).length;
  let medalUpCount = diffs.filter(d => d.newMedal > d.oldMedal).length;
  let rankUpCount = diffs.filter(d => d.newRank > d.oldRank).length;

  let summary = document.getElementById('diff-summary');
  summary.textContent = diffs.length === 0
    ? "変化はありませんでした"
    : `変化があった曲: ${diffs.length}曲(スコア更新 ${scoreUpCount}曲 / メダルアップ ${medalUpCount}曲 / ランクアップ ${rankUpCount}曲)`;

  let scriptInnerHTML = `
  var data = [`;
  diffs.forEach(d => {
    let scoreDiff = d.newScore - d.oldScore;
    let scoreDiffStr = (scoreDiff > 0 ? "+" : "") + scoreDiff;
    scriptInnerHTML += `
        {
            "lv": ${d.lv},
            "genre": '${d.genre.replace(/'/g, "\\'").replace(/"/g, '\\"')}',
            "title": '${d.song.replace(/'/g, "\\'").replace(/"/g, '\\"')}',
            "score": '${d.oldScore} → ${d.newScore} (${scoreDiffStr})',
            "medal": '${medalIDsToImg(d.oldRank, d.oldMedal, GITHUB_URL)} → ${medalIDsToImg(d.newRank, d.newMedal, GITHUB_URL)}'
        },`;
  });
  scriptInnerHTML += `
      ]
  $(document).ready(function() {
      if ($.fn.DataTable.isDataTable('#diff-table')) {
          $('#diff-table').DataTable().destroy();
      }
      $('#diff-table').DataTable({
          displayLength: 25,
          data: data,
          responsive: true,
          columns: [
              { data: "lv" },
              { data: "genre" },
              { data: "title" },
              { data: "score" },
              { data: "medal" }
          ],
          "columnDefs": [
              { className: "text-right", targets: [0] }
          ]
      });
  });
  `;
  addScript("dynamic-diff", scriptInnerHTML);
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

  // データ取得日
  let datatime = getLocalStorageTimeAndDiff(PD_STORAGE_KEY.PERSONAL_DATA);
  let p = document.createElement('p');
  p.textContent = `データ取得日: ${datatime} ※データ更新ボタンは画面の一番下にあります`;
  document.body.appendChild(p);
}

function addPersonalDatapageBottomButton(calcdata, mainpagecallback) {
  document.body.appendChild(document.createElement('br'));

  // 一覧に戻るボタン
  let backbtn = document.createElement('button');
  backbtn.className = "btn btn-primary mr-5";
  backbtn.textContent = "一覧に戻る";
  backbtn.addEventListener('click', async () => { await Promise.resolve(mainpagecallback()) });
  document.body.appendChild(backbtn);

  // データ更新ボタン
  let dataUpdateBtn = document.createElement('button');
  dataUpdateBtn.className = "btn btn-danger ml-5 mr-4";
  dataUpdateBtn.innerText = "データ更新(時間がかかります)";
  dataUpdateBtn.addEventListener('click', async () => {
    // 差分算出のため、消去前の現在のデータを確保しておく
    let oldData = await getLocalStorage(PD_STORAGE_KEY.PERSONAL_DATA, () => wapper_personal());
    localStorage.removeItem(PD_STORAGE_KEY.PERSONAL_DATA);
    await personal_datapage(mainpagecallback, oldData);
  });
  document.body.appendChild(dataUpdateBtn);
  document.body.appendChild(document.createElement('br'));
  // データ取得日
  let datatime = getLocalStorageTimeAndDiff(PD_STORAGE_KEY.PERSONAL_DATA);
  let p = document.createElement('p');
  p.textContent = `データ取得日: ${datatime}`;
  document.body.appendChild(p);
}

// 個人情報表ページ
// oldDataForDiff: データ更新ボタンから呼ばれた場合のみ、更新前のデータが渡される(前回からの変化を表示するため)
async function personal_datapage(mainpagecallback, oldDataForDiff = null) {
  showMessage("プレイデータの読み込み中・・・", true);
  let data = await getLocalStorage(PD_STORAGE_KEY.PERSONAL_DATA, () => wapper_personal());
  if (!data || data.length == 0 || !data[0]) {
    showMessage(
      "プレイデータの読み取りに失敗しました。<br>" +
      "公式サイトにアクセスして、データが参照できるか確認してください。", false, true);
    return;
  }

  // 更新時のみ、前回データとの差分を履歴に記録する
  if (oldDataForDiff) {
    let diffs = computePersonalDataDiff(oldDataForDiff, data);
    recordDiffHistory(diffs);
  }

  let calcdata = calcPersonalData(data);

  cleanupHTML();

  // ヘッダー設定ボタンなど
  addPersonalDatapageTopButton(calcdata, mainpagecallback);

  // 前回からの変化(履歴が無ければ表示しない)
  let diffHistory = loadDiffHistory();
  if (diffHistory.length > 0) {
    appendDiffBase();
    refreshDiffHistorySelect();
    renderDiffTable(diffHistory[diffHistory.length - 1].diffs); // 直近の更新分を表示
  }

  // 各種グラフ
  appendGraphBase("クリアメダル分布と平均スコア", "medal");
  createDataTable("クリアメダル一覧", "medal", `${GITHUB_URL}/icon/c_`, calcdata.lvMedalCount, 12, calcdata.lvSongCount);
  appendGraphBase("クリアランク分布と平均スコア", "rank");
  createDataTable("クリアランク一覧", "rank", `${GITHUB_URL}/icon/s_`, calcdata.lvRankCount, 12, calcdata.lvSongCount);
  // 平均スコア表
  createScoreTable(calcdata.lvScoreAve, calcdata.lvPlayCount);
  // 曲一覧
  appendMusicListBase();
  // フッター設定ボタンなど
  addPersonalDatapageBottomButton(calcdata, mainpagecallback);

  // メダル取得グラフ描画 (数と割合で切り替えるため、画面更新を別関数化)
  refreshGraphImage("medal", calcdata);
  refreshGraphImage("rank", calcdata);
  refreshMusicList();
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
