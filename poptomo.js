// const GITHUB_URL = "https://wanau-ynw.github.io/Bookmarklet"
const GITHUB_URL = "https://ynws.github.io/Bookmarklet"
const STORAGE_KEY = {
    SELECTED_LV: "selected_lv",
    SELECTED_TOMO_ID: "selected_tomo_id",
    SELECTED_SKIP_EMPTY: "skip_empty",
    SELECTED_SKIP_WIN: "skip_win",
    SELECTED_SKIP_LOSE: "skip_lose",
    LV_DATA: (id, lv) => `tomo_${id}_${lv}`,
}
const PLACEHOLDER_ID = {
    MUSIC_COUNT: "ph_mcount",
    WIN_LOSE_TEXT: "ph_wl_text",
    WIN_LOSE_GRAPH: "ph_wl_graph",
    AVE_SCORE_TEXT: "ph_ave_score",
    MUSIC_LIST: "ph_mlist",
}

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
    // データを格納するための配列を作成
    const results = [];
    console.log("load url : " + url);

    let domparser = new DOMParser();
    let table = await fetch(url)
        .then(resToText)
        .then((text) => domparser.parseFromString(text, "text/html"))
        .then((doc) => doc.getElementById('pvs_list_table'))
    if (!table) {
        showMessage("データ比較表が見つかりませんでした", false, true);
        return
    }

    const rows = table.getElementsByTagName('tr');
    for (let i = 2; i < rows.length; i++) { // 最初の2行はヘッダーなのでスキップ
        const cells = rows[i].getElementsByTagName('td');
        if (cells.length > 0) {
            const title = cells[0].querySelector('a').textContent.trim(); // 曲名
            const genre = cells[0].querySelector('br').nextSibling.nodeValue.trim(); // ジャンル

            // プレイヤーの成績を取得
            const p1Score = parseInt(cells[1].innerText.trim());
            const p1medal = medalurlToInt(cells[1].firstChild.src);
            const p1rank = rankurlToInt(cells[1].children[1].src);
            const p2Score = parseInt(cells[2].innerText.trim());
            const p2medal = medalurlToInt(cells[2].firstChild.src);
            const p2rank = rankurlToInt(cells[2].children[1].src);

            // 結果をオブジェクトとして格納
            results.push({
                genre,
                title,
                p1Score,
                p1medal,
                p1rank,
                p2Score,
                p2medal,
                p2rank,
            });
        }
    }
    return results;
}

// ポプとも比較対象の全ページに対し、データの取得を行う
async function wapper(id, lv) {
    let size = await getMaxLvPageNum(getTomoDiffUrl(id, lv, 0));
    if (size == -1) {
        showMessage("曲一覧ページの最大数取得時にエラーが発生しました", false, true);
        return null;
    }
    let pagelist = Array.from({ length: size }, (_, index) => index);

    const promises = pagelist.map(page =>
        whatever(getTomoDiffUrl(id, lv, page))
    );
    return (await Promise.all(promises)).flat();
}

// ページにスクリプトを追加する。すでにある場合は削除して作り直す
function addScript(scriptId, scriptContent) {
    const scriptElement = document.getElementById(scriptId);
    if (scriptElement) {
        scriptElement.parentNode.removeChild(scriptElement);
    }

    const script = document.createElement('script');
    script.type = "text/javascript";
    script.id = scriptId;
    script.innerHTML = scriptContent;
    document.head.appendChild(script);
}

function addDiffList(name, tomoname) {
    const table = document.createElement('table');
    table.id = PLACEHOLDER_ID.MUSIC_LIST;
    table.className = 'table table-striped table-bordered table-sm';
    
    // テーブルのヘッダーを作成
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const headers = ['順位', 'ジャンル名', '曲名', name, 'メダル', tomoname, 'メダル', 'スコア差'];
    
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    document.body.appendChild(table);
}

function medalTotext(d, player) {
    if (player == 1){
        return String(d["p1rank"]).padStart(2, '0') + String(d["p1medal"]).padStart(2, '0');
    }else{
        return String(d["p2rank"]).padStart(2, '0') + String(d["p2medal"]).padStart(2, '0');
    }
}

