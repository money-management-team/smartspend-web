# Regenerates the Mobile PWA icons in src/mobile/pwa/icons/ from public/smart-spend-logo.png.
#   powershell -ExecutionPolicy Bypass -File scripts/generateMobileIcons.ps1
# The PNGs are committed; this script only documents (and repeats) how they were made. The build
# never runs it: scripts/mobileEntryPlugin.mjs copies the committed files when the PWA is on.
#
#   icon-192.png / icon-512.png      purpose "any": the logo on white, about 80% of the square
#   icon-maskable-512.png            purpose "maskable": full-bleed white, the logo inside the
#                                    central 60% so a circular or squircle mask never cuts it
#   apple-touch-icon.png (180 px)    opaque (iOS fills transparency with black), same padding as "any"
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$logo = [System.Drawing.Image]::FromFile((Join-Path $root "public/smart-spend-logo.png"))
$out = Join-Path $root "src/mobile/pwa/icons"
New-Item -ItemType Directory -Force $out | Out-Null

function New-Icon([int]$size, [double]$fill, [string]$name) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [System.Drawing.Graphics]::FromImage($bitmap)
  $g.SmoothingMode = "HighQuality"; $g.InterpolationMode = "HighQualityBicubic"; $g.PixelOffsetMode = "HighQuality"
  $g.Clear([System.Drawing.Color]::White)
  $scale = ($size * $fill) / [Math]::Max($logo.Width, $logo.Height)
  $w = $logo.Width * $scale; $h = $logo.Height * $scale
  $g.DrawImage($logo, ($size - $w) / 2, ($size - $h) / 2, $w, $h)
  $g.Dispose()
  $bitmap.Save((Join-Path $out $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

New-Icon 192 0.80 "icon-192.png"
New-Icon 512 0.80 "icon-512.png"
New-Icon 512 0.60 "icon-maskable-512.png"
New-Icon 180 0.80 "apple-touch-icon.png"
$logo.Dispose()
