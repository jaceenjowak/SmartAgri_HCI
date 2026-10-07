$ErrorActionPreference = "Stop"

Write-Host "SmartAgri Supabase backend setup" -ForegroundColor Green

$url = Read-Host "Paste your Supabase Project URL (https://xxxxx.supabase.co)"
$secret = Read-Host "Paste your Supabase SECRET key (sb_secret_...)"

if ($url -notmatch '^https://.+\.supabase\.co/?$') {
    throw "Project URL does not look like a Supabase URL."
}

if ($secret -notmatch '^sb_secret_') {
    throw "Use the backend secret key that starts with sb_secret_."
}

# Compatible with Windows PowerShell 5.1 and newer PowerShell versions.
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
    $rng.GetBytes($bytes)
}
finally {
    $rng.Dispose()
}

$jwt = [Convert]::ToBase64String($bytes)

$content = @"
SUPABASE_URL=$($url.TrimEnd('/'))
SUPABASE_SECRET_KEY=$secret
JWT_SECRET=$jwt
JWT_EXPIRES_IN=7d
PORT=5000
CORS_ORIGIN=http://localhost:5173
ENABLE_SIMULATION=true
"@

Set-Content -Path "$PSScriptRoot\backend\.env" -Value $content -Encoding UTF8

Write-Host "Created backend/.env successfully." -ForegroundColor Green
Write-Host "Keep backend/.env private and do not commit it to Git." -ForegroundColor Yellow