function medalToImg(d, player) {
    if (player == 1){
        if(isErrorMedalID(d["p1medal"]) || isErrorMedalID(d["p1rank"])){
            return "";
        }
        return `<img src="${GITHUB_URL}/icon/s_${d["p1rank"]}.png" height="32px"><img src="${GITHUB_URL}/c_icon/c_${d["p1medal"]}.png" height="32px"></img>`
    }else{
        if(isErrorMedalID(d["p2medal"]) || isErrorMedalID(d["p2rank"])){
            return "";
        }
        return `<img src="${GITHUB_URL}/icon/s_${d["p2rank"]}.png" height="32px"><img src="${GITHUB_URL}/c_icon/c_${d["p2medal"]}.png" height="32px"></img>`
    }

}

function addDiffListScript(data) {
    // 表データ更新用スクリプトの出力
    let scriptInnerHTML = `
var data = [
        `;
    const dataLength = data.length;
    data.forEach((d, index) => {
        let diff = d["p1Score"] - d["p2Score"];
        let ranking = (diff === 0 ? 0 : (diff > 0 ? 1:2));
    scriptInnerHTML += `
        {
            "ranking": ${ranking},
            "genre": '${d["genre"].replace(/'/g, "\\'").replace(/"/g, '\\"')}',
            "title": '${d["title"].replace(/'/g, "\\'").replace(/"/g, '\\"')}',
            "score": '${d["p1Score"]}',
            "mymedal": '<div hidden>${medalTotext(d,1)}</div>${medalToImg(d,1)}',
            "targetscore": '${d["p2Score"]}',
            "targetmedal": '<div hidden>${medalTotext(d,2)}</div>${medalToImg(d,2)}',
            "targetdiff": '${diff}'
        }${index < dataLength - 1 ? ',' : ''} 
    `;
    });
    scriptInnerHTML += `
    ]
$(document).ready(function() {
    if ($.fn.DataTable.isDataTable('#${PLACEHOLDER_ID.MUSIC_LIST}')) {
        $('#${PLACEHOLDER_ID.MUSIC_LIST}').DataTable().destroy();
    }
    $('#${PLACEHOLDER_ID.MUSIC_LIST}').DataTable({
        displayLength: 50,
        data: data,
        columns: [
            { data: "ranking" },
            { data: "genre" },
            { data: "title" },
            { data: "score" },
            { data: "mymedal" },
            { data: "targetscore" },
            { data: "targetmedal" },
            { data: "targetdiff" }
        ],
        "columnDefs": [
            { className: "text-right", targets: [0,3,5,7] },
            { width: '78px', targets: [4,6] }
        ]
    });
});
`;
    addScript("dynamic-list", scriptInnerHTML);
}

// 勝ち負け数をカウントする
function countResults(data) {
    let totalcount = 0;
    let allplaycount = 0;
    let wincount = 0;
    let losecount = 0;
    let drawcount = 0;
    let allskip = 0;
    let p1skip = 0;
    let p2skip = 0;

    let p1ScoreTotal = 0; // p1のスコア合計
    let p1ScoreCount = 0; // p1のスコアが0でない回数
    let p2ScoreTotal = 0; // p2のスコア合計
    let p2ScoreCount = 0; // p2のスコアが0でない回数

    data.forEach(d => {
        totalcount++;
        let s1 = d["p1Score"];
        let s2 = d["p2Score"];
        if (s1 > 0) { 
            p1ScoreTotal += s1; 
            p1ScoreCount++; 
        }
        if (s2 > 0) { 
            p2ScoreTotal += s2; 
            p2ScoreCount++; 
        }
        if (s1 == 0 && s2 == 0) { allskip++; return; }
        if (s1 == 0) { p1skip++; return; }
        if (s2 == 0) { p2skip++; return; }
        allplaycount++;
        if (s1 == s2) { drawcount++; return; }
        if (s1 > s2) { wincount++; return; }
        losecount++;
    });

    const p1AverageScore = (p1ScoreCount > 0 ? (p1ScoreTotal / p1ScoreCount) : 0);
    const p2AverageScore = (p2ScoreCount > 0 ? (p2ScoreTotal / p2ScoreCount) : 0);

    return {
        totalcount,
        allplaycount,
        wincount,
        losecount,
        drawcount,
        allskip,
        p1skip,
        p2skip,
        p1AverageScore,
        p2AverageScore
    };
}

