#!/usr/bin/env bash
# НА СЕРВЕРЕ: подключить отправку ответов в Telegram. Токен вводится скрыто и в историю не попадает.
# Перед запуском: создайте бота у @BotFather и напишите ему любое сообщение (или добавьте его в группу и напишите там).
set -euo pipefail
read -rsp "Токен бота от BotFather: " TOKEN; echo
CHAT=$(curl -fsS "https://api.telegram.org/bot$TOKEN/getUpdates" | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const r=JSON.parse(d).result||[];
const m=r.map(u=>(u.message||u.channel_post||u.my_chat_member||{}).chat).filter(Boolean).pop();
console.log(m?m.id:"")})')
[ -n "$CHAT" ] || { echo "Бот пока ничего не получил. Напишите ему сообщение в Telegram и запустите скрипт снова."; exit 1; }
sed -i '/^TELEGRAM_/d' /etc/wedding-invite.env
printf 'TELEGRAM_BOT_TOKEN=%s\nTELEGRAM_CHAT_ID=%s\n' "$TOKEN" "$CHAT" >> /etc/wedding-invite.env
chmod 600 /etc/wedding-invite.env
systemctl restart wedding-invite
curl -fsS "https://api.telegram.org/bot$TOKEN/sendMessage" -d chat_id="$CHAT" -d text="Бот подключен к сайту. Ответы гостей будут приходить сюда." >/dev/null && echo "Готово, проверьте Telegram."
