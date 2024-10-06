## pop’n music アーケード版 情報管理ツール
ポップンミュージック公式サイトのプレイデータをまとめて表示するツールです。  
詳細は各ツールの説明を参照してください。

- [フルコン難易度表 自動記入ツール](#フルコン難易度表自動記入ツール)
- [ポプとも比較ツール](#ポプとも比較ツール)

[※うまく動かないときに確認すること](#うまく動かないときに確認すること)  
[注意事項など](#注意)  

## フルコン難易度表自動記入ツール

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

### 参考 - 個別の難易度表への直リンクスクリプト

以下の"詳細"をクリックすると表示されます
<details>
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
</details>

## ポプとも比較ツール
説明書はまだ書けてません

### 使い方

1. 以下の文字列(スクリプト)をブラウザのブックマークに追加する
2. ポップンのサイトにログインして、1で追加したブックマークをクリックする

```
javascript: import("https://wanau-ynw.github.io/Bookmarklet/poptomo.js").then(m => m.default());
```

## うまく動かないときに確認すること

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

### 開発への参加について
本ツールのバグ修正や改善など、開発に参加する場合は以下の手順を参照してください。  
[doc/how-to-develop.md](doc/how-to-develop.md)