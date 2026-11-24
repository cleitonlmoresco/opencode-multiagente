# Comando local de autoatualizacao — gerado por sincronizar-maestro.ps1
# Uso: powershell -ExecutionPolicy Bypass -File .opencode\atualizar-maestro.ps1
$central = "C:\Users\cleit\OneDrive\Documentos\Projeto Padrão\scripts\sincronizar-maestro.ps1"
& powershell -NoProfile -ExecutionPolicy Bypass -File $central -Projeto (Split-Path -Parent $PSScriptRoot)