# Builds the single-file app from src/:
#   PCB-Kaardistaja.html  - standalone page (double-click to open)
#   build/artifact.html   - same page without the document wrapper (for publishing)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object System.Text.UTF8Encoding($false)
$tpl = [IO.File]::ReadAllText((Join-Path $root 'src/index.html'), $utf8)
$css = [IO.File]::ReadAllText((Join-Path $root 'src/app.css'), $utf8)
$parts = Get-ChildItem (Join-Path $root 'src/js') -Filter *.js | Sort-Object Name | ForEach-Object { [IO.File]::ReadAllText($_.FullName, $utf8) }
$js = "(() => {`n'use strict';`n" + ($parts -join "`n") + "`n})();"
if ($js.Contains('</script')) { throw 'JS contains a closing script tag' }
$frag = $tpl.Replace('/*@CSS*/', $css).Replace('/*@JS*/', $js)
New-Item -ItemType Directory -Force (Join-Path $root 'build') | Out-Null
[IO.File]::WriteAllText((Join-Path $root 'build/artifact.html'), $frag, $utf8)
$page = "<!doctype html>`n<html lang=`"et`">`n<head>`n<meta charset=`"utf-8`">`n<meta name=`"viewport`" content=`"width=device-width,initial-scale=1,viewport-fit=cover`">`n</head>`n<body>`n" + $frag + "`n</body>`n</html>`n"
[IO.File]::WriteAllText((Join-Path $root 'PCB-Kaardistaja.html'), $page, $utf8)
"Built: PCB-Kaardistaja.html ($([math]::Round($page.Length/1KB)) KB) and build/artifact.html"
