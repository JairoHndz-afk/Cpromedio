Set-Location "$PSScriptRoot\frontend"
node .\node_modules\@angular\cli\bin\ng build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
node serve-dist.js
