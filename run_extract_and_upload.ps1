$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$python = $venvPython

if (-not (Test-Path -LiteralPath $python)) {
  $python = Join-Path $env:LOCALAPPDATA "Python\pythoncore-3.14-64\python.exe"
}

if (-not (Test-Path -LiteralPath $python)) {
  Write-Error "Python was not found at $python. Create the workspace virtual environment or update this script with the correct interpreter path."
  exit 1
}

& $python "$PSScriptRoot\extract_and_upload.py" @args
exit $LASTEXITCODE
