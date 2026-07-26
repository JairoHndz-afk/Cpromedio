Set-Location "$PSScriptRoot\backend"
$env:NODE_ENV = "production"
node src/server.js
