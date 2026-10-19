#!/usr/bin/env bash
# Запускается НА СЕРВЕРЕ (Ubuntu/Debian) от root. Один раз.
# Использование:  bash setup-server.sh [домен]   — домен опционален (нужен для https)
set -euo pipefail
DOMAIN="${1:-_}"
APP=/opt/wedding-invite

apt-get update -y
apt-get install -y nginx curl ca-certificates rsync
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

id -u wedding >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin wedding
mkdir -p "$APP" "$APP/data"

# токен для просмотра ответов (создается один раз)
if [ ! -f /etc/wedding-invite.env ]; then
  echo "ADMIN_TOKEN=$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 32)" > /etc/wedding-invite.env
  chmod 600 /etc/wedding-invite.env
fi

cat > /etc/systemd/system/wedding-invite.service <<EOF
[Unit]
Description=Wedding invite
After=network.target
[Service]
User=wedding
WorkingDirectory=$APP
EnvironmentFile=/etc/wedding-invite.env
Environment=PORT=3000 HOST=127.0.0.1
ExecStart=/usr/bin/node $APP/server.js
Restart=always
NoNewPrivileges=true
ProtectSystem=full
ReadWritePaths=$APP/data
[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/sites-available/wedding-invite <<EOF
server {
    listen 80 default_server;
    server_name $DOMAIN;
    client_max_body_size 64k;
    gzip on; gzip_types text/css application/javascript application/json image/svg+xml;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$remote_addr;
    }
}
EOF
ln -sf /etc/nginx/sites-available/wedding-invite /etc/nginx/sites-enabled/wedding-invite
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx || systemctl restart nginx

# файрвол (если ufw есть): ssh + http + https
if command -v ufw >/dev/null; then ufw allow 22/tcp; ufw allow 80/tcp; ufw allow 443/tcp; ufw --force enable; fi

systemctl daemon-reload
systemctl enable wedding-invite
echo "Готово. Теперь залейте сайт: deploy/deploy.sh"
