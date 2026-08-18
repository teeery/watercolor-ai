# 论文配图生成脚本：从 GIF / 逐笔快照抽取序列帧并拼成条带图
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

function Get-GifFrames([string]$path) {
    $img = [System.Drawing.Image]::FromFile($path)
    $dim = [System.Drawing.Imaging.FrameDimension]::Time
    $n = $img.GetFrameCount($dim)
    $list = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'
    for ($i = 0; $i -lt $n; $i++) {
        [void]$img.SelectActiveFrame($dim, $i)
        $bmp = New-Object System.Drawing.Bitmap($img.Width, $img.Height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        [void]$g.DrawImage($img, 0, 0, $img.Width, $img.Height)
        $g.Dispose()
        $list.Add($bmp)
    }
    $img.Dispose()
    return ,$list.ToArray()
}

function Compose-Grid([System.Drawing.Bitmap[]]$frames, [string[]]$labels, [string]$outPath, [int]$cols, [int]$cellW, [int]$cellH, [int]$labelH, [string]$fontName) {
    $rows = [math]::Ceiling($frames.Count / $cols)
    $pad = 6
    $gap = 4
    $W = $pad * 2 + $cols * $cellW + ($cols - 1) * $gap
    $H = $pad * 2 + $rows * ($cellH + $labelH + $gap)
    $canvas = New-Object System.Drawing.Bitmap($W, $H)
    $g = [System.Drawing.Graphics]::FromImage($canvas)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $font = New-Object System.Drawing.Font($fontName, 13, [System.Drawing.FontStyle]::Regular)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30,30,30))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    for ($i = 0; $i -lt $frames.Count; $i++) {
        $r = [math]::Floor($i / $cols); $c = $i % $cols
        $x = $pad + $c * ($cellW + $gap)
        $y = $pad + $r * ($cellH + $labelH + $gap)
        # 等比缩放并居中
        $src = $frames[$i]
        $scale = [math]::Min($cellW / $src.Width, $cellH / $src.Height)
        $dw = [int]($src.Width * $scale); $dh = [int]($src.Height * $scale)
        $dx = $x + [int](($cellW - $dw) / 2); $dy = $y + [int](($cellH - $dh) / 2)
        $g.DrawImage($src, $dx, $dy, $dw, $dh)
        $ly = $y + $cellH + [int]($gap / 2)
        $g.DrawString($labels[$i], $font, $brush, (New-Object System.Drawing.RectangleF($x, $ly, $cellW, $labelH)), $sf)
    }
    $g.Dispose(); $font.Dispose(); $brush.Dispose(); $sf.Dispose()
    $canvas.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $canvas.Dispose()
    Write-Output "wrote $outPath ($W x $H)"
}

$outDir = Join-Path $PSScriptRoot "figures"
$fontName = "Microsoft YaHei"

# ============ 图：三个柿子 作画序列（agent_evolution.gif，148 帧） ============
$frames = Get-GifFrames (Join-Path $PSScriptRoot "..\out\agent_evolution.gif")
$pickIdx = @(8, 28, 48, 68, 88, 108, 128, 147)  # 0-based 索引，均匀取 8 帧（首帧略过全空的开头）
$picked = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'; $labels = @()
foreach ($i in $pickIdx) {
    $picked.Add($frames[$i])
    $pct = [math]::Round(($i + 1) * 100.0 / $frames.Count)
    $labels += ("帧 " + ($i + 1) + "/" + $frames.Count + " (" + $pct + "%)")
}
Compose-Grid $picked.ToArray() $labels (Join-Path $outDir "seq_still_life.png") 4 300 225 24 $fontName
foreach ($f in $frames) { $f.Dispose() }

# ============ 图：乡村田野 临摹笔序（copy-frames/stroke_XXX.png，83 笔） ============
$strokeIdx = @(6, 12, 18, 26, 33, 45, 57, 67, 74, 83)  # 关键里程碑笔
$picked = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'; $labels = @()
foreach ($s in $strokeIdx) {
    $p = Join-Path $PSScriptRoot ("..\out\copy-frames\stroke_{0:D3}.png" -f $s)
    $picked.Add([System.Drawing.Bitmap][System.Drawing.Image]::FromFile($p))
    $labels += ("第 " + $s + " 笔")
}
Compose-Grid $picked.ToArray() $labels (Join-Path $outDir "seq_field.png") 5 190 253 22 $fontName
foreach ($f in $picked) { $f.Dispose() }

# ============ 图：干燥时间线（agent_drying.gif 30 帧 → 取 7 帧横排） ============
$frames = Get-GifFrames (Join-Path $PSScriptRoot "..\out\agent_drying.gif")
$pickIdx = @(0, 5, 10, 15, 20, 25, 29)
$picked = New-Object 'System.Collections.Generic.List[System.Drawing.Bitmap]'; $labels = @()
foreach ($i in $pickIdx) {
    $picked.Add($frames[$i])
    $labels += ("帧 " + ($i + 1) + "/" + $frames.Count)
}
Compose-Grid $picked.ToArray() $labels (Join-Path $outDir "seq_drying.png") 7 165 124 20 $fontName
foreach ($f in $frames) { $f.Dispose() }

Write-Output "ALL DONE"
