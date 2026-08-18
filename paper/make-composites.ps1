# 论文配图：合成多面板图
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$fig = Join-Path $PSScriptRoot "figures"

function Compose-Row([string[]]$srcs, [string[]]$labels, [string]$out, [int]$cellH, [int]$pad = 10, [int]$gap = 6, [int]$labelH = 22) {
    $imgs = @()
    foreach ($s in $srcs) { $imgs += [System.Drawing.Bitmap][System.Drawing.Image]::FromFile($s) }
    $totalW = $pad * 2 + ($imgs.Count - 1) * $gap
    foreach ($im in $imgs) {
        $scale = $cellH / $im.Height
        $totalW += [int]($im.Width * $scale)
    }
    $H = $pad * 2 + $cellH + $labelH
    $canvas = New-Object System.Drawing.Bitmap($totalW, $H)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $x = $pad
    $f = New-Object System.Drawing.Font("Microsoft YaHei", 12, [System.Drawing.FontStyle]::Regular)
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 30, 30))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    for ($i = 0; $i -lt $imgs.Count; $i++) {
        $im = $imgs[$i]
        $scale = $cellH / $im.Height
        $dw = [int]($im.Width * $scale); $dh = [int]($im.Height * $scale)
        $g.DrawImage($im, $x, $pad, $dw, $dh)
        $g.DrawString($labels[$i], $f, $b, [System.Drawing.RectangleF]::new($x, $pad + $cellH, $dw, $labelH), $sf)
        $x += $dw + $gap
        $im.Dispose()
    }
    $g.Dispose(); $f.Dispose(); $b.Dispose(); $sf.Dispose()
    $canvas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Output "wrote $out ($totalW x $H)"
}

# 感知签名三件套（回流开花 / 岸线三层 / 颗粒聚集）
Compose-Row @(
    (Join-Path $fig "fig_bloom.png"),
    (Join-Path $fig "fig_shoreline.png"),
    (Join-Path $fig "fig_granulation.png")
) @("(a) 回流开花", "(b) 岸线三层结构", "(c) 颗粒聚集") (Join-Path $fig "fig_signatures.png") 300

# 扩展技法 8 格（4×2）
$srcs = @("fig_anisotropy.png","fig_macro.png","fig_gravity.png","fig_mixing.png","fig_paper.png","fig_hardedge.png","fig_salt.png","fig_lift.png")
$labels = @("(a) 各向异性纸纹","(b) 宏观破圆","(c) 重力淌色","(d) 湿中混色","(e) 纸纹三档","(f) 硬边 vs 软边","(g) 盐花","(h) 洗色堆挤")
$imgs = @(); foreach ($s in $srcs) { $imgs += [System.Drawing.Bitmap][System.Drawing.Image]::FromFile((Join-Path $fig $s)) }
$cols = 4; $rows = 2; $cellW = 330; $cellH = 240; $pad = 10; $gap = 6; $labelH = 20
$W = $pad * 2 + $cols * $cellW + ($cols - 1) * $gap
$H = $pad * 2 + $rows * ($cellH + $labelH + $gap)
$canvas = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($canvas)
$g.Clear([System.Drawing.Color]::White)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$f = New-Object System.Drawing.Font("Microsoft YaHei", 12, [System.Drawing.FontStyle]::Regular)
$b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 30, 30))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
for ($i = 0; $i -lt $imgs.Count; $i++) {
    $r = [math]::Floor($i / $cols); $c = $i % $cols
    $x = $pad + $c * ($cellW + $gap); $y = $pad + $r * ($cellH + $labelH + $gap)
    $im = $imgs[$i]
    $scale = [math]::Min($cellW / $im.Width, $cellH / $im.Height)
    $dw = [int]($im.Width * $scale); $dh = [int]($im.Height * $scale)
    $g.DrawImage($im, $x + [int](($cellW - $dw) / 2), $y + [int](($cellH - $dh) / 2), $dw, $dh)
    $g.DrawString($labels[$i], $f, $b, [System.Drawing.RectangleF]::new($x, $y + $cellH, $cellW, $labelH), $sf)
    $im.Dispose()
}
$g.Dispose(); $f.Dispose(); $b.Dispose(); $sf.Dispose()
$canvas.Save((Join-Path $fig "fig_showcase_grid.png"), [System.Drawing.Imaging.ImageFormat]::Png); $canvas.Dispose()
Write-Output "wrote fig_showcase_grid.png ($W x $H)"

# 乡村田野：原作 vs 引擎临摹（并排）
Compose-Row @(
    (Join-Path $fig "fig_field_original.png"),
    (Join-Path $fig "fig_field_final.png")
) @("(a) 原作（临摹参照）", "(b) 引擎临摹终稿（83 笔）") (Join-Path $fig "fig_field_pair.png") 700
