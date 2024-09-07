# 開発手順

## 概要
開発に参加する場合の簡単な手順です。  
誰かに参加してもらうというより、将来自分が手順を思い出すためのメモの意味合いが強いです。  
(github-pagesを使っている都合上、メインアカウントとは別のアカウントで修正作業を行っているため手順がちょっと面倒)

暫定的な手順なので、ガチガチに守る必要はありません。また、必要に応じて変更します。

## 開始準備
1. リポジトリのフォーク

このリポジトリをフォークし、個人の開発環境に開発用のコピーを作成します。  
詳細な手順は公式ドキュメントを参照してください。  
[リポジトリをフォークする](https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)

2. github-pagesの作成

フォークしたあと、動作確認を行います。以下の手順を参考にgithub-pagesを公開してください。
[ブランチからの公開](https://docs.github.com/ja/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-from-a-branch)

3. 動作確認

公開後、自分のリポジトリURLに応じたブックマークレットを作成します。

```
javascript: import("https://自分のアカウント.github.io/Bookmarklet/fullcomboList.js").then(m => m.default(0,0));
```

ツールの動作検証を行い、問題なく動けばOKです。

## 作業ブランチの作成

1. 取り掛かるタスクの決定

githubの[issue](https://github.com/wanau-ynw/Bookmarklet/issues)を確認し、取り掛かりたいタスクを決定します。  
このとき、まだissueが無い修正を行いたい場合、先にissueを作成してください。

2. ブランチの作成

タスク番号に応じたブランチ名で、新規ブランチを作成します。  
名前は`feature-#番号-概要`としてください。

```
例: issue #10 開発ドキュメントの作成
ブランチ名: feature-#10-add-develop-document
```

3. 作業用ブランチのページ公開

開発中は作業用のブランチの動作確認を行う必要があるため、
開始準備の手順を参考に作業用ブランチをgithub-pagesで公開します。

## 開発
タスクの内容に応じた開発を行います。必要に応じて、github-pagesで動作を確認してください。

なお、本資料執筆時点ではツールが参照する各種リソースの基準ディレクトリがハードコードされています(const GITHUB_URL)。  
このため、テスト用にリソースを置き換えたい場合は、ソースを一時的に修正しておく必要があります。要改善。[#17](https://github.com/wanau-ynw/Bookmarklet/issues/17)

コミットメッセージのフォーマットは任意ですが、最後のコミット(issueがクローズできる状態になるコミット)は、`close #xx` というキーワードで開始してください。

## プルリクエスト

開発・テストが完了したら、プルリクエストを発行します。詳細は公式手順を参照  
[pull request の作成](https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)

レビュー結果に問題がなければ、mainブランチにマージされます。

## マージ後の同期

マージが完了したら、開発用環境を最新状況に同期します。詳細は公式手順を参照  
[フォークを同期する](https://docs.github.com/ja/pull-requests/collaborating-with-pull-requests/working-with-forks/syncing-a-fork)
