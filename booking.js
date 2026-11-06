/* ==========================================================================
   Réservation sans serveur, sans abonnement.
   Le formulaire ne stocke rien et n'envoie rien tout seul : il prépare un SMS,
   un e-mail ou un fichier agenda (.ics) que la cliente envoie depuis son propre appareil.
   ========================================================================== */
(function () {
  'use strict';

  /* ---- Réglages à modifier si besoin ---- */
  var CFG = {
    phone: '+33660343445',
    phoneLabel: '06 60 34 34 45',
    email: 'cathy.bianchi2@free.fr',
    address: '3 rue Antoine Héroët, 04000 Digne-les-Bains',
    openDays: [1, 2, 4, 5],        // 0 = dimanche … 6 = samedi (lundi, mardi, jeudi, vendredi)
    horizonDays: 42,               // nombre de jours proposés
    durationMin: 120               // durée par défaut de l'événement .ics
  };

  var form = document.getElementById('wizForm');
  if (!form) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  var fmtWd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
  var fmtMo = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  var euro = function (n) { return n.toLocaleString('fr-FR') + '\u00a0€'; };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var isoDay = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  /* ---- Jours fériés français (pour ne pas proposer un jour férié) ---- */
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7,
      m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31),
      da = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da, 12);
  }
  function holidays(y) {
    var set = {}, e = easter(y);
    function add(d) { set[isoDay(d)] = true; }
    function plus(n) { var d = new Date(e); d.setDate(d.getDate() + n); return d; }
    [[0, 1], [4, 1], [4, 8], [6, 14], [7, 15], [10, 1], [10, 11], [11, 25]].forEach(function (md) { add(new Date(y, md[0], md[1], 12)); });
    add(plus(1)); add(plus(39)); add(plus(50));
    return set;
  }
  var holCache = {};
  function isHoliday(d) { var y = d.getFullYear(); holCache[y] = holCache[y] || holidays(y); return !!holCache[y][isoDay(d)]; }

  /* ---- Catalogue lu dans la page (une seule source de vérité : les cartes) ---- */
  var groups = [];
  $$('.card').forEach(function (card) {
    var t = $('.card__title', card); if (!t) return;
    var items = $$('.price-row', card).map(function (li) {
      return { id: li.dataset.id, name: li.dataset.name, price: li.dataset.price ? Number(li.dataset.price) : null, el: li };
    });
    if (items.length) groups.push({ title: t.textContent.trim(), items: items });
  });
  groups.push({ title: 'Un doute\u00a0?', items: [{ id: 'conseil', name: 'Je souhaite être conseillée', price: null, el: null }] });
  var catalog = {};
  groups.forEach(function (g) { g.items.forEach(function (it) { catalog[it.id] = it; }); });

  var state = { step: 1, picked: [], date: undefined, time: '', maxStep: 1 };
  var elList = $('#svcList'), elTotal = $('#wizTotal'), elDays = $('#days'), elTimes = $('#times'),
    elTicket = $('#ticket'), elErr = $('#wizError'), btnNext = $('#wizNext'), btnBack = $('#wizBack'),
    stepsEl = $$('.wstep', form), stepper = $$('.wiz__steps li');

  /* ---- Étape 1 : prestations ---- */
  function shortName(n) {
    var p = n.split(' · ');
    var s = p.length > 1 ? p.slice(1).join(' · ') : n;
    return p.length > 1 ? p[0] + ' — ' + s : s;
  }
  function renderServices() {
    elList.innerHTML = groups.map(function (g) {
      return '<div class="svc__group"><h4>' + g.title + '</h4><div class="svc__items">' + g.items.map(function (it) {
        var price = it.price != null ? '<span class="svc__price">' + euro(it.price) + '</span>' : '<span class="svc__price is-devis">' + (it.id === 'conseil' ? 'Gratuit' : 'Sur devis') + '</span>';
        return '<label class="svc__item"><input type="checkbox" value="' + it.id + '"><span class="svc__box"><svg aria-hidden="true"><use href="#i-check"/></svg></span><span class="svc__name">' + shortName(it.name) + '</span>' + price + '</label>';
      }).join('') + '</div></div>';
    }).join('');
    $$('input', elList).forEach(function (inp) {
      inp.addEventListener('change', function () { setPicked(inp.value, inp.checked); });
    });
  }
  function syncUI() {
    $$('input', elList).forEach(function (inp) { inp.checked = state.picked.indexOf(inp.value) > -1; });
    Object.keys(catalog).forEach(function (id) { var el = catalog[id].el; if (el) el.classList.toggle('is-picked', state.picked.indexOf(id) > -1); });
    var t = total();
    elTotal.textContent = state.picked.length ? (t.sum ? euro(t.sum) + (t.devis ? ' + devis' : '') : 'Sur devis') : '—';
    document.dispatchEvent(new CustomEvent('booking:change', { detail: { count: state.picked.length, sum: t.sum, devis: t.devis } }));
  }
  function total() {
    var sum = 0, devis = 0;
    state.picked.forEach(function (id) { var it = catalog[id]; if (!it) return; if (it.price != null) sum += it.price; else if (id !== 'conseil') devis++; });
    return { sum: sum, devis: devis };
  }
  function setPicked(id, on) {
    var i = state.picked.indexOf(id);
    if (on && i < 0) state.picked.push(id);
    if (!on && i > -1) state.picked.splice(i, 1);
    syncUI();
  }

  /* ---- Étape 2 : jours ---- */
  function renderDays() {
    var html = '<button type="button" class="day day--any" role="radio" aria-checked="false" data-date="any">Je suis<br>flexible</button>';
    var d = new Date(); d.setHours(12, 0, 0, 0);
    for (var i = 1; i <= CFG.horizonDays; i++) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i, 12);
      if (CFG.openDays.indexOf(x.getDay()) < 0 || isHoliday(x)) continue;
      html += '<button type="button" class="day" role="radio" aria-checked="false" data-date="' + isoDay(x) + '" aria-label="' + fmtLong.format(x) + '"><small>' + fmtWd.format(x).replace('.', '') + '</small><b>' + x.getDate() + '</b><span>' + fmtMo.format(x).replace('.', '') + '</span></button>';
    }
    elDays.innerHTML = html;
  }
  function radio(group, onPick) {
    group.addEventListener('click', function (e) {
      var b = e.target.closest('[role="radio"]'); if (!b || !group.contains(b)) return;
      $$('[role="radio"]', group).forEach(function (x) { x.setAttribute('aria-checked', x === b ? 'true' : 'false'); });
      onPick(b);
    });
    group.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var all = $$('[role="radio"]', group), i = all.indexOf(document.activeElement); if (i < 0) return;
      var n = all[(i + (e.key === 'ArrowRight' ? 1 : all.length - 1)) % all.length]; n.focus(); n.click(); e.preventDefault();
    });
  }

  /* ---- Navigation entre étapes ---- */
  function showStep(n, instant) {
    state.step = n; state.maxStep = Math.max(state.maxStep, n);
    stepsEl.forEach(function (s) { s.classList.toggle('is-active', Number(s.dataset.step) === n); });
    stepper.forEach(function (li) {
      var k = Number(li.dataset.s);
      li.classList.toggle('is-active', k === n); li.classList.toggle('is-done', k < n);
    });
    btnBack.hidden = n === 1;
    btnNext.style.display = n === 4 ? 'none' : '';
    btnNext.querySelector('.btn__label').firstChild.nodeValue = n === 3 ? 'Préparer ma demande ' : 'Continuer ';
    elErr.hidden = true;
    var cur = stepsEl[n - 1];
    if (window.gsap && !instant && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(cur.children, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'power3.out', stagger: .07, clearProps: 'transform,opacity' });
    }
    if (!instant) {
      var legend = $('legend', cur); if (legend) { legend.setAttribute('tabindex', '-1'); legend.focus({ preventScroll: true }); }
      var top = $('#wiz').getBoundingClientRect().top;
      if (top < 0 || top > innerHeight * .5) { var y = window.scrollY + top - 100; if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1 }); else window.scrollTo({ top: y, behavior: 'smooth' }); }
    }
  }
  function fail(msg, el) {
    elErr.textContent = msg; elErr.hidden = false;
    if (el) { el.classList.add('is-invalid'); el.focus(); }
  }
  function validate(n) {
    elErr.hidden = true;
    $$('.is-invalid', form).forEach(function (x) { x.classList.remove('is-invalid'); });
    if (n === 1 && !state.picked.length) { return softError('Choisissez au moins une prestation (ou «\u00a0Je souhaite être conseillée\u00a0»).', 1); }
    if (n === 2 && state.date === undefined) return softError('Choisissez un jour, ou «\u00a0Je suis flexible\u00a0».', 2);
    if (n === 3) {
      var p = $('#fPrenom'), t = $('#fTel'), m = $('#fEmail');
      if (!p.value.trim()) { fail('Votre prénom, s’il vous plaît.', p); return false; }
      var digits = t.value.replace(/\D/g, '');
      if (digits.length < 10) { fail('Votre numéro de mobile (10 chiffres) pour que Cathy puisse vous répondre.', t); return false; }
      if (m.value.trim() && !/^\S+@\S+\.\S+$/.test(m.value.trim())) { fail('Cette adresse e-mail semble incomplète.', m); return false; }
    }
    return true;
  }
  function softError(msg, n) {
    var box = $('.wstep[data-step="' + n + '"]');
    var el = $('.wstep__error', box);
    if (!el) { el = document.createElement('p'); el.className = 'wstep__error'; el.setAttribute('role', 'alert'); box.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(softError.t); softError.t = setTimeout(function () { el.hidden = true; }, 4200);
    return false;
  }

  /* ---- Étape 4 : message, ticket, liens ---- */
  function selectedDate() { return state.date && state.date !== 'any' ? new Date(state.date + 'T12:00:00') : null; }
  function dateText() {
    var d = selectedDate();
    if (!d) return 'flexible (toutes les dates d’ouverture me conviennent)';
    return fmtLong.format(d) + (state.time ? ', vers ' + state.time.replace('h', 'h') : '');
  }
  function buildMessage() {
    var lines = ['Bonjour Cathy,', '', 'Je souhaiterais prendre rendez-vous pour :'];
    state.picked.forEach(function (id) {
      var it = catalog[id]; lines.push('• ' + it.name + (it.price != null ? ' (' + it.price + ' €)' : (id === 'conseil' ? '' : ' (sur devis)')));
    });
    var t = total();
    if (t.sum) lines.push('Total indicatif : ' + t.sum + ' €' + (t.devis ? ' + devis' : ''));
    lines.push('', 'Jour souhaité : ' + dateText() + '.');
    var nom = ($('#fPrenom').value.trim() + ' ' + $('#fNom').value.trim()).trim();
    lines.push('Mon nom : ' + nom + '.', 'Mon mobile : ' + $('#fTel').value.trim() + '.');
    if ($('#fEmail').value.trim()) lines.push('Mon e-mail : ' + $('#fEmail').value.trim() + '.');
    if ($('#fMsg').value.trim()) lines.push('', $('#fMsg').value.trim());
    lines.push('', 'Merci beaucoup, et à bientôt !');
    return lines.join('\n');
  }
  function renderTicket() {
    var t = total();
    var rows = state.picked.map(function (id) {
      var it = catalog[id];
      return '<div><span>' + shortName(it.name) + '</span><span>' + (it.price != null ? euro(it.price) : (id === 'conseil' ? '—' : 'sur devis')) + '</span></div>';
    }).join('');
    var nom = ($('#fPrenom').value.trim() + ' ' + $('#fNom').value.trim()).trim();
    elTicket.innerHTML =
      '<div class="ticket__top"><b>Demande de rendez-vous</b><span>à confirmer</span></div>' +
      '<div class="ticket__rows">' + rows + '</div>' +
      (t.sum ? '<div class="ticket__total"><span>Total indicatif</span><b>' + euro(t.sum) + (t.devis ? ' + devis' : '') + '</b></div>' : '') +
      '<div class="ticket__meta"><div><b>Jour&nbsp;:</b> ' + dateText() + '</div><div><b>De la part de&nbsp;:</b> ' + nom + ' · ' + $('#fTel').value.trim() + '</div><div><b>Lieu&nbsp;:</b> ' + CFG.address + '</div></div>';
  }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
  function prepareLinks() {
    var msg = buildMessage(), subject = 'Demande de rendez-vous — ' + $('#fPrenom').value.trim();
    $('#btnSms').href = 'sms:' + CFG.phone + (isIOS() ? '&' : '?') + 'body=' + encodeURIComponent(msg);
    $('#btnMail').href = 'mailto:' + CFG.email + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(msg.replace(/\n/g, '\r\n'));
    $('#btnIcs').style.display = selectedDate() ? '' : 'none';
    prepareLinks.msg = msg;
  }
  function ics() {
    var d = selectedDate(); if (!d) return;
    var h = 9, m = 0;
    if (state.time) { var p = state.time.split('h'); h = Number(p[0]); m = Number(p[1] || 0); }
    var s = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
    var e = new Date(s.getTime() + CFG.durationMin * 60000);
    var f = function (x) { return x.getFullYear() + pad(x.getMonth() + 1) + pad(x.getDate()) + 'T' + pad(x.getHours()) + pad(x.getMinutes()) + '00'; };
    var stamp = new Date(); var st = stamp.getUTCFullYear() + pad(stamp.getUTCMonth() + 1) + pad(stamp.getUTCDate()) + 'T' + pad(stamp.getUTCHours()) + pad(stamp.getUTCMinutes()) + '00Z';
    var desc = state.picked.map(function (id) { return catalog[id].name; }).join(', ') + '. Demande à confirmer par Cathy : ' + CFG.phoneLabel + '.';
    var esc = function (t) { return t.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n'); };
    var txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cathy Bianchi//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@cathy-bianchi', 'DTSTAMP:' + st, 'DTSTART:' + f(s), 'DTEND:' + f(e),
      'SUMMARY:' + esc('RDV Cathy Bianchi — maquillage permanent (à confirmer)'), 'LOCATION:' + esc(CFG.address), 'DESCRIPTION:' + esc(desc), 'STATUS:TENTATIVE',
      'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous demain chez Cathy Bianchi', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var blob = new Blob([txt], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rdv-cathy-bianchi.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }
  function copy() {
    var msg = prepareLinks.msg || buildMessage(), label = $('#btnCopy span');
    var done = function () { label.textContent = 'Message copié ✓'; setTimeout(function () { label.textContent = 'Copier le message'; }, 2400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(done, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = msg; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { } ta.remove();
    }
  }
  function sparkle() {
    if (!window.gsap || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var wiz = $('#wiz'), r = wiz.getBoundingClientRect(), cx = r.width / 2, cy = 150;
    for (var i = 0; i < 22; i++) {
      var s = document.createElement('span'); s.className = 'spark'; s.style.left = cx + 'px'; s.style.top = cy + 'px'; wiz.appendChild(s);
      var ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 220;
      gsap.fromTo(s, { x: 0, y: 0, scale: Math.random() * 1.4 + .4, opacity: 1 }, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist * .7 + 40, opacity: 0, duration: 1.4 + Math.random() * .8, ease: 'power3.out', onComplete: function () { this.targets()[0].remove(); } });
    }
  }

  function next() {
    if (!validate(state.step)) return;
    if (state.step === 3) { renderTicket(); prepareLinks(); showStep(4); sparkle(); return; }
    showStep(state.step + 1);
  }
  function back() { if (state.step > 1) showStep(state.step - 1); }

  /* ---- Branchements ---- */
  renderServices(); renderDays();
  radio(elDays, function (b) { state.date = b.dataset.date; });
  radio(elTimes, function (b) { state.time = b.dataset.time; });
  btnNext.addEventListener('click', next);
  btnBack.addEventListener('click', back);
  form.addEventListener('submit', function (e) { e.preventDefault(); next(); });
  form.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && state.step < 4) { e.preventDefault(); next(); } });
  $('#btnIcs').addEventListener('click', ics);
  $('#btnCopy').addEventListener('click', copy);
  stepper.forEach(function (li) {
    li.addEventListener('click', function () { var k = Number(li.dataset.s); if (k < state.step) showStep(k); });
  });
  ['#fPrenom', '#fTel', '#fNom', '#fEmail', '#fMsg'].forEach(function (s) { $(s).addEventListener('input', function () { this.classList.remove('is-invalid'); }); });
  showStep(1, true);

  /* ---- API publique (utilisée par les cartes de prestations) ---- */
  window.Booking = {
    toggle: function (id) { setPicked(id, state.picked.indexOf(id) < 0); return state.picked.indexOf(id) > -1; },
    isPicked: function (id) { return state.picked.indexOf(id) > -1; },
    count: function () { return state.picked.length; },
    total: total,
    reset: function () { state.picked = []; syncUI(); }
  };
})();
