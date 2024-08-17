## フルコン難易度表 自動記入ツール

### 概要
ポップンのフルコン難易度表やクリア難易度表に、自動でマークを付けるツールです。  

### 使い方
基本的には、ポックラ一覧を出すツールと同じです。

1. 以下の文字列(スクリプト)をブラウザのブックマークに追加する
2. ポップンのサイトにログインして、1で追加したブックマークをクリックする
3. 表示したい一覧の種類を選択する  
※ それぞれの一覧表を直接表示するブックマークを作りたい場合は、後述するスクリプトを登録してください

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(0,0));
```

### うまく動かないときに確認すること

* 前提条件
e-amusement ベーシックコース に加入済みで、公式サイトから自分のプレーデータが見れる状況になっている必要があります。

* ブラウザのブックマークに登録する方法がわからない場合  
適当なWebサイトをお気に入りに登録してから、登録されたお気に入りを編集してURLや名前を書き換えてみてください

* Androidのchromeの場合
上記手順では動かない場合があります。  
Chromeの画面上部にあるURLバーに、ブックマーク登録名を直接入力してから選択すると動くと思います

### 注意
本ツールはjavascriptで作成されていますが、作者はあまり得意ではない言語なのでソースの品質が低いです。  
バグなどを見つけた場合、報告していただけると助かります。  
連絡先: @PopnYnw

### 参考 - 個別の難易度表への直リンクスクリプト

* Lv47 クリア難易度表

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(47,2));
```

* Lv48 クリア難易度表

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(48,2));
```

* Lv49 クリア難易度表

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(49,2));
```

* Lv50 クリア難易度表

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(50,2));
```

* Lv46 フルコン難易度表

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(46));
```

* Lv47 フルコン難易度表

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(47));
```
