# CDP E2E helper: launches the built app, runs probe expressions, kills the app.
param(
  [int]$Port = 9250,
  [string]$ProbeFile = '',
  [string]$Probe = '',
  [int]$WarmupSeconds = 14,
  [string]$Hash = '#/library',
  [int]$SettleSeconds = 2
)

$ErrorActionPreference = 'Stop'
$root = 'C:\Users\Dell\Desktop\myownplayer2'
$p = Start-Process -FilePath "$root\node_modules\electron\dist\electron.exe" `
  -ArgumentList 'out/main/index.js', "--remote-debugging-port=$Port" `
  -WorkingDirectory $root -PassThru
try {
  Start-Sleep -Seconds $WarmupSeconds
  $targets = (Invoke-WebRequest -Uri "http://127.0.0.1:$Port/json" -UseBasicParsing | ConvertFrom-Json)
  $page = $targets | Where-Object { $_.type -eq 'page' } | Select-Object -First 1
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = [System.Threading.CancellationToken]::None
  $ws.ConnectAsync($page.webSocketDebuggerUrl, $ct).Wait()
  $script:msgId = 0
  function Invoke-Cdp([string]$Expression) {
    $script:msgId++
    $payload = (@{
      id = $script:msgId; method = 'Runtime.evaluate'
      params = @{ expression = $Expression; returnByValue = $true; awaitPromise = $true }
    } | ConvertTo-Json -Compress -Depth 5)
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $bytes)),
      [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $buf = New-Object byte[] 65536
    $r = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(, $buf)), $ct).Result
    return [Text.Encoding]::UTF8.GetString($buf, 0, $r.Count)
  }
  if ($Hash) { Invoke-Cdp "location.hash='$Hash'" | Out-Null; Start-Sleep -Seconds $SettleSeconds }
  $probes = @()
  if ($ProbeFile -ne '') { $probes = Get-Content $ProbeFile }
  elseif ($Probe -ne '') { $probes = @($Probe) }
  foreach ($probe in $probes) { Invoke-Cdp $probe }
  $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, '', $ct).Wait()
}
finally {
  Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Get-Process electron -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}
'cdp-done'
