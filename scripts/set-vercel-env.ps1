param(
  [string]$Name,
  [string]$Value,
  [string]$Target = "production"
)

$path = Join-Path $env:TEMP "vercel-env-$Name.txt"
[System.IO.File]::WriteAllText($path, $Value)
npx vercel env rm $Name $Target --yes 2>$null | Out-Null
Get-Content -Raw $path | npx vercel env add $Name $Target
Remove-Item $path -Force
