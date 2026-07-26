#!/usr/bin/env bash
set -euo pipefail

if [[ "$(id -u)" -ne 0 ]]; then
  echo "[bootstrap] execute como root: sudo bash scripts/release/bootstrap-linux.sh"
  exit 1
fi

APP_USER="${APP_USER:-maturador}"
APP_GROUP="${APP_GROUP:-maturador}"
APP_HOME="${APP_HOME:-/opt/whatsapp-chip-maturator}"

echo "[bootstrap] atualizando pacotes"
apt-get update
apt-get install -y ca-certificates curl gnupg git ufw jq unzip

if ! command -v docker >/dev/null 2>&1; then
  echo "[bootstrap] instalando Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi

if ! id -u "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --create-home --home-dir "${APP_HOME}" --shell /bin/bash "${APP_USER}"
fi

usermod -aG docker "${APP_USER}"

mkdir -p "${APP_HOME}"/{releases,shared/backups,shared/logs}
chown -R "${APP_USER}:${APP_GROUP}" "${APP_HOME}"

echo "[bootstrap] liberando firewall para SSH, HTTP e HTTPS"
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

echo "[bootstrap] concluído"
