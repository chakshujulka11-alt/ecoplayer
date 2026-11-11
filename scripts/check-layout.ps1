# Layout verification: emulates CSS viewports (100%/125%/150% Windows scaling
# on a 1280px screen) and checks for horizontal overflow, sidebar alignment,
// and clipped headings on each route.
param(
  [int]$Port = 9321
)

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Dell\Desktop\myownplayer2'
$p = Start-Process -FilePath "$root\node_modules\electron\dist\electron.exe" `
  -ArgumentList 'out/main/index.js', "--remote-debugging-port=$Port" `
  -WorkingDirectory $root -PassThru
try {
  Start-Sleep -Seconds 14
  $targets = (Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json" -UseBasicParsing | ConvertFrom-Json)
  $page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $ws.ConnectAsync($page.webSocketDebuggerUrl, $ct).Wait()
  $script:msgId = 0
  function Invoke-Cdp([string]$Method, [hashtable]$Params) {
    $script:msgId++
    $payload = (@{ id = $script:msgId; method = $Method; params = $Params } | ConvertTo-Json -Compress -Depth 6)
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)),
      [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $buf = New-Object byte[] 65536
    $r = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)), $ct).Result
    return [Text.Encoding]::UTF8.GetString($buf, 0, $r.Count)
  }
  function EvalWs([string]$Expression) {
    $payload = (@{ id = (++$script:msgId); method = 'Runtime.evaluate';
      params = @{ expression = $Expression; returnByValue = $true; awaitPromise = $true }
    } | ConvertTo-Json -Compress -Depth 5)
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)),
      [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $buf = New-Object byte[] 65536
    $r = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)), $ct).Result
    return [Text.Encoding]::UTF8.GetString($buf, 0, $r.Count)
  }
  $measure = @'
(function(){
  var main = document.querySelector('main');
  var aside = document.querySelector('aside');
  var h1 = document.querySelector('main h1');
  var mr = main.getBoundingClientRect();
  var ar = aside.getBoundingClientRect();
  var hr = h1 ? h1.getBoundingClientRect() : null;
  return JSON.stringify({
    vw: window.innerWidth, vh: window.innerHeight,
    docSW: document.documentElement.scrollWidth,
    bodySW: document.body.scrollWidth,
    main: { x: Math.round(mr.x), w: Math.round(mr.width), sw: main.scrollWidth, cw: main.clientWidth },
    aside: { w: Math.round(ar.width), right: Math.round(ar.right) },
    h1: hr ? { x: Math.round(hr.x), right: Math.round(hr.right), top: Math.round(hr.top) } : null
  });
})()
'@
  $sizes = @(@{ w = 1280; h = 720 }, @{ w = 1024; h = 576 }, @{ w = 853; h = 480 })
  $routes = @('#/', '#/library', '#/settings')
  foreach ($size in $sizes) {
    Invoke-Cdp 'Emulation.setDeviceMetricsOverride' @{
      width = $size.w; height = $size.h; deviceScaleFactor = 1; mobile = $false
    } | Out-Null
    Start-Sleep -Seconds 1
    foreach ($route in $routes) {
      EvalWs "location.hash='$route'" | Out-Null
      Start-Sleep -Seconds 2
      $result = EvalWs $measure
      "SIZE $($size.w)x$($size.h) ROUTE $route => $result"
    }
  }
  $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, '', $ct).Wait()
}
finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
'layout-check-done'
