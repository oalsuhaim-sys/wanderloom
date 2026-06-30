param(
  [int]$Size = 0
)

Add-Type -AssemblyName System.Drawing

function New-WanderloomIcon {
  param(
    [int]$IconSize,
    [string]$OutputPath
  )

  $bitmap = New-Object System.Drawing.Bitmap $IconSize, $IconSize
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(17, 17, 17))

  $goldBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(205, 160, 76))
  $margin = [int]($IconSize * 0.16)
  $graphics.FillEllipse($goldBrush, $margin, $margin, $IconSize - (2 * $margin), $IconSize - (2 * $margin))

  $font = New-Object System.Drawing.Font('Segoe UI', [int]($IconSize * 0.3), [System.Drawing.FontStyle]::Bold)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $darkBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(17, 17, 17))
  $rect = New-Object System.Drawing.RectangleF 0, 0, $IconSize, $IconSize
  $graphics.DrawString('W', $font, $darkBrush, $rect, $format)

  $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

$root = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $root 'public'

if ($Size -gt 0) {
  New-WanderloomIcon -IconSize $Size -OutputPath (Join-Path $publicDir "icon-$Size.png")
} else {
  New-WanderloomIcon -IconSize 192 -OutputPath (Join-Path $publicDir 'icon-192.png')
  New-WanderloomIcon -IconSize 512 -OutputPath (Join-Path $publicDir 'icon-512.png')
}
