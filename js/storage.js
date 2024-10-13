/**
 * ローカルストレージの管理用バージョン。
 * このバージョンと、保存されているデータのバージョンが異なる場合は古い形式なので、
 * 必要に応じてデータを再取得する
 */
const STORAGE_VER = 1

/**
 * セッションストレージのデータを取得または新規作成して保存する
 * @param {*} key 
 * @param {*} createDataFunc 
 * @returns 
 */
async function getSessionStorage(key, createDataFunc) {
  let data = sessionStorage.getItem(key);
  if (data === null) {
    let newData = await Promise.resolve(createDataFunc()); // 同期関数・非同期関数どちらが渡されてもいいように。
    let jsondata = JSON.stringify(newData);
    sessionStorage.setItem(key, jsondata);
    console.log("save sessionStorage : " + key + " : about " + jsondata.length + "byte");
    data = newData;
  } else {
    console.log("load sessionStorage : " + key);
    data = JSON.parse(data);
  }
  return data;
}

function setSessionStorage(key, data) {
  sessionStorage.setItem(key, JSON.stringify(data));
}

/**
 * ローカルストレージのデータを取得または新規作成して保存する
 * ただし、以下の条件の時は保存されたデータがあっても新規作成する
 * - 前回保存から１週間以上経過している
 * - バージョンが変わっている
 */
async function getLocalStorage(key, createDataFunc) {
    let data = localStorage.getItem(key);
    if (data) {
        // データがあった場合、期限やバージョンの条件をチェック
        data = JSON.parse(data);
        if (!('version' in data) || (data.version != STORAGE_VER)) {
            console.log("localStorage version mismatch");
            data = null;
        } else if (!('timestamp' in data)) {
            console.log("localStorage timestamp not found");
            data = null;
        } else {
            let savedTimestamp = new Date(data.timestamp).getTime();
            let oneWeekAgo = new Date().getTime() - (7 * 24 * 60 * 60 * 1000);
            let savedTimeStr = new Date(data.timestamp).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
            if (savedTimestamp < oneWeekAgo) {
                console.log("localStorage timestamp too old: " + savedTimeStr);
                data = null;
            }else{
                console.log(`hit localStorage ${savedTimeStr} v${data.version} : ${key}`);
                data = data.value;
            }
        }
    }
    if (data === null) {
        // データがなければ、新規作成して登録
        data = await Promise.resolve(createDataFunc()); // 同期関数・非同期関数どちらが渡されてもいいように。
        setLocalStorage(key, data);
    }
    return data;
}

function setLocalStorage(key, data) {
    let obj = { value: data, timestamp: new Date().getTime(), version: STORAGE_VER }
    obj = JSON.stringify(obj);
    localStorage.setItem(key, obj);
    console.log("save localStorage : " + key + " : about " + obj.length + "byte");
}