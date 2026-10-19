(function () {
  'use strict';
  var DESIGN_W = 440, MAX_W = 620;
  var viewport = document.getElementById('viewport');
  var stage = document.getElementById('stage');

  /* ---------- масштабирование макета 440px под экран ---------- */
  function fit() {
    var w = Math.min(document.documentElement.clientWidth, MAX_W);
    var k = w / DESIGN_W;
    stage.style.transform = 'scale(' + k + ')';
    viewport.style.height = Math.ceil(stage.offsetHeight * k) + 'px';
    viewport.style.width = w + 'px';
    viewport.style.margin = '0 auto';
  }
  window.addEventListener('resize', fit);
  window.addEventListener('load', fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();

  /* ---------- опрос ---------- */
  var qBox = document.getElementById('questions');
  var form = document.getElementById('survey-form');
  var msg = document.getElementById('msg');
  var questions = [];

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  function build(q) {
    var t = q.type, req = q.required ? el('span', { 'class': 'req' }, ' *') : null;
    var wrap, label;
    if (t === 'radio' || t === 'checkbox') {
      wrap = el('fieldset', { 'class': 'q', 'data-id': q.id });
      label = el('legend', {}, q.label);
      if (req) label.appendChild(req);
      wrap.appendChild(label);
      q.options.forEach(function (o) {
        var l = el('label', { 'class': 'opt' });
        l.appendChild(el('input', { type: t, name: q.id, value: o }));
        l.appendChild(el('span', {}, o));
        wrap.appendChild(l);
      });
      return wrap;
    }
    wrap = el('div', { 'class': 'q', 'data-id': q.id });
    label = el('label', { 'for': 'f_' + q.id }, q.label);
    if (req) label.appendChild(req);
    wrap.appendChild(label);
    var f;
    if (t === 'textarea') f = el('textarea', { rows: 4 });
    else if (t === 'select') {
      f = el('select');
      f.appendChild(el('option', { value: '' }, 'Выберите…'));
      q.options.forEach(function (o) { f.appendChild(el('option', { value: o }, o)); });
    } else {
      f = el('input', { type: t === 'number' ? 'number' : t === 'tel' ? 'tel' : 'text' });
      if (t === 'number') { f.setAttribute('inputmode', 'numeric'); if (q.min != null) f.min = q.min; if (q.max != null) f.max = q.max; }
    }
    f.id = 'f_' + q.id; f.name = q.id;
    if (q.max && t !== 'number') f.maxLength = q.max;
    wrap.appendChild(f);
    return wrap;
  }

  function collect() {
    var data = {}, ok = true;
    questions.forEach(function (q) {
      var wrap = qBox.querySelector('[data-id="' + q.id + '"]'), v;
      if (q.type === 'checkbox') {
        v = Array.prototype.map.call(wrap.querySelectorAll('input:checked'), function (i) { return i.value; });
      } else if (q.type === 'radio') {
        var c = wrap.querySelector('input:checked'); v = c ? c.value : '';
      } else {
        v = wrap.querySelector('input,textarea,select').value.trim();
      }
      var empty = Array.isArray(v) ? !v.length : v === '';
      var bad = (q.required && empty) ||
        (q.type === 'number' && v !== '' && (isNaN(+v) || (q.min != null && +v < q.min) || (q.max != null && +v > q.max)));
      wrap.classList.toggle('err', bad);
      if (bad) ok = false;
      data[q.id] = v;
    });
    return ok ? data : null;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = '';
    var data = collect();
    if (!data) { msg.textContent = 'Пожалуйста, заполните отмеченные поля.'; return; }
    var btn = form.querySelector('.btn');
    btn.disabled = true;
    fetch('/api/survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: data, website: form.website.value })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Ошибка'); });
    }).then(function () {
      form.hidden = true;
      document.getElementById('thanks').hidden = false;
      try { localStorage.setItem('surveyDone', '1'); } catch (_) {}
      fit();
    }).catch(function (err) {
      msg.textContent = 'Не удалось отправить: ' + err.message + '. Попробуйте еще раз.';
      btn.disabled = false;
    });
  });

  fetch('questions.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (j) {
    questions = j.questions || [];
    questions.forEach(function (q) { qBox.appendChild(build(q)); });
    fit();
  }).catch(function () { msg.textContent = 'Не удалось загрузить вопросы. Обновите страницу.'; });
})();
