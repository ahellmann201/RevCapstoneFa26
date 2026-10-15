# Personal database SSH tunnel.
# Leave this terminal open while using the database.

$ErrorActionPreference = "Stop"

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    Write-Error "SSH is unavailable. Install the Windows OpenSSH Client."
    exit 1
}

Write-Host "Opening database tunnel..."
Write-Host "Local address: 127.0.0.1:14330"
Write-Host "Leave this terminal open. Press Ctrl+C to close the tunnel."
Write-Host ""

ssh -N `
    -o ExitOnForwardFailure=yes `
    -o ServerAliveInterval=30 `
    -o ServerAliveCountMax=3 `
    -L 127.0.0.1:14330:172.18.0.3:1433 `
    root@143.110.146.58

if ($LASTEXITCODE -ne 0) {
    Write-Host "SSH exited with code $LASTEXITCODE."
    Write-Host "Check your SSH access and whether another tunnel already uses port 14330."
    exit $LASTEXITCODE
}