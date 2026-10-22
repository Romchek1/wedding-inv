'use strict';
// Без зависимостей: node server.js  (Node >= 18)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = +process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT = process.env.TELEGRAM_CHAT_ID || '';
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'responses.jsonl');
fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

const loadQuestions = () => JSON.parse(fs.readFileSync(path.join(PUBLIC, 'questions.json'), 'utf8')).questions;

function send(res, code, body, type = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

// простой лимит: не больше 10 отправок в час с одного IP
const hits = new Map();
function limited(ip) {
  const now = Date.now(), arr = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  arr.push(now); hits.set(ip, arr);
  return arr.length > 10;
}

function validate(answers) {
  if (!answers || typeof answers !== 'object') return { error: 'Некорректные данные' };
  const out = {};
  for (const q of loadQuestions()) {
    let v = answers[q.id];
    const multi = q.type === 'checkbox';
    if (multi) v = Array.isArray(v) ? v.map(String) : [];
    else v = v == null ? '' : String(v).trim();
    const empty = multi ? !v.length : v === '';
    if (q.required && empty) return { error: `Не заполнено: ${q.label}` };
    if (!empty) {
      if (q.options) {
        const bad = (multi ? v : [v]).some(x => !q.options.includes(x));
        if (bad) return { error: `Недопустимый вариант: ${q.label}` };
      }
      if (q.type === 'number') {
        const n = Number(v);
        if (!Number.isFinite(n) || (q.min != null && n < q.min) || (q.max != null && n > q.max)) return { error: `Некорректное число: ${q.label}` };
      } else if (!multi && v.length > (q.max || 1000)) return { error: `Слишком длинный ответ: ${q.label}` };
    }
    out[q.id] = v;
  }
  return { out };
}

// Уведомление в Telegram. Ответ уже сохранен в файл, поэтому сбой Telegram гостю не показываем.
async function notifyTelegram(answers) {
  if (!TG_TOKEN || !TG_CHAT) return;
  const lines = loadQuestions().map(q => {
    const v = answers[q.id], text = Array.isArray(v) ? v.join(', ') : v;
    return `${q.label}\n→ ${text || '—'}`;
  });
  const text = ('Новый ответ на опрос\n\n' + lines.join('\n\n')).slice(0, 4000);
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: TG_CHAT, text }), signal: AbortSignal.timeout(10000) });
      if (r.ok) return;
      console.error('telegram', r.status, await r.text());
    } catch (e) { console.error('telegram', e.message); }
    await new Promise(res => setTimeout(res, 2000 * (i + 1)));
  }
}

function readBody(req, limit = 20000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function rows() {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

const csvCell = v => '"' + String(Array.isArray(v) ? v.join('; ') : v ?? '').replace(/"/g, '""') + '"';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

  if (req.method === 'POST' && url.pathname === '/api/survey') {
    try {
      if (limited(ip)) return send(res, 429, { error: 'Слишком много попыток' });
      const body = JSON.parse(await readBody(req));
      if (body.website) return send(res, 200, { ok: true }); // honeypot — боту делаем вид, что все ок
      const { out, error } = validate(body.answers);
      if (error) return send(res, 400, { error });
      fs.appendFileSync(FILE, JSON.stringify({ at: new Date().toISOString(), ...out }) + '\n');
      notifyTelegram(out).catch(e => console.error('telegram', e.message));
      return send(res, 200, { ok: true });
    } catch (e) { return send(res, 400, { error: 'Некорректный запрос' }); }
  }

  if (req.method === 'GET' && url.pathname === '/admin/responses') {
    if (!ADMIN_TOKEN || url.searchParams.get('token') !== ADMIN_TOKEN) return send(res, 403, { error: 'forbidden' });
    const data = rows();
    if (url.searchParams.get('format') === 'csv') {
      const cols = ['at', ...loadQuestions().map(q => q.id)];
      const csv = '﻿' + [cols.join(','), ...data.map(r => cols.map(c => csvCell(r[c])).join(','))].join('\n');
      return send(res, 200, csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="responses.csv"' });
    }
    return send(res, 200, data, 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'method' });
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden', 'text/plain');
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const ext = path.extname(file).toLowerCase();
    const cache = ext === '.html' || ext === '.json' ? 'no-cache' : 'public, max-age=86400';
    send(res, 200, buf, MIME[ext] || 'application/octet-stream', { 'Cache-Control': cache });
  });
});

server.listen(PORT, HOST, () => console.log(`wedding-invite on http://${HOST}:${PORT}`));
