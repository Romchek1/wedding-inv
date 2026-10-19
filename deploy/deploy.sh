#!/usr/bin/env bash
# Запускается У ВАС НА КОМПЬЮТЕРЕ из корня репозитория: bash deploy/deploy.sh [user@host]
# Лучше заранее настроить вход по ключу:  ssh-copy-id root@147.45.43.34
set -euo pipefail
TARGET="${1:-root@147.45.43.34}"
APP=/opt/wedding-invite
rsync -az --delete --exclude data --exclude .git --exclude design -e ssh \
  server.js package.json public "$TARGET:$APP/"
ssh "$TARGET" "chown -R wedding:wedding $APP && systemctl restart wedding-invite && systemctl is-active wedding-invite"
echo "Сайт обновлен: http://${TARGET#*@}/"
