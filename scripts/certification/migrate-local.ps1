param(
  [string]$ComposeFile = ".\docker-compose.operations.yml"
)

Write-Host "Executando migração local explícita..."
docker compose -f $ComposeFile run --rm app npm run db:push
