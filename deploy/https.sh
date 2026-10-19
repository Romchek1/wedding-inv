#!/usr/bin/env bash
# НА СЕРВЕРЕ: включить https. Нужен домен, указывающий на IP сервера.
# Бесплатный вариант без покупки домена: 147-45-43-34.sslip.io (сам резолвится в 147.45.43.34)
set -euo pipefail
D="${1:?usage: https.sh домен}"
sed -i "s/server_name .*;/server_name $D;/" /etc/nginx/sites-available/wedding-invite
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$D" --non-interactive --agree-tos -m "${2:-admin@$D}" --redirect
echo "Готово: https://$D/"
