@echo off
rem 難易度表ベース画像(img/c*.jpg, img/f*.jpg)を再圧縮する。
rem 画像を更新した際は、コミット前にこれを実行すること。
rem 品質を変えたい場合は引数で指定する 例: compress-images.bat -Quality 80

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0compress-images.ps1" %*

echo.
pause
