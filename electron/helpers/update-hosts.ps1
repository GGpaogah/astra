# update-hosts.ps1
# Dijalankan oleh Astra sebagai proses PowerShell terpisah (memerlukan hak admin).
# Argumen: -Action add|remove -Hostname <nama> -Ip <ip>
# Contoh: powershell -ExecutionPolicy Bypass -File update-hosts.ps1 -Action add -Hostname test.local -Ip 127.0.0.1

param(
    [Parameter(Mandatory)][ValidateSet('add','remove')][string]$Action,
    [Parameter(Mandatory)][string]$Hostname,
    [Parameter(Mandatory)][string]$Ip = '127.0.0.1'
)

$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$marker    = "# astra-managed"
$entry     = "$Ip`t$Hostname`t$marker"

$lines = Get-Content $hostsFile -ErrorAction Stop

switch ($Action) {
    'add' {
        $exists = $lines | Where-Object { $_ -match "\s$([regex]::Escape($Hostname))\s*$marker" }
        if (-not $exists) {
            Add-Content -Path $hostsFile -Value $entry -Encoding UTF8
            Write-Host "Added: $entry"
        } else {
            Write-Host "Already exists: $Hostname"
        }
    }
    'remove' {
        $filtered = $lines | Where-Object { $_ -notmatch "\s$([regex]::Escape($Hostname))\s*$marker" }
        Set-Content -Path $hostsFile -Value $filtered -Encoding UTF8
        Write-Host "Removed: $Hostname"
    }
}