// スクリプト生成関数
function addGraphScript(resultCounts) {
    // 以下の要素は、スクリプトに埋め込むかどうか未確定なので全部合わせて1つの文字にする
    let addLabelStr = "";
    let addCountStr = "";
    let addColorStr = "";

    if (resultCounts.drawcount != 0) {
        addLabelStr += `"引分け", `;
        addCountStr += `${resultCounts.drawcount}, `;
        addColorStr += `"#FFC107", `;
    }
    if (resultCounts.p1skip != 0) {
        addLabelStr += `"不戦敗", `;
        addCountStr += `${resultCounts.p1skip}, `;
        addColorStr += `"#9E9E9E", `;
    }
    if (resultCounts.p2skip != 0) {
        addLabelStr += `"不戦勝", `;
        addCountStr += `${resultCounts.p2skip}, `;
        addColorStr += `"#2196F3", `;
    }
    if (resultCounts.allskip != 0) {
        addLabelStr += `"両者未プレイ", `;
        addCountStr += `${resultCounts.allskip}, `;
        addColorStr += `"#3E3E3E", `;
    }

    // スクリプトの追加
    let scriptInnerHTML = `
    var dataLabelPlugin = {
        afterDatasetsDraw: function (chart, easing) {
            var ctx = chart.ctx;
            chart.data.datasets.forEach(function (dataset, i) {
                var meta = chart.getDatasetMeta(i);
                if (!meta.hidden) {
                    meta.data.forEach(function (element, index) {
                        if(dataset.data[index] == 0)return;
                        ctx.fillStyle = 'rgb(255, 255, 255)';
                        var fontSize = 16;
                        var fontStyle = 'normal';
                        var fontFamily = 'Helvetica Neue';
                        ctx.font = Chart.helpers.fontString(fontSize, fontStyle, fontFamily);
                        var dataString = chart.data.labels[index]+':'+dataset.data[index];
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        var padding = 5;
                        var position = element.tooltipPosition();
                        ctx.fillText(dataString, position.x, position.y - (fontSize / 2) - padding);
                    })
                }
            })
        }
    }
    if (myChart) {
        myChart.destroy();
    }
    var ctx = document.getElementById("${PLACEHOLDER_ID.WIN_LOSE_GRAPH}");
    var myChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ["勝ち", "負け", ${addLabelStr} ],
            datasets: [{
                data: [${resultCounts.wincount}, ${resultCounts.losecount}, ${addCountStr}],
                backgroundColor: ["#4CAF50", "#F44336", ${addColorStr}]
            }],
        },
        options:{
            title: {
                display: false
            },
            legend: {
                display: false
            },
            maintainAspectRatio: false,
        },
        plugins: [dataLabelPlugin],
    });
    `;
    addScript("dynamic-graph", scriptInnerHTML);
}

async function makeButton(text, callback) {
    let b = document.createElement('button');
    b.innerText = text;
    b.className = 'btn btn-primary mr-3';
    b.onclick = async () => {
        await Promise.resolve(callback());
    };
    return b;
}

async function addOption(optiondiv, id, label, defo, storage, callback) {
    let skipEmptydataCheck = document.createElement('input');
    skipEmptydataCheck.type = "checkbox";
    skipEmptydataCheck.id = id;
    skipEmptydataCheck.checked = await getSessionStorage(storage, () => defo);
    skipEmptydataCheck.addEventListener('change', async (event) => {
        const isChecked = event.target.checked;
        setSessionStorage(storage, isChecked);
        await Promise.resolve(callback());
    });
    let selabel = document.createElement('label');
    selabel.htmlFor = id;
    selabel.innerText = label;
    optiondiv.appendChild(skipEmptydataCheck);
    optiondiv.appendChild(selabel);
    optiondiv.appendChild(document.createElement('br'));
}

/**
 * ポプとも比較用ページ
 */
