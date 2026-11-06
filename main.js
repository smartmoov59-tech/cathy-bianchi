/* ==========================================================================
   Cathy Bianchi — mise en scène (GSAP + ScrollTrigger + Lenis)
   Règles : courbes douces (power3 / expo), uniquement transform + opacity,
   stagger partout, version allégée si prefers-reduced-motion, simplifié sur mobile.
   ========================================================================== */
(function () {
  'use strict';

  var doc = document, root = doc.documentElement, body = doc.body;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]reduce=1\b/.test(location.search);
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var isDesktop = function () { return matchMedia('(min-width: 901px)').matches; };

  function rescue(err) {
    if (window.console) console.error(err);
    root.classList.add('js-fail');
    body.classList.remove('is-loading');
    var l = $('#loader'); if (l) l.remove();
    var v = $('#heroVideo'); if (v) startVideo(v);
  }

  /* ---------- Vidéo d'ouverture ---------- */
  function startVideo(v) {
    if (!v || v.dataset.ready) return;
    v.dataset.ready = '1';
    if (reduce) return; // image de secours seulement
    var small = innerWidth <= 800 || (navigator.connection && navigator.connection.saveData);
    v.src = small ? 'hero-720.mp4' : 'hero-1080.mp4';
    v.muted = true; v.defaultMuted = true; v.playsInline = true;
    var p = v.play(); if (p && p.catch) p.catch(function () { });
  }

  try { boot(); } catch (e) { rescue(e); }

  function boot() {
    if (!window.gsap || !window.ScrollTrigger) throw new Error('GSAP indisponible');
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    /* ----- Smooth scroll ----- */
    var lenis = null;
    if (!reduce && window.Lenis) {
      lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, wheelMultiplier: .95, touchMultiplier: 1.3 });
      window.__lenis = lenis;
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      lenis.stop();
    }
    var scrollTo = function (target, opts) {
      if (lenis) lenis.scrollTo(target, Object.assign({ duration: 1.5, easing: function (t) { return 1 - Math.pow(1 - t, 4); } }, opts || {}));
      else { var y = typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY; window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' }); }
    };
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href'); if (id.length < 2) return;
        var el = id === '#top' ? 0 : $(id); if (el === null) return;
        e.preventDefault(); closeMenu(true); scrollTo(el);
      });
    });
    var svcList = $('#svcList'); if (svcList) svcList.setAttribute('data-lenis-prevent', '');

    /* ----- Découpage de texte ----- */
    function splitWords(el) {
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = doc.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (p) {
              if (!p) return;
              if (/^\s+$/.test(p)) { frag.appendChild(doc.createTextNode(' ')); return; }
              var w = doc.createElement('span'); w.className = 'w';
              var i = doc.createElement('span'); i.className = 'wi'; i.textContent = p;
              w.appendChild(i); frag.appendChild(w);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
        });
      })(el);
      return $$('.wi', el);
    }
    function splitChars(el) {
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = doc.createDocumentFragment();
            Array.from(n.textContent).forEach(function (c) {
              if (c === ' ') { frag.appendChild(doc.createTextNode(' ')); return; }
              var s = doc.createElement('span'); s.className = 'char'; s.setAttribute('aria-hidden', 'true'); s.textContent = c; frag.appendChild(s);
            });
            node.replaceChild(frag, n);
          } else if (n.nodeType === 1) walk(n);
        });
      })(el);
      return $$('.char', el);
    }

    /* ----- Éléments qui apparaissent au scroll ----- */
    function revealAll() {
      $$('[data-split]').forEach(function (el) {
        var label = el.textContent.replace(/\s+/g, ' ').trim();
        var wis = splitWords(el); el.setAttribute('aria-label', label);
        $$('.w', el).forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
        if (reduce) { gsap.set(wis, { yPercent: 0 }); return; }
        gsap.set(wis, { yPercent: 112 });
        gsap.to(wis, { yPercent: 0, duration: 1.25, ease: 'expo.out', stagger: .055, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      $$('[data-reveal]').forEach(function (el) {
        if (reduce) { el.classList.add('is-in'); return; }
        el.style.transition = 'none';
        gsap.fromTo(el, { opacity: 0, y: 34 }, {
          opacity: 1, y: 0, duration: 1.1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          onComplete: function () { el.classList.add('is-in'); gsap.set(el, { clearProps: 'all' }); }
        });
      });
    }

    /* ----- Compteurs ----- */
    function counters() {
      $$('[data-count]').forEach(function (el) {
        var to = parseFloat(el.dataset.count), dec = parseInt(el.dataset.decimals || '0', 10);
        var pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
        var fmt = function (v) { return pre + v.toFixed(dec).replace('.', ',') + suf; };
        if (reduce) { el.textContent = fmt(to); return; }
        var o = { v: 0 };
        el.textContent = fmt(0);
        gsap.to(o, { v: to, duration: 2.4, ease: 'power3.out', onUpdate: function () { el.textContent = fmt(o.v); }, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      gsap.to('.stat__art .ring', { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', scrollTrigger: { trigger: '.stats__grid', start: 'top 80%', once: true } });
      gsap.to('.stat__trait', { scaleX: 1, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.stat--wide', start: 'top 85%', once: true } });
      $$('.stat').forEach(function (s) {
        s.addEventListener('pointermove', function (e) { var r = s.getBoundingClientRect(); s.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%'); s.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%'); });
      });
    }

    /* ----- Loader → hero ----- */
    var loader = $('#loader'), loaderCount = $('#loaderCount');
    var heroTitleChars = [];
    var heroTitle = $('#hero-title');
    if (heroTitle) {
      heroTitle.setAttribute('aria-label', heroTitle.textContent.replace(/\s+/g, ' ').trim());
      $$('.line', heroTitle).forEach(function (l) { l.setAttribute('aria-hidden', 'true'); });
      $$('[data-chars]', heroTitle).forEach(function (el) { heroTitleChars = heroTitleChars.concat(splitChars(el)); });
      if (!reduce) gsap.set(heroTitleChars, { yPercent: 108 });
    }
    var introDone = false;
    function finishIntro() {
      if (introDone) return; introDone = true;
      body.classList.remove('is-loading');
      if (loader) loader.remove();
      if (lenis) lenis.start();
      ScrollTrigger.refresh();
    }

    var introStarted = false;
    function runIntro() {
      if (introStarted) return; introStarted = true;
      var video = $('#heroVideo');
      startVideo(video);
      if (reduce) {
        gsap.set(['.nav', '[data-hero-in]'], { opacity: 1, y: 0 });
        gsap.set(heroTitleChars, { yPercent: 0 });
        gsap.set('.hero__trait', { scaleX: 1 });
        gsap.set('.hero__botanic .draw', { strokeDashoffset: 0 });
        gsap.set('.hero__botanic use', { opacity: 1 });
        finishIntro(); return;
      }
      var tl = gsap.timeline({ onComplete: finishIntro });
      tl.to('.loader__center', { opacity: 0, y: -40, duration: .7, ease: 'power3.in' })
        .set(loader, { backgroundColor: 'transparent' })
        .to('.loader__lid--top', { yPercent: -104, duration: 1.7, ease: 'expo.inOut' }, '<.05')
        .to('.loader__lid--bottom', { yPercent: 104, duration: 1.7, ease: 'expo.inOut' }, '<')
        .fromTo('.hero__media', { scale: 1.28 }, { scale: 1, duration: 2.8, ease: 'power3.out' }, '<')
        .to(heroTitleChars, { yPercent: 0, duration: 1.4, ease: 'expo.out', stagger: .05 }, '-=1.15')
        .to('.hero__trait', { scaleX: 1, duration: 1.6, ease: 'expo.out' }, '-=1.0')
        .to('.hero__botanic .draw', { strokeDashoffset: 0, duration: 2.6, ease: 'power2.inOut', stagger: .12 }, '-=1.6')
        .to('.hero__botanic use', { opacity: 1, duration: 1.2, ease: 'power2.out', stagger: .08 }, '-=1.6')
        .to('[data-hero-in]', { opacity: 1, y: 0, duration: 1.1, ease: 'power3.out', stagger: .12 }, '-=1.3')
        .to('.nav', { opacity: 1, duration: 1, ease: 'power2.out' }, '-=1.1');
    }

    function startLoader() {
      if (reduce || !loader) { runIntro(); return; }
      gsap.set('.loader__trait', { scaleX: 0 });
      gsap.set('.loader__name span, .loader__name em', { yPercent: 115 });
      var o = { v: 0 }, ready = false, opened = false;
      var show = function () { loaderCount.textContent = Math.round(o.v); };
      gsap.to('.loader__trait', { scaleX: 1, duration: 1.8, ease: 'expo.out' });
      gsap.to('.loader__name span, .loader__name em', { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .12, delay: .15 });
      var fill = gsap.to(o, { v: 88, duration: 1.9, ease: 'power2.out', onUpdate: show });
      var open = function () {
        if (opened) return; opened = true; fill.kill();
        gsap.to(o, { v: 100, duration: .55, ease: 'power1.out', onUpdate: show, onComplete: function () { gsap.delayedCall(.15, runIntro); } });
      };
      var poster = new Promise(function (res) { var i = new Image(); i.onload = i.onerror = res; i.src = 'poster.jpg'; });
      var fonts = doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve();
      Promise.all([poster, fonts]).then(function () { ready = true; gsap.delayedCall(Math.max(0, 2.0 - fill.time()), open); });
      setTimeout(open, 4800);
    }

    /* ----- Navigation ----- */
    var nav = $('#nav'), lastY = 0;
    function onScroll() {
      var y = window.scrollY, dy = y - lastY;
      nav.classList.toggle('is-scrolled', y > 40);
      if (y > 220 && dy > 6 && !menuOpen) nav.classList.add('is-hidden');
      else if (dy < -6 || y < 220) nav.classList.remove('is-hidden');
      lastY = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    var burger = $('#burger'), menu = $('#menu'), menuOpen = false, menuTl = null;
    function buildMenu() {
      menuTl = gsap.timeline({ paused: true, defaults: { ease: 'expo.inOut' } });
      menuTl.set(menu, { visibility: 'visible' })
        .to('.menu__bg', { clipPath: 'circle(150% at calc(100% - 3rem) 2.6rem)', duration: 1.1 })
        .fromTo('.menu__nav a > *', { yPercent: 110 }, { yPercent: 0, duration: .9, ease: 'expo.out', stagger: .05 }, '-=.6')
        .fromTo('.menu__foot > *', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: .8, ease: 'power3.out', stagger: .08 }, '-=.6');
    }
    function wrapMenuLinks() {
      $$('.menu__nav a').forEach(function (a) {
        var s = a.querySelector('span'), t = doc.createElement('em'); t.style.fontStyle = 'normal';
        while (s.nextSibling) t.appendChild(s.nextSibling);
        a.appendChild(t);
      });
    }
    function openMenu() {
      if (menuOpen) return; menuOpen = true;
      burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Fermer le menu'); menu.setAttribute('aria-hidden', 'false');
      nav.classList.remove('is-hidden'); if (lenis) lenis.stop(); body.style.overflow = 'hidden';
      if (reduce) { menu.style.visibility = 'visible'; menu.querySelector('.menu__bg').style.clipPath = 'none'; return; }
      menuTl.timeScale(1).play();
    }
    function closeMenu(fast) {
      if (!menuOpen) return; menuOpen = false;
      burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Ouvrir le menu'); menu.setAttribute('aria-hidden', 'true');
      body.style.overflow = ''; if (lenis) lenis.start();
      if (reduce) { menu.style.visibility = 'hidden'; return; }
      menuTl.timeScale(fast ? 3 : 1.6).reverse();
    }
    wrapMenuLinks(); buildMenu();
    burger.addEventListener('click', function () { menuOpen ? closeMenu() : openMenu(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMenu(); });

    /* ----- Barre de progression ----- */
    if (!reduce) gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });
    else { var bar = $('.progress i'); window.addEventListener('scroll', function () { bar.style.transform = 'scaleX(' + (scrollY / (root.scrollHeight - innerHeight || 1)) + ')'; }, { passive: true }); }

    /* ----- Hero : parallax multicouche ----- */
    if (!reduce) {
      var heroST = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.hero__media', { yPercent: 14, ease: 'none', scrollTrigger: heroST });
      $$('.hero [data-depth]').forEach(function (el) {
        var d = parseFloat(el.dataset.depth);
        gsap.to(el, { y: function () { return -d * innerHeight * 1.1; }, ease: 'none', scrollTrigger: heroST });
      });
      gsap.to('.hero__ghost span', { xPercent: -14, ease: 'none', scrollTrigger: heroST });
      gsap.to('.hero__inner', { opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true } });
      if (finePointer) {
        var qx = [], layers = [['.hero__botanic--l', 26], ['.hero__botanic--r', -18], ['.hero__ghost span', 8]];
        layers.forEach(function (l) { var el = $(l[0]); if (el) qx.push({ x: gsap.quickTo(el, 'xPercent', { duration: 1.4, ease: 'power3' }), k: l[1] }); });
        $('.hero').addEventListener('pointermove', function (e) {
          var nx = e.clientX / innerWidth - .5; qx.forEach(function (q) { q.x(nx * q.k); });
        });
      }
      var video = $('#heroVideo');
      ScrollTrigger.create({ trigger: '.hero', start: 'top top', end: 'bottom top', onToggle: function (self) { if (!video.dataset.ready) return; if (self.isActive) { var p = video.play(); if (p && p.catch) p.catch(function () { }); } else video.pause(); } });
    }

    /* ----- Marquee réactif au scroll ----- */
    (function marquee() {
      var rows = $$('[data-marquee] .marquee__row'); if (!rows.length) return;
      var st = rows.map(function (row) {
        var track = row.querySelector('.marquee__track'); track.innerHTML += track.innerHTML;
        return { row: row, track: track, dir: parseFloat(row.dataset.dir) || -1, x: 0, w: 0 };
      });
      var measure = function () { st.forEach(function (s) { s.w = s.track.scrollWidth / 2; s.x = -((-s.x) % s.w) || 0; }); };
      measure(); window.addEventListener('resize', measure); doc.fonts && doc.fonts.ready.then(measure);
      if (reduce) return;
      var last = window.scrollY, vel = 0;
      gsap.ticker.add(function (t, dt) {
        var y = window.scrollY, dy = y - last; last = y;
        vel += (dy - vel) * .12;
        var skew = Math.max(-9, Math.min(9, -vel * .28));
        st.forEach(function (s) {
          var speed = 70 + 0; // px/s de base
          s.x += s.dir * (speed + vel * 38) * (dt / 1000);
          if (s.x <= -s.w) s.x += s.w; else if (s.x > 0) s.x -= s.w;
          gsap.set(s.track, { x: s.x, skewX: skew });
        });
      });
    })();

    /* ----- Savoir-faire : étapes collantes ----- */
    (function story() {
      var steps = $$('.step'), imgs = $$('.story__img'), idx = $('.story__index b'), z = 5, cur = 0;
      if (!steps.length) return;
      function setStep(i) {
        if (i === cur) return; cur = i;
        steps.forEach(function (s, k) { s.classList.toggle('is-active', k === i); });
        var img = imgs[i]; if (!img) return;
        img.style.transition = 'none'; img.classList.remove('is-active'); img.style.zIndex = ++z; void img.offsetWidth;
        img.style.transition = ''; img.classList.add('is-active');
        if (idx) idx.textContent = '0' + (i + 1);
      }
      steps.forEach(function (s, i) {
        ScrollTrigger.create({ trigger: s, start: function () { return isDesktop() ? 'top 58%' : 'top 70%'; }, end: function () { return isDesktop() ? 'bottom 58%' : 'bottom 70%'; }, onEnter: function () { setStep(i); }, onEnterBack: function () { setStep(i); } });
      });
      ScrollTrigger.create({ trigger: '.story__head', start: 'top 80%', end: 'bottom 40%', onEnterBack: function () { setStep(0); }, onLeaveBack: function () { setStep(0); } });
      if (reduce) return;
      gsap.to('.story__line i', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.story__steps', start: 'top 60%', end: 'bottom 60%', scrub: true } });
      gsap.from('.story__frame', { yPercent: 10, opacity: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: '.story__inner', start: 'top 70%', once: true } });
    })();

    /* ----- La carte : défilement horizontal épinglé (bureau) ----- */
    (function carte() {
      var rail = $('#carteRail'); if (!rail) return;
      if (!reduce) {
        var mm = gsap.matchMedia();
        mm.add('(min-width: 901px)', function () {
          var dist = function () { return Math.max(0, rail.scrollWidth - window.innerWidth + 40); };
          var tween = gsap.to(rail, {
            x: function () { return -dist(); }, ease: 'none',
            scrollTrigger: { trigger: '.carte__pin', start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: .9, invalidateOnRefresh: true, anticipatePin: 1 }
          });
          gsap.to('.carte__bar i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.carte__pin', start: 'top top', end: function () { return '+=' + dist(); }, scrub: true, invalidateOnRefresh: true } });
          $$('.card__media img').forEach(function (img) {
            gsap.fromTo(img, { xPercent: -4 }, { xPercent: 4, ease: 'none', scrollTrigger: { trigger: img.closest('.card'), containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
          });
          gsap.from('.card', { y: 70, opacity: 0, rotate: 2, duration: 1.4, ease: 'expo.out', stagger: .12, scrollTrigger: { trigger: '.carte__pin', start: 'top 70%', once: true } });
        });
      }
    })();

    /* ----- Inclinaison 3D + reflet (cartes, galerie) ----- */
    if (finePointer && !reduce) {
      $$('[data-tilt], [data-tilt-soft]').forEach(function (el) {
        var k = el.hasAttribute('data-tilt') ? 9 : 5;
        el.addEventListener('pointermove', function (e) {
          var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.style.setProperty('--mx', (px * 100) + '%'); el.style.setProperty('--my', (py * 100) + '%');
          gsap.to(el, { rotateY: (px - .5) * k * 2, rotateX: -(py - .5) * k * 2, transformPerspective: 900, duration: .6, ease: 'power3.out', overwrite: 'auto' });
        });
        el.addEventListener('pointerleave', function () { gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1,.6)', overwrite: 'auto' }); });
      });
    }

    /* ----- Sélection de prestations depuis les cartes ----- */
    (function picks() {
      var bar = doc.createElement('div');
      bar.className = 'pickbar'; bar.setAttribute('role', 'status'); bar.setAttribute('aria-live', 'polite');
      bar.innerHTML = '<span class="pickbar__txt"></span><a class="btn btn--gold btn--sm" href="#reserver"><span class="btn__fill"></span><span class="btn__label">Réserver ma sélection</span></a>';
      body.appendChild(bar);
      var txt = $('.pickbar__txt', bar), inBook = false;
      bar.querySelector('a').addEventListener('click', function (e) { e.preventDefault(); scrollTo($('#reserver')); });
      var refresh = function (d) { var on = d && d.count > 0 && !inBook; bar.classList.toggle('is-on', !!on); if (d && d.count) txt.innerHTML = '<b>' + d.count + '</b> prestation' + (d.count > 1 ? 's' : '') + (d.sum ? ' · ' + d.sum.toLocaleString('fr-FR') + ' €' : ''); };
      var last = null;
      doc.addEventListener('booking:change', function (e) { last = e.detail; refresh(last); });
      ScrollTrigger.create({ trigger: '#reserver', start: 'top 75%', end: 'bottom top', onToggle: function (s) { inBook = s.isActive; refresh(last); } });
      $$('.price-row button').forEach(function (b) {
        var li = b.closest('.price-row');
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', function () {
          if (!window.Booking) return;
          var on = window.Booking.toggle(li.dataset.id);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
      });
    })();

    /* ----- Chiffres, révélations ----- */
    revealAll(); counters();

    /* ----- Galerie : colonnes parallaxe, images, filtres, lightbox ----- */
    (function gallery() {
      var items = $$('.gitem'); if (!items.length) return;
      if (!reduce) {
        items.forEach(function (it) {
          gsap.fromTo(it, { clipPath: 'inset(14% 10% 14% 10% round 22px)', opacity: 0 }, { clipPath: 'inset(0% 0% 0% 0% round 22px)', opacity: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: it, start: 'top 93%', once: true }, onComplete: function () { gsap.set(it, { clearProps: 'clipPath,opacity' }); } });
          var im = $('img', it);
          gsap.fromTo(im, { yPercent: -7, scale: 1.14 }, { yPercent: 7, scale: 1.14, ease: 'none', scrollTrigger: { trigger: it, start: 'top bottom', end: 'bottom top', scrub: true } });
        });
        var mm = gsap.matchMedia();
        mm.add('(min-width: 901px)', function () {
          var sp = [-40, -150, -80];
          $$('.gcol').forEach(function (c, i) {
            gsap.to(c, { y: sp[i] || -60, ease: 'none', scrollTrigger: { trigger: '.gallery__cols', start: 'top bottom', end: 'bottom top', scrub: true } });
          });
        });
      }
      /* filtres */
      var chips = $$('.chip');
      chips.forEach(function (c) {
        c.addEventListener('click', function () {
          chips.forEach(function (x) { x.classList.toggle('is-active', x === c); });
          var f = c.dataset.filter;
          var show = [], hide = [];
          items.forEach(function (it) { var m = f === 'all' || it.dataset.cat.split(' ').indexOf(f) > -1; (m ? show : hide).push(it); });
          if (reduce) { hide.forEach(function (it) { it.classList.add('is-hidden'); }); show.forEach(function (it) { it.classList.remove('is-hidden'); }); ScrollTrigger.refresh(); return; }
          var apply = function () {
            hide.forEach(function (it) { it.classList.add('is-hidden'); });
            show.forEach(function (it) { it.classList.remove('is-hidden'); });
            if (show.length) gsap.fromTo(show, { opacity: 0, scale: .92 }, { opacity: 1, scale: 1, duration: .8, ease: 'expo.out', stagger: .05, clearProps: 'opacity,scale' });
            ScrollTrigger.refresh();
          };
          if (hide.length) gsap.to(hide, { opacity: 0, scale: .92, duration: .4, ease: 'power2.in', onComplete: apply }); else apply();
        });
      });
      /* lightbox */
      var lb = $('#lb'), lbImg = $('#lbImg'), lbCap = $('#lbCap'), list = [], pos = 0;
      function paint() {
        var it = list[pos], im = $('img', it), cap = $('figcaption', it);
        lbImg.src = im.currentSrc || im.src; lbImg.alt = im.alt; lbCap.textContent = cap ? cap.textContent.replace(/\s+/g, ' ').trim() : '';
        if (!reduce) gsap.fromTo(lbImg, { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .7, ease: 'expo.out' });
      }
      function open(it) {
        list = items.filter(function (x) { return !x.classList.contains('is-hidden'); }); pos = list.indexOf(it);
        if (typeof lb.showModal === 'function') lb.showModal(); else lb.setAttribute('open', '');
        if (lenis) lenis.stop(); paint(); $('#lbClose').focus();
      }
      function close() { if (lb.close) lb.close(); else lb.removeAttribute('open'); }
      function step(d) { pos = (pos + d + list.length) % list.length; paint(); }
      items.forEach(function (it) { $('.gitem__btn', it).addEventListener('click', function () { open(it); }); });
      $('#lbClose').addEventListener('click', close);
      $('#lbPrev').addEventListener('click', function () { step(-1); });
      $('#lbNext').addEventListener('click', function () { step(1); });
      lb.addEventListener('close', function () { if (lenis) lenis.start(); });
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
      lb.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') step(1); if (e.key === 'ArrowLeft') step(-1); });
    })();

    /* ----- Belles d'Octobre ----- */
    (function belles() {
      if (reduce) { gsap.set('.belles__ribbon .draw', { strokeDashoffset: 0 }); return; }
      $$('[data-reveal-circle]').forEach(function (img, i) {
        gsap.fromTo(img, { clipPath: 'circle(0% at 50% 50%)', scale: 1.35 }, { clipPath: 'circle(78% at 50% 50%)', scale: 1, duration: 1.9, ease: 'expo.out', delay: i * .12, scrollTrigger: { trigger: '.belles__photos', start: 'top 75%', once: true }, onComplete: function () { gsap.set(img, { clearProps: 'clipPath' }); } });
      });
      gsap.to('.belles__ribbon .draw', { strokeDashoffset: 0, ease: 'none', stagger: .25, scrollTrigger: { trigger: '.belles', start: 'top 70%', end: 'center 30%', scrub: true } });
      if (isDesktop()) {
        gsap.to('.belles__ph--a', { y: -50, ease: 'none', scrollTrigger: { trigger: '.belles', start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.to('.belles__ph--b', { y: 70, ease: 'none', scrollTrigger: { trigger: '.belles', start: 'top bottom', end: 'bottom top', scrub: true } });
        gsap.to('.belles__ph--c', { y: -30, rotate: 2, ease: 'none', scrollTrigger: { trigger: '.belles', start: 'top bottom', end: 'bottom top', scrub: true } });
      }
    })();

    /* ----- Avis : carrousel (défilement natif + glisser + boutons) ----- */
    (function reviews() {
      var track = $('#rvTrack'); if (!track) return;
      var bar = $('.rv__bar i'), prev = $('#rvPrev'), next = $('#rvNext');
      var step = function () { var c = $('.rcard', track); return c ? c.getBoundingClientRect().width + 20 : 320; };
      var upd = function () {
        var max = track.scrollWidth - track.clientWidth;
        var vis = track.clientWidth / track.scrollWidth, p = max > 0 ? track.scrollLeft / max : 0;
        bar.style.width = (vis * 100) + '%';
        bar.style.transform = 'translateX(' + (p * (1 / vis - 1) * 100) + '%)';
        prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft > max - 4;
        prev.style.opacity = prev.disabled ? .35 : 1; next.style.opacity = next.disabled ? .35 : 1;
      };
      track.addEventListener('scroll', upd, { passive: true }); window.addEventListener('resize', upd); upd();
      prev.addEventListener('click', function () { track.scrollBy({ left: -step() * 1.5, behavior: 'smooth' }); });
      next.addEventListener('click', function () { track.scrollBy({ left: step() * 1.5, behavior: 'smooth' }); });
      track.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { track.scrollBy({ left: step(), behavior: 'smooth' }); e.preventDefault(); } if (e.key === 'ArrowLeft') { track.scrollBy({ left: -step(), behavior: 'smooth' }); e.preventDefault(); } });
      var down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
      window.addEventListener('pointermove', function (e) { if (!down) return; var dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; track.classList.add('is-drag'); } track.scrollLeft = sl - dx; });
      window.addEventListener('pointerup', function () { if (!down) return; down = false; track.classList.remove('is-drag'); });
      track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
      if (!reduce) {
        gsap.from('.rcard', { y: 80, opacity: 0, rotate: 3, duration: 1.3, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '.rv', start: 'top 82%', once: true }, clearProps: 'all' });
        gsap.from('.reviews__big', { opacity: 0, scale: .8, transformOrigin: 'left center', duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.reviews__score', start: 'top 90%', once: true } });
      }
    })();

    /* ----- FAQ : accordéon animé ----- */
    $$('.qa').forEach(function (d) {
      var a = $('.qa__a', d);
      $('summary', d).addEventListener('click', function (e) {
        e.preventDefault();
        if (reduce) { d.open = !d.open; d.classList.toggle('is-open', d.open); return; }
        gsap.killTweensOf(a);
        if (d.open) {
          d.classList.remove('is-open');
          gsap.to(a, { height: 0, duration: .6, ease: 'power3.inOut', onComplete: function () { d.open = false; gsap.set(a, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
        } else {
          d.open = true; d.classList.add('is-open');
          gsap.fromTo(a, { height: 0 }, { height: 'auto', duration: .75, ease: 'power3.out', onComplete: function () { gsap.set(a, { clearProps: 'height' }); ScrollTrigger.refresh(); } });
        }
      });
    });

    /* ----- Réserver : fond en parallaxe ----- */
    if (!reduce) {
      gsap.fromTo('.book__bg img', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.book', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.from('.wiz', { y: 90, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.wiz', start: 'top 88%', once: true }, clearProps: 'all' });
    }

    /* ----- Accès : horaires du jour + ouvert / fermé ----- */
    (function hours() {
      var status = $('#openStatus'); if (!status) return;
      var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      var wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      var d = wd[parts.filter(function (p) { return p.type === 'weekday'; })[0].value];
      var h = parseInt(parts.filter(function (p) { return p.type === 'hour'; })[0].value, 10) % 24;
      var open = [1, 2, 4, 5].indexOf(d) > -1 && h >= 9 && h < 17;
      var row = $('#hoursBody tr[data-d="' + d + '"]'); if (row) row.classList.add('is-today');
      var names = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'], label;
      if (open) label = 'Ouvert maintenant · jusqu’à 17 h';
      else {
        var n = d, add = 0; do { n = (n + 1) % 7; add++; } while ([1, 2, 4, 5].indexOf(n) < 0);
        var openToday = [1, 2, 4, 5].indexOf(d) > -1 && h < 9;
        label = 'Fermé · ouvre ' + (openToday ? 'aujourd’hui à 9 h' : (add === 1 ? 'demain' : names[n]) + ' à 9 h');
      }
      status.classList.add(open ? 'is-open' : 'is-closed'); status.querySelector('span').textContent = label;
    })();

    /* ----- Pied de page ----- */
    (function footer() {
      var chars = []; $$('[data-foot-word] span, [data-foot-word] em').forEach(function (el) { chars = chars.concat(splitChars(el)); });
      if (reduce) { gsap.set(chars, { yPercent: 0 }); } else {
        gsap.set(chars, { yPercent: 105 });
        gsap.to(chars, { yPercent: 0, duration: 1.5, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: '[data-foot-word]', start: 'top 92%', once: true } });
      }
      $('#toTop').addEventListener('click', function () { scrollTo(0); });
    })();

    /* ----- Bouton flottant mobile ----- */
    (function fab() {
      var f = $('#fab'); if (!f) return;
      var past = false, inBook = false;
      var upd = function () { f.classList.toggle('is-on', past && !inBook); };
      ScrollTrigger.create({ trigger: '.hero', start: 'bottom 70%', onEnter: function () { past = true; upd(); }, onLeaveBack: function () { past = false; upd(); } });
      ScrollTrigger.create({ trigger: '#reserver', start: 'top 80%', end: 'bottom 20%', onToggle: function (s) { inBook = s.isActive; upd(); } });
    })();

    /* ----- Curseur personnalisé ----- */
    if (finePointer && !reduce) {
      root.classList.add('has-cursor');
      var cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('.cursor__ring span');
      var rx = gsap.quickTo(ring, 'x', { duration: .55, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: .55, ease: 'power3' });
      var dx = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3' }), dy = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3' });
      window.addEventListener('pointermove', function (e) { cur.classList.remove('is-hidden'); rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); }, { passive: true });
      doc.addEventListener('pointerleave', function () { cur.classList.add('is-hidden'); });
      doc.addEventListener('pointerover', function (e) {
        var t = e.target;
        var view = t.closest('.gitem');
        var link = t.closest('a, button, summary, .svc__item, .day, .pill, .chip, [data-magnetic]');
        cur.classList.toggle('is-view', !!view); cur.classList.toggle('is-link', !!link && !view);
        label.textContent = view ? 'Voir' : '';
      });
      /* boutons magnétiques */
      $$('[data-magnetic]').forEach(function (b) {
        var inner = $('.btn__label', b);
        b.addEventListener('pointermove', function (e) {
          var r = b.getBoundingClientRect(), mx = e.clientX - (r.left + r.width / 2), my = e.clientY - (r.top + r.height / 2);
          gsap.to(b, { x: mx * .32, y: my * .45, duration: .6, ease: 'power3.out', overwrite: 'auto' });
          if (inner) gsap.to(inner, { x: mx * .12, y: my * .2, duration: .6, ease: 'power3.out', overwrite: 'auto' });
        });
        b.addEventListener('pointerleave', function () {
          gsap.to(b, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
          if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
        });
      });
    }

    /* ----- Go ----- */
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    startLoader();
    setTimeout(function () { if (!introStarted) { try { runIntro(); } catch (e) { rescue(e); } } }, 9000);
    setTimeout(function () { if (!introDone) finishIntro(); }, 16000);
  }
})();
