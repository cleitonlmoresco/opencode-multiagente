param([string]$Projeto = "")
$ErrorActionPreference = "Stop"

$raiz = Split-Path -Parent $PSScriptRoot
$fonte = Join-Path $raiz ".opencode"
$cfgDir = Join-Path $env:USERPROFILE ".config\opencode"

# A fonte universal é o PROTOCOLO_AGENTES.md do repo.
$protocolo = Join-Path $fonte "INSTRUCOES_UNIVERSAIS.md"
$global = Join-Path $cfgDir "INSTRUCOES_GLOBAIS.md"
Copy-Item -Path $protocolo -Destination $global -Force
Write-Output "GLOBAL: $global <- $protocolo"

$projetos = @()
if ($Projeto) { $projetos += $Projeto }
else {
  $lista = Join-Path $PSScriptRoot "projetos-linkados.txt"
  if (Test-Path $lista) { $projetos += @(Get-Content $lista | Where-Object { $_.Trim() }) }
}

foreach ($proj in $projetos) {
  $p = $proj.Trim()
  if (-not $p) { continue }
  Write-Output "== $p =="
  if (-not (Test-Path $p)) { Write-Output "  FALHA: projeto nao existe"; continue }
  $dot = Join-Path $p ".opencode"
  if (-not (Test-Path $dot)) { New-Item -ItemType Directory -Path $dot | Out-Null }

  foreach ($sub in @("agents","commands","plugins")) {
    $link = Join-Path $dot $sub
    $alvo = Join-Path $fonte $sub
    if (-not (Test-Path $alvo)) { Write-Output "  FALHA: fonte ausente $alvo"; continue }
    $item = Get-Item $link -ErrorAction SilentlyContinue
    if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
      Write-Output "  OK: $sub (junction)"
      continue
    }
    if ($item) {
      $bk = Join-Path $p ("_maestro_backup_" + (Get-Date -Format yyyyMMdd_HHmmss))
      if (-not (Test-Path $bk)) { New-Item -ItemType Directory -Path $bk | Out-Null }
      try {
        Move-Item -Path $link -Destination (Join-Path $bk $sub) -Force
        Write-Output "  backup: $sub -> $bk"
      } catch {
        Write-Output "  AVISO: nao foi possivel mover $sub (em uso); sincronizando arquivos"
        Copy-Item -Path (Join-Path $alvo '*') -Destination $link -Recurse -Force
        continue
      }
    }
    cmd /c mklink /J "$link" "$alvo" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Write-Output "  OK: $sub -> $alvo" }
    else {
      Write-Output "  AVISO: mklink falhou em $sub; sincronizando arquivos"
      if (-not (Test-Path $link)) { New-Item -ItemType Directory -Path $link | Out-Null }
      Copy-Item -Path (Join-Path $alvo '*') -Destination $link -Recurse -Force
    }
  }

  $local = Join-Path $dot "atualizar-maestro.ps1"
  Copy-Item -Path (Join-Path $PSScriptRoot "atualizar-maestro-local.ps1") -Destination $local -Force
  Write-Output "  OK: comando local $local"
}

Write-Output "FIM"