async function diffpage(name, id, tomo, lv) {
    cleanupHTML();
    showMessage("プレイデータの読み込み中・・・", true);
    let data = await getSessionStorage(STORAGE_KEY.LV_DATA(id, lv), () => wapper(id, lv));
    if (!data || data.length == 0 || !data[0]) {
        showMessage("曲一覧数取得時にエラーが発生しました", false, true);
        document.body.appendChild(await makeButton('戻る', () => main(name, tomo)));
        return;
    }

    cleanupHTML();
    let tomoname = tomo[id]["name"];
    // 移動ボタン
    if (lv >= 2) {
        document.body.appendChild(await makeButton('Lv' + (lv - 1) + ' <<', () => diffpage(name, id, tomo, lv - 1)));
    }
    document.body.appendChild(await makeButton('戻る', () => main(name, tomo)));
    if (lv <= 49) {
        document.body.appendChild(await makeButton('>> Lv' + (lv + 1), () => diffpage(name, id, tomo, lv + 1)));
    }
    // 基礎情報とグラフを表示する列
    let baserow = document.createElement('div');
    baserow.className = "row";
    // 基礎情報
    let infocol = document.createElement('div');
    infocol.className = "col-5";
    let title = document.createElement('h2');
    title.innerText = `Lv${lv} ${name} vs ${tomoname}`;
    infocol.appendChild(title);
    let winlose = document.createElement('p');
    winlose.id = PLACEHOLDER_ID.WIN_LOSE_TEXT;
    winlose.className = "h2_p";
    infocol.appendChild(winlose);
    let avescore = document.createElement('p');
    avescore.id = PLACEHOLDER_ID.AVE_SCORE_TEXT;
    avescore.className = "h2_p";
    infocol.appendChild(avescore);

    // オプション
    let t = document.createElement('h2');
    t.textContent = "オプション";
    infocol.appendChild(t);
    let optiondiv = document.createElement('div');
    optiondiv.className = "toggle-area";
    await addOption(optiondiv, "skip-emptydata", "どちらかが未プレイの曲は除く", true, STORAGE_KEY.SELECTED_SKIP_EMPTY, () => setPlaceholderData(data, name, tomoname));
    await addOption(optiondiv, "skip-win", "勝っている曲は除く", false, STORAGE_KEY.SELECTED_SKIP_WIN, () => setPlaceholderData(data, name, tomoname));
    await addOption(optiondiv, "skip-lose", "負けている曲は除く", false, STORAGE_KEY.SELECTED_SKIP_LOSE, () => setPlaceholderData(data, name, tomoname));
    infocol.appendChild(optiondiv);
    infocol.appendChild(document.createElement('br'));

    // 曲数表示 プレースホルダ
    let mcount = document.createElement('h2');
    mcount.id = PLACEHOLDER_ID.MUSIC_COUNT;
    infocol.appendChild(mcount);

    baserow.appendChild(infocol);

    // 対戦結果グラフ プレースホルダ
    let graphcol = document.createElement('div');
    graphcol.className = "col-7";
    graphcol.style = "position:relative; height:300px";
    let c = document.createElement('canvas');
    c.id = PLACEHOLDER_ID.WIN_LOSE_GRAPH;
    graphcol.appendChild(c);
    baserow.appendChild(graphcol);

    document.body.appendChild(baserow);

    // 一覧表 プレースホルダ
    addDiffList(name, tomoname);
    document.body.appendChild(document.createElement('br'));

    // 戻るボタン
    document.body.appendChild(await makeButton('戻る', () => main(name, tomo)));

    // プレースホルダのデータをセットする
    await setPlaceholderData(data, name, tomoname);
}

/**
 * 結果ページの画面にデータを反映する。オプションによって動的に変える
 */
async function setPlaceholderData(data, name, tomoname){
    let skipEmptydata = await getSessionStorage(STORAGE_KEY.SELECTED_SKIP_EMPTY, () => true);
    let skipWin = await getSessionStorage(STORAGE_KEY.SELECTED_SKIP_WIN, () => false);
    let skipLose = await getSessionStorage(STORAGE_KEY.SELECTED_SKIP_LOSE, () => false);
    let subdata = [];
    data.forEach(d => {
        if (skipEmptydata && (d["p1Score"] == 0 || d["p2Score"] == 0)) {
            return;
        }
        if (skipWin && (d["p1Score"] > d["p2Score"])) {
            return;
        }
        if (skipLose && (d["p1Score"] < d["p2Score"])) {
            return;
        }
        subdata.push(d);
    });

    // 勝ち負け数をカウントする
    const allResultCounts = countResults(data);
    const subResultCounts = countResults(subdata);

    let winlose = document.getElementById(PLACEHOLDER_ID.WIN_LOSE_TEXT);
    winlose.innerText = `戦績 : ${allResultCounts.wincount}勝 ${allResultCounts.losecount}敗 ${allResultCounts.drawcount}分け`;

    let avescore = document.getElementById(PLACEHOLDER_ID.AVE_SCORE_TEXT);
    avescore.innerHTML = `
    平均スコア<br>
    &nbsp;&nbsp;${name}: ${allResultCounts.p1AverageScore.toFixed(1)}<br>
    &nbsp;&nbsp;${tomoname}: ${allResultCounts.p2AverageScore.toFixed(1)}
    `;

    let mcount = document.getElementById(PLACEHOLDER_ID.MUSIC_COUNT);
    mcount.innerText = `曲一覧(${subdata.length}曲)`;

    addGraphScript(subResultCounts);
    addDiffListScript(subdata);
}

