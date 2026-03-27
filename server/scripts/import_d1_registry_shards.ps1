param(
  [string]$ExportsDir = ".\\exports",
  $Remote = $true,
  [int]$DelaySeconds = 2,
  [int]$MaxRetries = 5,
  [int]$RetryDelaySeconds = 10,
  [string]$StartFromFile = "",
  [int]$OnlyShard = 0,
  [string]$OnlyDb = "",
  [switch]$ContinueOnError = $false,
  [switch]$WhatIf = $false
)

$ErrorActionPreference = 'Stop'

function ConvertTo-Bool {
  param([Parameter(Mandatory=$true)]$Value)

  if ($Value -is [bool]) { return $Value }
  if ($Value -is [int]) { return ($Value -ne 0) }

  $s = [string]$Value
  $s = $s.Trim().Trim('"',"'")

  if ($s -match '^(?i)\$?true$') { return $true }
  if ($s -match '^(?i)\$?false$') { return $false }
  if ($s -match '^[01]$') { return ($s -eq '1') }

  throw "Cannot convert Remote value '$s' to boolean. Use -Remote, -Remote:$true, -Remote 1, or -Remote true."
}

$Remote = ConvertTo-Bool $Remote

function Resolve-ExportsDir {
  param([Parameter(Mandatory=$true)][string]$Path)

  $candidates = @()

  if ($Path) {
    $candidates += (Resolve-Path -LiteralPath $Path -ErrorAction SilentlyContinue | ForEach-Object { $_.Path })
    $candidates += [System.IO.Path]::GetFullPath($Path)
  }

  $scriptDir = $PSScriptRoot
  if (-not $scriptDir) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

  $candidates += (Join-Path $scriptDir 'exports')
  $candidates += (Join-Path (Split-Path -Parent $scriptDir) 'exports')
  $candidates += (Join-Path (Split-Path -Parent (Split-Path -Parent $scriptDir)) 'exports')

  foreach ($c in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $c) {
      return (Resolve-Path -LiteralPath $c).Path
    }
  }

  $tried = ($candidates | Where-Object { $_ } | Select-Object -Unique) -join "`n - "
  throw "ExportsDir not found. Tried:`n - $tried`n`nSet -ExportsDir to the folder that contains ua_vehicle_registry_part*_*.sql files (often .\\exports)."
}

$ExportsDir = Resolve-ExportsDir $ExportsDir

function Get-WranglerExe {
  $cmds = @(Get-Command wrangler -All -ErrorAction SilentlyContinue)
  if ($cmds.Count -eq 0) { return 'wrangler' }

  $app = $cmds | Where-Object { $_.CommandType -eq 'Application' } | Select-Object -First 1
  if ($app) { return $app.Source }

  $any = $cmds | Select-Object -First 1
  return $any.Source
}

$WranglerExe = Get-WranglerExe

function Invoke-WranglerD1Execute {
  param(
    [Parameter(Mandatory=$true)][string]$DbName,
    [Parameter(Mandatory=$true)][string[]]$RemoteFlag,
    [Parameter(Mandatory=$true)][string]$SqlFile,
    [Parameter(Mandatory=$true)][string]$LogPath
  )

  $outTmp = [System.IO.Path]::GetTempFileName()
  $errTmp = [System.IO.Path]::GetTempFileName()
  try {
    $args = @('d1','execute', $DbName) + $RemoteFlag + @('--file', $SqlFile)

    $argString = ($args | ForEach-Object {
      $a = [string]$_
      if ($a -match '[\s"]') {
        '"' + ($a -replace '"', '\\"') + '"'
      } else {
        $a
      }
    }) -join ' '

    $p = Start-Process -FilePath $WranglerExe -ArgumentList $argString -NoNewWindow -Wait -PassThru -RedirectStandardOutput $outTmp -RedirectStandardError $errTmp

    if (Test-Path $outTmp) {
      Get-Content -LiteralPath $outTmp -ErrorAction SilentlyContinue | Tee-Object -FilePath $LogPath -Append | Out-Null
    }
    if (Test-Path $errTmp) {
      Get-Content -LiteralPath $errTmp -ErrorAction SilentlyContinue | Tee-Object -FilePath $LogPath -Append | Out-Null
    }

    return [int]$p.ExitCode
  } finally {
    Remove-Item -LiteralPath $outTmp -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $errTmp -Force -ErrorAction SilentlyContinue
  }
}

function Invoke-ImportShard {
  param(
    [Parameter(Mandatory=$true)][string]$DbName,
    [Parameter(Mandatory=$true)][int]$ShardNo
  )

  $pattern = Join-Path $ExportsDir ("ua_vehicle_registry_part{0}_*.sql" -f $ShardNo)
  $files = Get-ChildItem $pattern -ErrorAction Stop | Sort-Object Name
  if ($files.Count -eq 0) {
    throw "No files found for shard $ShardNo using pattern: $pattern"
  }

  $logPath = Join-Path $ExportsDir ("import_{0}.log" -f $DbName)
  $i = 0

  for ($i = 0; $i -lt $files.Count; $i++) {
    $f = $files[$i]
    if ($StartFromFile -and ($f.Name -lt $StartFromFile)) {
      continue
    }
    $pct = [int](($i + 1) * 100 / $files.Count)
    Write-Progress -Activity "Import shard $ShardNo -> $DbName" -Status $f.Name -PercentComplete $pct
    Write-Host "[$($i+1)/$($files.Count)] $DbName <= $($f.Name)"

    $remoteFlag = @()
    if ($Remote) { $remoteFlag = @('--remote') }

    if ($WhatIf) {
      Write-Host "WHATIF: wrangler d1 execute $DbName $($remoteFlag -join ' ') --file `"$($f.FullName)`""
      continue
    }

    $attempt = 0
    while ($true) {
      $attempt++
      try {
        $exitCode = Invoke-WranglerD1Execute -DbName $DbName -RemoteFlag $remoteFlag -SqlFile $f.FullName -LogPath $logPath
        if ($exitCode -eq 0) { break }
        throw "wrangler exit code: $exitCode"
      } catch {
        Write-Host "ERROR importing $($f.Name) into ${DbName}: $($_.Exception.Message)"
        if ($attempt -ge $MaxRetries) {
          if (-not $ContinueOnError) { throw }
          break
        }
        Start-Sleep -Seconds $RetryDelaySeconds
      }
    }

    if ($DelaySeconds -gt 0) {
      Start-Sleep -Seconds $DelaySeconds
    }
  }
}

Write-Host "Starting D1 import from: $ExportsDir"
Write-Host "Remote: $Remote"

$targets = @(
  @{ Db = 'bd_avto_ua';  Shard = 1 },
  @{ Db = 'bd_avto_ua2'; Shard = 2 },
  @{ Db = 'bd_avto_ua3'; Shard = 3 },
  @{ Db = 'bd_avto_ua4'; Shard = 4 }
)

if ($OnlyShard -and $OnlyShard -gt 0) {
  $targets = $targets | Where-Object { $_.Shard -eq $OnlyShard }
}
if ($OnlyDb) {
  $targets = $targets | Where-Object { $_.Db -eq $OnlyDb }
}

if (-not $targets -or $targets.Count -eq 0) {
  throw "No targets selected. Check -OnlyShard/-OnlyDb values."
}

foreach ($t in $targets) {
  Invoke-ImportShard -DbName $t.Db -ShardNo $t.Shard
}

Write-Host "DONE"
