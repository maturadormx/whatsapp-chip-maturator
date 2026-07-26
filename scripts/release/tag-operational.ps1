param(
  [string]$TagName = "v1.0.0-operational"
)

Write-Host "Baseline operacional congelada: $TagName"
Write-Host "Crie a tag no ambiente com git habilitado:"
Write-Host "git tag $TagName"
Write-Host "git push origin $TagName"
Write-Host "Depois abra a branch de produção:"
Write-Host "git checkout -b release/e2-production"