/**
 * ポプとも比較条件を設定するためのメイン画面を描画する
 */
async function main(name, tomo) {
    cleanupHTML();
    // タイトルロゴ
    let logo = document.createElement('img');
    logo.src = GITHUB_URL + "/img/popnlogo.png";
    document.body.appendChild(logo);
    document.body.appendChild(document.createElement('br'));

    document.body.appendChild(document.createElement('br'));
    let title = document.createElement('h2');
    title.innerText = "ポプとも比較";
    document.body.appendChild(title);

    // 比較相手選択
    let tomosLabel = document.createElement('label');
    tomosLabel.innerText = '比較相手: ';
    document.body.appendChild(tomosLabel);
    let selectTomo = document.createElement('select');
    let selectTomoDefoID = await getSessionStorage(STORAGE_KEY.SELECTED_TOMO_ID, () => 0);
    tomo.forEach(t => {
        let option = document.createElement('option');
        option.value = t.id; // IDをvalueとして設定
        option.innerText = t.name; // 名前を表示
        if (t.id === selectTomoDefoID){
            option.selected = true;
        }
        selectTomo.appendChild(option);
    });
    document.body.appendChild(selectTomo);
    document.body.appendChild(document.createElement('br'));

    // Lv選択
    let lvLabel = document.createElement('label');
    lvLabel.innerText = 'Lv: ';
    document.body.appendChild(lvLabel);
    let selectLv = document.createElement('select');
    for (let i = 50; i >= 1; i--) { // 逆順にループ
        let option = document.createElement('option');
        option.value = i;
        option.innerText = i;
        selectLv.appendChild(option);
    }
    selectLv.value = await getSessionStorage(STORAGE_KEY.SELECTED_LV, () => 45); // 初期値をLv45に仮設定
    document.body.appendChild(selectLv);
    document.body.appendChild(document.createElement('br'));

    // 比較実行
    let compareButton = document.createElement('button');
    compareButton.innerText = '比較実行';
    compareButton.className = 'btn btn-primary';
    compareButton.onclick = async () => {
        setSessionStorage(STORAGE_KEY.SELECTED_LV, parseInt(selectLv.value));
        setSessionStorage(STORAGE_KEY.SELECTED_TOMO_ID, selectTomo.value);
        await diffpage(name, selectTomo.value, tomo, parseInt(selectLv.value));
    };
    document.body.appendChild(compareButton);
    document.body.appendChild(document.createElement('br'));

    // フッター
    document.body.appendChild(document.createElement('br'));
    let footer = document.createElement('footer');
    let help = document.createElement('a');
    help.innerText = "ヘルプ(README)";
    help.href = GITHUB_URL;
    let copyright = document.createElement('p');
    copyright.innerText = "製作者: @PopnYnw";
    footer.appendChild(help);
    footer.appendChild(copyright);
    document.body.appendChild(footer);
}

// 公開用関数
export default async () => {
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

    // プレイヤー名とポプともの一覧を取得する
    cleanupHTML();
    showMessage("プレイヤー名の読み込み中・・・");
    let name = await getUserName();
    if (!name) {
        showMessage("プレイヤー名の読み込み時にエラーが発生しました", false, true);
        return
    }
    showMessage("ポプとも一覧の読み込み中・・・");
    let tomo = await getPoptomoList();
    if (!tomo) {
        showMessage("ポプとも一覧の読み込み時にエラーが発生しました", false, true);
        return
    }

    main(name, tomo);
};
