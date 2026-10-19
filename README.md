# Свадебное приглашение — София и Павел

Статичный лендинг (`public/`) + крошечный Node-сервер без зависимостей (`server.js`) для опроса.

## Что осталось сделать
1. **Шрифты из макета.** Положите в `public/fonts/` файлы `EkaterinaVelikayaOne.woff2|ttf` и `Felidae.woff2|ttf` — подхватятся сами. Пока стоят аналоги (Marck Script / Cormorant Garamond), поэтому заголовки «София & Павел» выглядят проще, чем в макете (там фирменные завитки шрифта).
2. **Фото в зеркале**: `public/assets/mirror-photo.jpg` (сейчас тёмная заглушка).
3. **Вопросы опроса**: `public/questions.json` (сейчас временные). Типы: text, tel, number, textarea, radio, checkbox, select.
4. Желательно заменить фото из `public/assets/` на файлы в большем разрешении (из макета выгрузились 1x).

## Запуск локально
    node server.js        # http://127.0.0.1:3000
    ADMIN_TOKEN=секрет node server.js

## Ответы гостей
Хранятся в `data/responses.jsonl`. Просмотр:
`/admin/responses?token=ТОКЕН` (JSON) и `/admin/responses?token=ТОКЕН&format=csv` (Excel).
Токен на сервере: `cat /etc/wedding-invite.env`.

## Хостинг (Ubuntu/Debian VPS)
    # 1. на сервере, один раз:
    scp deploy/setup-server.sh root@IP:/root/ && ssh root@IP bash /root/setup-server.sh
    # 2. с компьютера, при каждом обновлении:
    bash deploy/deploy.sh root@IP
    # 3. (по желанию) https:  ssh root@IP bash -s 147-45-43-34.sslip.io < deploy/https.sh
