Set-Location "$PSScriptRoot\backend"
$env:NODE_ENV = "development"
node --watch src/server.js
