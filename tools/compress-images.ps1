#Requires -Version 5.1
<#
    難易度表ベース画像(img/c*.jpg, img/f*.jpg)の再圧縮スクリプト。
    ピクセルサイズ(縦横)は変更せず、JPEGの圧縮品質のみを下げてファイル容量を削減する。
    画像を更新した際は、コミット前にこのスクリプトを実行すること。

    JPEGは非可逆圧縮のため、同じファイルに繰り返し実行すると画質が劣化していく。
    これを防ぐため、前回圧縮した時点のファイルハッシュを .compress-state.json に記録し、
    前回から内容が変わっていないファイルはスキップする(-Force で強制的に再圧縮も可能)。
#>
param(
    [string]$Path = (Join-Path $PSScriptRoot "..\img"),
    [string]$Pattern = "^[cf]\d{2}\.jpg$",
    [ValidateRange(1, 100)]
    [int]$Quality = 92,
    [string]$StateFile = (Join-Path $PSScriptRoot ".compress-state.json"),
    [switch]$Force
)

Add-Type -AssemblyName System.Drawing

function Compress-JpegFile {
    param(
        [System.IO.FileInfo]$File,
        [int]$Quality
    )

    $beforeSize = $File.Length
    $bytes = [System.IO.File]::ReadAllBytes($File.FullName)
    $ms = New-Object System.IO.MemoryStream(, $bytes)
    try {
        $img = [System.Drawing.Image]::FromStream($ms)
        try {
            $beforeWidth = $img.Width
            $beforeHeight = $img.Height

            $jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
                Where-Object { $_.MimeType -eq 'image/jpeg' }
            $encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
            $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
                [System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)

            $tmpPath = "$($File.FullName).tmp"
            $img.Save($tmpPath, $jpegCodec, $encParams)
        }
        finally {
            $img.Dispose()
        }
    }
    finally {
        $ms.Dispose()
    }

    # ピクセルサイズが変わっていないことを確認してから置き換える(描画ロジックへの影響防止)
    $checkImg = [System.Drawing.Image]::FromFile($tmpPath)
    $afterWidth = $checkImg.Width
    $afterHeight = $checkImg.Height
    $checkImg.Dispose()

    if ($afterWidth -ne $beforeWidth -or $afterHeight -ne $beforeHeight) {
        Remove-Item $tmpPath -Force
        throw "$($File.Name): 圧縮前後でピクセルサイズが変化しました ($beforeWidth x $beforeHeight -> $afterWidth x $afterHeight)。中断します。"
    }

    Move-Item -Path $tmpPath -Destination $File.FullName -Force
    $afterSize = (Get-Item $File.FullName).Length

    [PSCustomObject]@{
        Name       = $File.Name
        BeforeKB   = [math]::Round($beforeSize / 1KB, 1)
        AfterKB    = [math]::Round($afterSize / 1KB, 1)
        ReductionP = [math]::Round((1 - ($afterSize / $beforeSize)) * 100, 1)
    }
}

# 前回実行時の状態(ファイル名 -> 圧縮後ハッシュ)を読み込む
$state = @{}
if (Test-Path $StateFile) {
    $loaded = Get-Content $StateFile -Raw | ConvertFrom-Json
    $loaded.PSObject.Properties | ForEach-Object { $state[$_.Name] = $_.Value }
}

$targetFiles = Get-ChildItem -Path $Path -File | Where-Object { $_.Name -match $Pattern }

if (-not $targetFiles) {
    Write-Warning "対象ファイルが見つかりませんでした (Path: $Path, Pattern: $Pattern)"
    return
}

$results = @()
foreach ($file in $targetFiles) {
    $currentHash = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
    if (-not $Force -and $state[$file.Name] -eq $currentHash) {
        Write-Host "スキップ(前回圧縮時から変更なし): $($file.Name)"
        continue
    }

    Write-Host "圧縮中: $($file.Name)"
    $results += Compress-JpegFile -File $file -Quality $Quality
    $state[$file.Name] = (Get-FileHash -Path $file.FullName -Algorithm SHA256).Hash
}

$state | ConvertTo-Json | Set-Content -Path $StateFile -Encoding UTF8

if ($results.Count -eq 0) {
    Write-Host "圧縮対象はありませんでした(すべて前回から変更なし)"
    return
}

$results | Format-Table -AutoSize
$totalBefore = ($results | Measure-Object -Property BeforeKB -Sum).Sum
$totalAfter = ($results | Measure-Object -Property AfterKB -Sum).Sum
Write-Host "合計: $totalBefore KB -> $totalAfter KB"
