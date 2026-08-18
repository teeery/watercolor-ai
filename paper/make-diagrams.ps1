# 论文配图：系统分工图 + 六部架构图
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "figures"

function New-Canvas([int]$w, [int]$h) {
    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    return @($bmp, $g)
}

function Draw-Box($g, [float]$x, [float]$y, [float]$w, [float]$h, [string]$title, [string[]]$lines, $fill, $border) {
    $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
    $bFill = New-Object System.Drawing.SolidBrush($fill)
    $pBorder = New-Object System.Drawing.Pen($border, 2)
    $g.FillRectangle($bFill, $rect)
    $g.DrawRectangle($pBorder, $x, $y, $w, $h)
    $fTitle = New-Object System.Drawing.Font("Microsoft YaHei", 15, [System.Drawing.FontStyle]::Bold)
    $fBody = New-Object System.Drawing.Font("Microsoft YaHei", 11, [System.Drawing.FontStyle]::Regular)
    $bText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(30, 30, 30))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Near
    $g.DrawString($title, $fTitle, $bText, [System.Drawing.RectangleF]::new($x, $y + 8, $w, 26), $sf)
    $ly = $y + 40
    foreach ($line in $lines) {
        $g.DrawString($line, $fBody, $bText, [System.Drawing.RectangleF]::new($x + 6, $ly, $w - 12, 20), $sf)
        $ly += 20
    }
    $fTitle.Dispose(); $fBody.Dispose(); $bText.Dispose(); $sf.Dispose(); $bFill.Dispose(); $pBorder.Dispose()
}

function Draw-Arrow($g, $p1, $p2, [string]$label, $color) {
    $pen = New-Object System.Drawing.Pen($color, 3)
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
    $g.DrawLine($pen, $p1[0], $p1[1], $p2[0], $p2[1])
    $pen.Dispose()
    if ($label -ne "") {
        $mx = ($p1[0] + $p2[0]) / 2; $my = ($p1[1] + $p2[1]) / 2
        $bBack = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
        $g.FillRectangle($bBack, [System.Drawing.RectangleF]::new($mx - 78, $my - 14, 156, 26))
        $bBack.Dispose()
        $f = New-Object System.Drawing.Font("Microsoft YaHei", 11, [System.Drawing.FontStyle]::Regular)
        $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 60, 60))
        $sf = New-Object System.Drawing.StringFormat
        $sf.Alignment = [System.Drawing.StringAlignment]::Center
        $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
        $g.DrawString($label, $f, $b, [System.Drawing.RectangleF]::new($mx - 78, $my - 14, 156, 26), $sf)
        $f.Dispose(); $b.Dispose(); $sf.Dispose()
    }
}

