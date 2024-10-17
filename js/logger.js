/**
 * logger.js
 * 
 * 動作ログの表示管理用関数群
 */

/**
 * 画面を消去する
 */
async function cleanupHTML() {
  document.body.innerHTML = "";
}

/**
 * 画面上に文字を表示する
 * @param {*} txt 表示したい文字列
 * @param {*} clean 表示の前に画面を消すかどうか
 * @param {*} error エラーメッセージか
 */
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

async function deleteLastMessage() {
  let content = document.body.innerHTML;
  let lines = content.split('<br>');
  // 最後の要素が空の場合、それを削除
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  lines.pop();
  document.body.innerHTML = lines.join('<br>') + "<br>";
}

async function replaceLastMessage(txt) {
  await deleteLastMessage();
  await showMessage(txt);
}