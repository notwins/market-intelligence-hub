$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'owner/read-up')
Write-Host 'Open http://127.0.0.1:8794/ for your private reading desk. Stop with Ctrl+C.'
python server.py