# ================= 图1：三权分立与反馈闭环 =================
$bmp, $g = New-Canvas 1500 760
Draw-Box $g 60 150 330 150 "LLM 意图层" @("构图 · 笔序 · 色彩理论 · 技法", "只发 stroke 指令，不产图像") ([System.Drawing.Color]::FromArgb(232, 242, 254)) ([System.Drawing.Color]::FromArgb(70, 120, 200))
Draw-Box $g 585 150 330 150 "介质引擎（core）" @("湿扩散 · 边缘沉积 · 回流开花", "颗粒聚集 · 干燥时间线", "忠实渲染水行为，不越权构图") ([System.Drawing.Color]::FromArgb(232, 246, 234)) ([System.Drawing.Color]::FromArgb(80, 150, 100))
Draw-Box $g 1110 150 330 150 "眼睛（vision 批评）" @("看真实画布（不是意图）", "局部批评 → 下一笔 / 撤一笔") ([System.Drawing.Color]::FromArgb(254, 242, 232)) ([System.Drawing.Color]::FromArgb(200, 130, 70))
Draw-Box $g 585 470 330 150 "时间线（叙事）" @("每笔带时间戳 · 湿区自己干", "过程 = 产品：可看 / 可停 / 可问") ([System.Drawing.Color]::FromArgb(246, 236, 254)) ([System.Drawing.Color]::FromArgb(140, 90, 180))
Draw-Box $g 60 470 330 150 "人（观众 / 画家）" @("观看过程 · 提问 · 亲手加一笔", "品味是唯一神谕") ([System.Drawing.Color]::FromArgb(240, 240, 240)) ([System.Drawing.Color]::FromArgb(110, 110, 110))
Draw-Arrow $g @(390, 225) @(585, 225) "stroke 协议" ([System.Drawing.Color]::FromArgb(70, 120, 200))
Draw-Arrow $g @(915, 280) @(1110, 240) "阶段快照" ([System.Drawing.Color]::FromArgb(80, 150, 100))
# 眼睛 → LLM：沿顶边绕行，避开引擎盒
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 130, 70), 3)
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
$pts = @([System.Drawing.PointF]::new(1240, 150), [System.Drawing.PointF]::new(1240, 90), [System.Drawing.PointF]::new(225, 90), [System.Drawing.PointF]::new(225, 150))
$g.DrawLines($pen, $pts)
$pen.Dispose()
$bBack = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$g.FillRectangle($bBack, [System.Drawing.RectangleF]::new(655, 76, 150, 26)); $bBack.Dispose()
$f = New-Object System.Drawing.Font("Microsoft YaHei", 11, [System.Drawing.FontStyle]::Regular)
$b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(60, 60, 60))
$sf = New-Object System.Drawing.StringFormat
$sf.Alignment = [System.Drawing.StringAlignment]::Center
$sf.LineAlignment = [System.Drawing.StringAlignment]::Center
$g.DrawString("批评 / 改笔", $f, $b, [System.Drawing.RectangleF]::new(655, 76, 150, 26), $sf)
$f.Dispose(); $b.Dispose(); $sf.Dispose()
Draw-Arrow $g @(750, 300) @(750, 470) "蒸发 · 干燥" ([System.Drawing.Color]::FromArgb(140, 90, 180))
Draw-Arrow $g @(585, 545) @(393, 545) "观看 / 提问" ([System.Drawing.Color]::FromArgb(90, 90, 90))
$g.Dispose(); $bmp.Save((Join-Path $outDir "fig_division.png"), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Write-Output "wrote fig_division.png"

# ================= 图2：六部架构与升级缝 =================
$bmp, $g = New-Canvas 1500 860
Draw-Box $g 585 60 330 110 "studio（编排装配）" @("demo 与 agent 层的唯一依赖") ([System.Drawing.Color]::FromArgb(240, 240, 240)) ([System.Drawing.Color]::FromArgb(90, 90, 90))
Draw-Box $g 60 300 300 130 "core 介质核心" @("九步管线 · 回流算子 · 岸线", "通道数泛化，不知通道何义") ([System.Drawing.Color]::FromArgb(232, 246, 234)) ([System.Drawing.Color]::FromArgb(80, 150, 100))
Draw-Box $g 585 300 330 130 "color 颜色系统" @("ColorSystem 接口", "RGB 3 通道 ↔ 光谱 16 波段", "升级缝：换模型不动引擎") ([System.Drawing.Color]::FromArgb(246, 236, 254)) ([System.Drawing.Color]::FromArgb(140, 90, 180))
Draw-Box $g 1110 300 330 130 "brush 笔触" @("StrokePainter 形状层", "笔刷动力学 v2", "升级缝：换运笔不动引擎") ([System.Drawing.Color]::FromArgb(232, 242, 254)) ([System.Drawing.Color]::FromArgb(70, 120, 200))
Draw-Box $g 60 560 300 110 "paper 纸纹" @("噪声 · 高度 · 容量 · 纤维场") ([System.Drawing.Color]::FromArgb(254, 248, 232)) ([System.Drawing.Color]::FromArgb(200, 170, 70))
Draw-Box $g 585 560 330 110 "io PNG / GIF" @("PNG 编码 · GIF LZW 编码器") ([System.Drawing.Color]::FromArgb(250, 240, 240)) ([System.Drawing.Color]::FromArgb(180, 90, 90))
Draw-Box $g 1110 560 330 110 "demo / agent" @("场景 · 运行器 · 评价锚") ([System.Drawing.Color]::FromArgb(240, 246, 240)) ([System.Drawing.Color]::FromArgb(90, 140, 90))
Draw-Arrow $g @(680, 170) @(210, 300) "" ([System.Drawing.Color]::FromArgb(90, 90, 90))
Draw-Arrow $g @(750, 170) @(750, 300) "" ([System.Drawing.Color]::FromArgb(90, 90, 90))
Draw-Arrow $g @(820, 170) @(1275, 300) "" ([System.Drawing.Color]::FromArgb(90, 90, 90))
Draw-Arrow $g @(210, 430) @(210, 560) "" ([System.Drawing.Color]::FromArgb(90, 90, 90))
Draw-Arrow $g @(1275, 430) @(1275, 560) "" ([System.Drawing.Color]::FromArgb(90, 90, 90))
Draw-Arrow $g @(1110, 615) @(918, 615) "" ([System.Drawing.Color]::FromArgb(90, 90, 90))
$g.Dispose(); $bmp.Save((Join-Path $outDir "fig_arch.png"), [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
Write-Output "wrote fig_arch.png"