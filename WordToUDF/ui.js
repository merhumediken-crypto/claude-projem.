/* Shared interface layer (v1.11), loaded on every page right after the app
 * bar and before the page's own scripts:
 *  - toast(text, kind): short navy notes at the bottom right (the page's
 *    #status line stays the accessible, persistent message; toasts are a
 *    visual echo and are hidden from screen readers to avoid double reading),
 *  - the command palette (Ctrl+K or the "Komut ara" button): navigation,
 *    theme and whatever the page registers with commands.add(),
 *  - checks(): the check list with its ring gauge (converter and templates),
 *  - zoomer() and thumbs(): preview zoom (fit / steps) and page thumbnails,
 *  - download(): the idle → working → done state of a download button.
 * Everything is built with DOM methods; user text is only ever textContent.
 */
(() => {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for(const [k, v] of Object.entries(props)){
      if(k === 'class') n.className = v;
      else if(k === 'text') n.textContent = v;
      else if(k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if(v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...kids.filter(x => x !== null && x !== undefined && x !== false));
    return n;
  };
  const icon = (id, cls = 'icon') => {
    const s = document.createElementNS(SVG, 'svg'); s.setAttribute('class', cls); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS(SVG, 'use'); u.setAttribute('href', `#${id}`); s.append(u); return s;
  };
  // Turkish-aware search folding: "sure" finds "Süre", "itiraz" finds "İTİRAZ".
  const fold = s => String(s || '').toLocaleLowerCase('tr-TR').replace(/[çğıöşüâîû]/gu, c => ({ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u'})[c]).normalize('NFD').replace(/\p{M}/gu, '');
  const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Cards rise into place only while the page opens (workspace.css: .intro).
  document.documentElement.classList.add('intro');
  setTimeout(() => document.documentElement.classList.remove('intro'), 900);

  /* ------------------------------ toasts ------------------------------ */
  let toastBox = null;
  // action: {label, run} — a button in the note (e.g. "Geri al" after an edit).
  // Keyboard users have the same command elsewhere (Ctrl+Z), so it is not a tab stop.
  function toast(text, kind = 'success', ms, action){
    const t = String(text || '').trim(); if(!t || !document.body) return;
    // Under a phone's bottom sheet the only visible strip is the edited paragraph: no toast over it.
    if(kind !== 'error' && document.body.classList.contains('sheet-open') && window.matchMedia?.('(max-width: 760px)').matches) return;
    if(!toastBox){ toastBox = el('div', {class: 'toasts', 'aria-hidden': 'true'}); document.body.append(toastBox); }
    // The same note again (e.g. several edits in a row) refreshes instead of stacking.
    const last = toastBox.lastElementChild;
    const life = ms ?? (kind === 'error' ? 7000 : action ? 6000 : 3200);
    if(last && last.dataset.text === t && last.dataset.kind === kind && !last.classList.contains('leaving') && !action === !last.querySelector('.t-act')){ clearTimeout(Number(last.dataset.timer)); arm(last, life); return; }
    const act = action ? el('button', {type: 'button', class: 't-act', tabindex: '-1', text: action.label}) : null;
    const node = el('div', {class: `toast ${kind}` + (act ? ' has-act' : ''), title: 'Kapatmak için dokunun'}, el('span', {class: 't-ico'}, icon(kind === 'error' ? 'i-alert' : 'i-tick')), el('span', {class: 't-text', text: t}), act);
    act?.addEventListener('click', ev => { ev.stopPropagation(); leave(node); action.run(); });
    node.dataset.text = t; node.dataset.kind = kind;
    node.addEventListener('click', () => leave(node));
    // One note at a time: a new one replaces the previous (several edits in a row do not pile up over the page).
    for(const old of [...toastBox.children]){ clearTimeout(Number(old.dataset.timer)); leave(old); }
    // The phone's format bar sits where toasts appear: the note goes to the top instead.
    toastBox.classList.toggle('above', !!document.querySelector('.mark-pop.docked:not([hidden]), .tour-bar'));
    toastBox.append(node);
    arm(node, life);
  }
  function arm(node, ms){ node.dataset.timer = String(setTimeout(() => leave(node), ms)); }
  function leave(node){
    if(node.classList.contains('leaving')) return;
    node.classList.add('leaving');
    setTimeout(() => node.remove(), reduced() ? 0 : 260);
  }

  /* ------------------------------ command palette ------------------------------ */
  const registry = [];
  const commands = {
    // {id, group, label, hint, icon (sprite id) | letter, keywords, run(), when()}
    add(list){ for(const c of [].concat(list)) if(c && c.label && typeof c.run === 'function'){ const i = registry.findIndex(x => x.id && x.id === c.id); if(i >= 0) registry.splice(i, 1, c); else registry.push(c); } },
    remove(pred){ for(let i = registry.length - 1; i >= 0; i--) if(pred(registry[i])) registry.splice(i, 1); },
    list: () => registry.filter(c => !c.when || c.when())
  };
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const NAV = [['workspace.html', 'Dönüştür: Word → UDF', 'DOCX seç ya da metni yapıştır', 'i-doc'], ['templates.html', 'Şablondan dilekçe', 'Mazeret, ek süre, itirazlar, ıslah…', 'i-grid'],
    ['sure.html', 'Süre hesabı', 'Cevap, istinaf, itiraz; tatil ve adli tatil dahil', 'i-clock'], ['reverse.html', 'UDF → Word / PDF', 'UYAP dosyasını aç ve dönüştür', 'i-swap'], ['index.html', 'Ana sayfa', 'Bütün araçlar', 'i-layers']];
  commands.add(NAV.filter(([href]) => href !== page).map(([href, label, hint, ic]) => ({id: `nav:${href}`, group: 'Sayfalar', label, hint, icon: ic, keywords: href, run: () => { location.href = href; }})));
  // Theme picker and every palette / mode (theme.js) by name.
  const T = globalThis.WordToUDFTheme;
  commands.add({id: 'theme', group: 'Görünüm', label: 'Görünüm ve tema…', hint: 'Renk teması, açık / koyu', icon: 'i-moon', keywords: 'tema renk koyu açık karanlık gece görünüm', run: () => T ? T.open() : document.getElementById('themeToggle')?.click()});
  if(T){
    commands.add(T.palettes.map(([id, name, hint]) => ({id: `theme:${id}`, group: 'Görünüm', label: `Tema: ${name}`, hint, icon: 'i-moon', keywords: 'tema renk', when: () => T.palette !== id, run: () => T.setPalette(id)})));
    commands.add(T.modes.map(([id, name]) => ({id: `mode:${id}`, group: 'Görünüm', label: `${name} görünüm`, hint: id === 'auto' ? 'Cihazın ayarına göre' : '', icon: 'i-moon', keywords: 'tema koyu açık karanlık gece', when: () => T.mode !== id, run: () => T.setMode(id)})));
  }

  let pal = null, palPrev = null, palActive = 0, palItems = [], fullOff = null;
  function openPalette(){
    if(pal) return;
    palPrev = document.activeElement;
    const input = el('input', {type: 'text', id: 'palInput', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palList', 'aria-autocomplete': 'list',
      'aria-label': 'Komut ara', placeholder: 'Ne yapmak istiyorsunuz? ör. mazeret, istinaf, koyu, indir…', autocomplete: 'off', spellcheck: 'false'});
    const list = el('ul', {class: 'pal-list', id: 'palList', role: 'listbox', 'aria-label': 'Komutlar'});
    const close = el('button', {type: 'button', class: 'pal-close', text: 'Kapat', onclick: () => closePalette()});
    const dialog = el('div', {class: 'palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Komut ara'},
      el('div', {class: 'pal-head'}, icon('i-search'), input, close), list,
      el('div', {class: 'pal-foot'}, el('span', {}, el('kbd', {text: '↑↓'}), 'seç'), el('span', {}, el('kbd', {text: 'Enter'}), 'çalıştır'), el('span', {}, el('kbd', {text: 'Esc'}), 'kapat')));
    pal = el('div', {class: 'palette-backdrop'}, dialog);
    // The keyboard stays in the search box: a click on padding, a header or an item does not take focus away.
    pal.addEventListener('mousedown', e => {
      if(e.target === pal){ e.preventDefault(); closePalette(); return; }
      if(!e.target.closest('input, button')) e.preventDefault();
    });
    input.addEventListener('input', () => { palActive = 0; renderPalette(); });
    dialog.addEventListener('keydown', e => {
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if(palItems.length){ palActive = (palActive + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % palItems.length; markActive(true); } }
      else if(e.key === 'Home' && e.target !== input){ e.preventDefault(); palActive = 0; markActive(true); }
      else if(e.key === 'Enter' && e.target === input){ e.preventDefault(); runActive(); }
      else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closePalette(); }
      else if(e.key === 'Tab'){ e.preventDefault(); (document.activeElement === input ? close : input).focus(); }
      // Page shortcuts (Ctrl+F, Ctrl+Z, Ctrl+B …) must not act on the page behind the dialog.
      if((e.ctrlKey || e.metaKey) && e.key.toLocaleLowerCase('en-US') !== 'k') e.stopPropagation();
    });
    document.body.append(pal);
    renderPalette();
    input.focus();
  }
  function closePalette(){
    if(!pal) return;
    pal.remove(); pal = null; palItems = [];
    if(palPrev && palPrev.isConnected && typeof palPrev.focus === 'function') palPrev.focus({preventScroll: true});
    palPrev = null;
  }
  function score(c, words){
    if(!words.length) return 1;
    const label = fold(c.label), all = `${label} ${fold(c.hint)} ${fold(c.keywords)} ${fold(c.group)}`;
    if(!words.every(w => all.includes(w))) return 0;
    return label.startsWith(words[0]) ? 3 : label.includes(words[0]) ? 2 : 1;
  }
  function renderPalette(){
    const input = pal.querySelector('#palInput'), list = pal.querySelector('#palList');
    const words = fold(input.value).split(/\s+/u).filter(Boolean);
    const found = commands.list().map((c, i) => ({c, s: score(c, words), i})).filter(x => x.s > 0);
    // With a query: best matches first; without: grouped, groups in the order they first appear.
    if(words.length) found.sort((a, b) => b.s - a.s || a.i - b.i);
    else{ const order = new Map(); for(const x of found) if(!order.has(x.c.group)) order.set(x.c.group, order.size); found.sort((a, b) => order.get(a.c.group) - order.get(b.c.group) || a.i - b.i); }
    palItems = found.map(x => x.c).slice(0, 60);
    list.replaceChildren();
    let group = null;
    palItems.forEach((c, i) => {
      if(!words.length && c.group !== group){ group = c.group; list.append(el('li', {class: 'pal-group', role: 'presentation', text: group || 'Komutlar'})); }
      const ico = c.icon && c.icon.startsWith('i-') ? icon(c.icon) : document.createTextNode(c.icon || c.label[0]);
      const item = el('li', {class: 'pal-item', role: 'option', id: `pal-opt-${i}`, 'aria-selected': 'false'},
        el('span', {class: 'pal-ico', 'aria-hidden': 'true'}, ico), el('span', {class: 'pal-txt'}, el('strong', {text: c.label}), c.hint ? el('small', {text: c.hint}) : null));
      item.addEventListener('mousemove', () => { if(palActive !== i){ palActive = i; markActive(false); } });
      item.addEventListener('click', () => { palActive = i; runActive(); });
      list.append(item);
    });
    if(!palItems.length) list.append(el('li', {class: 'pal-empty', role: 'presentation', text: 'Eşleşen komut yok.'}));
    markActive(false);
  }
  function markActive(scroll){
    if(!pal) return;
    const input = pal.querySelector('#palInput');
    pal.querySelectorAll('.pal-item').forEach((n, i) => n.setAttribute('aria-selected', String(i === palActive)));
    const cur = pal.querySelector(`#pal-opt-${palActive}`);
    if(cur){ input.setAttribute('aria-activedescendant', cur.id); if(scroll) cur.scrollIntoView({block: 'nearest'}); } else input.removeAttribute('aria-activedescendant');
  }
  function runActive(){
    const c = palItems[palActive]; if(!c) return;
    closePalette();
    // Commands for the rest of the page leave the full-screen preview first.
    if(document.documentElement.classList.contains('full-preview') && !c.keepFull) fullOff?.();
    try{ c.run(); }catch(err){
      const msg = err.message || String(err), st = document.getElementById('status');
      if(st){ st.textContent = msg; st.className = 'status error'; }
      toast(msg, 'error');
    }
  }
  document.addEventListener('keydown', e => {
    if((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLocaleLowerCase('en-US') === 'k'){ e.preventDefault(); if(pal) closePalette(); else openPalette(); }
  });
  document.addEventListener('click', e => { if(e.target.closest?.('#cmdOpen')) openPalette(); });

  /* ------------------------------ checks + ring gauge ------------------------------ */
  const LEVEL_TEXT = {error: 'Hata', warn: 'Uyarı', info: 'Bilgi', suggest: 'Öneri'};
  const LEVEL_ICON = {error: 'i-alert', warn: 'i-alert', info: 'i-info', suggest: 'i-spark', fixed: 'i-tick'};
  // Ring gauge: one arc per open item (errors, warnings, suggestions, then
  // fixed ones in green); with more than 12 items one arc per category.
  function ring(svg, parts){
    if(!svg) return;
    const r = 40, C = 2 * Math.PI * r, total = parts.reduce((s, p) => s + p.n, 0);
    svg.replaceChildren();
    const circle = cls => { const c = document.createElementNS(SVG, 'circle'); c.setAttribute('cx', '50'); c.setAttribute('cy', '50'); c.setAttribute('r', String(r)); c.setAttribute('class', cls); return c; };
    svg.append(circle('ring-track'));
    if(!total){ svg.append(circle('ring-seg seg-ok')); return; }
    const arcs = total <= 12 ? parts.flatMap(p => Array.from({length: p.n}, () => ({cls: p.cls, n: 1}))) : parts.filter(p => p.n > 0);
    // Round caps add half the stroke at each end: the gap leaves room for both.
    const gap = arcs.length > 1 ? 15 : 0;
    let at = 0;
    for(const a of arcs){
      const share = C * a.n / total, len = Math.max(.01, share - gap);
      const c = circle(`ring-seg seg-${a.cls}`);
      c.setAttribute('stroke-dasharray', `${len.toFixed(2)} ${(C - len).toFixed(2)}`);
      c.setAttribute('stroke-dashoffset', (-(at + gap / 2)).toFixed(2));
      svg.append(c); at += share;
    }
  }
  /* ids: {list, stats, ring, big, small, legend}; checks: [{level, code, message, fix}]
     opts: {buttons(c) → [button], fixed: [{text, undo}]} */
  function checks(ids, list, {buttons = () => [], fixed = []} = {}){
    const $ = id => (id ? document.getElementById(id) : null);
    const ul = $(ids.list); if(!ul) return {};
    const counts = {error: 0, warn: 0, info: 0, suggest: 0};
    const rows = [];
    for(const c of list){
      counts[c.level] = (counts[c.level] || 0) + 1;
      const li = el('li', {class: `check-${c.level}`}); li.dataset.code = c.code || '';
      li.append(el('span', {class: 'ci', 'aria-hidden': 'true'}, icon(LEVEL_ICON[c.level] || 'i-info')),
        el('span', {class: 'ct'}, el('strong', {text: `${LEVEL_TEXT[c.level] || 'Bilgi'}: `}), document.createTextNode(c.message)));
      const btns = buttons(c).filter(Boolean);
      if(btns.length) li.append(el('span', {class: 'ca'}, ...btns));
      rows.push(li);
    }
    // Fixed suggestions stay listed (green) with a way back.
    for(const f of fixed){
      const li = el('li', {class: 'check-fixed'}); li.dataset.code = `fixed:${f.text}`;
      li.append(el('span', {class: 'ci', 'aria-hidden': 'true'}, icon('i-tick')), el('span', {class: 'ct'}, el('strong', {text: 'Düzeltildi: '}), document.createTextNode(f.text)));
      if(f.undo) li.append(el('span', {class: 'ca'}, el('button', {type: 'button', class: 'secondary inline-btn', text: 'Geri al', onclick: f.undo})));
      rows.push(li);
    }
    // The list is rebuilt after "Düzelt" / "Geri al": the keyboard focus stays in it.
    const had = ul.contains(document.activeElement) ? {code: document.activeElement.closest('li')?.dataset.code, text: document.activeElement.textContent} : null;
    ul.replaceChildren(...rows);
    if(had){
      const same = [...ul.querySelectorAll('li')].find(li => li.dataset.code === had.code)?.querySelector('button');
      const next = same || ul.querySelector('button');
      if(next) next.focus({preventScroll: true}); else{ ul.tabIndex = -1; ul.focus({preventScroll: true}); }
    }
    const stats = $(ids.stats);
    if(stats){
      stats.textContent = `${counts.error} hata · ${counts.warn} uyarı${counts.suggest ? ` · ${counts.suggest} öneri` : ''}`;
      stats.className = 'pill' + (counts.error ? ' pill-error' : counts.warn ? ' pill-warn' : ' pill-ok');
    }
    const open = counts.error + counts.warn + counts.suggest;
    ring($(ids.ring), [{cls: 'error', n: counts.error}, {cls: 'warn', n: counts.warn}, {cls: 'suggest', n: counts.suggest}, {cls: 'fixed', n: fixed.length}]);
    const svg = $(ids.ring);
    if(svg){ svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', open ? `${open} açık denetim maddesi` : 'Denetimde açık madde yok'); }
    if($(ids.big)) $(ids.big).textContent = open ? String(open) : 'Hazır';
    if($(ids.small)) $(ids.small).textContent = open ? (counts.error ? 'açık madde · önce hataları giderin' : counts.suggest ? 'açık madde · öneriler tek dokunuşla düzelir' : 'açık madde · göndermeden önce bakın') : (fixed.length ? 'Bütün öneriler uygulandı' : 'Denetimde açık madde yok');
    const legend = $(ids.legend);
    if(legend){
      const dot = (cls, text) => el('span', {}, el('i', {class: `l-${cls}`, 'aria-hidden': 'true'}), document.createTextNode(text));
      legend.replaceChildren(dot('error', `${counts.error} hata`), dot('warn', `${counts.warn} uyarı`), dot('suggest', `${counts.suggest} öneri`), ...(fixed.length ? [dot('fixed', `${fixed.length} düzeltildi`)] : []));
    }
    return counts;
  }

  /* ------------------------------ download button states ------------------------------ */
  const DL_TEXT = {idle: 'UDF oluştur ve indir', working: 'UDF hazırlanıyor ve doğrulanıyor…', done: 'İndirildi · UYAP\'ta açıp kontrol edin'};
  const dlTimers = new WeakMap();
  function download(btn, state){
    if(!btn) return;
    clearTimeout(dlTimers.get(btn));
    btn.dataset.state = state;
    const label = btn.querySelector('.dl-label'); if(label) label.textContent = DL_TEXT[state] || DL_TEXT.idle;
    if(state === 'done') dlTimers.set(btn, setTimeout(() => download(btn, 'idle'), 6000));
  }

  /* ------------------------------ preview zoom ------------------------------ */
  // Fit (default) or a fixed scale; "−" / "+" step by 10 %, two fingers pinch.
  // On phones "Sığdır" fits the text column (the empty margins are cut off).
  // full: a "Tam ekran" button that gives the preview the whole screen.
  const phone = () => window.matchMedia?.('(max-width: 760px)').matches;
  function zoomer({viewport, wrapper, paper, toggle, zoomIn, zoomOut, full, section, onChange = () => {}}){
    let fit = true, zoom = 1, scale = 1;
    const crop = () => phone() || !!section?.classList.contains('preview-full') && window.innerWidth < 900;
    // The paragraph editor is a side sheet on wide screens: while it is open
    // the preview (in full screen: the whole preview, tool row included)
    // starts right of it instead of lying under it.
    function makeRoom(){
      const full = !!section?.classList.contains('preview-full'), target = full ? section : viewport;
      for(const n of [section, viewport]) if(n) n.style.paddingLeft = '';
      const sheet = document.querySelector('.edit-sheet');
      if(!sheet || phone()) return;
      const right = sheet.offsetLeft + sheet.offsetWidth + 16, box = target.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(target).paddingLeft) || 0;
      if(right > box.left + pad && sheet.offsetLeft < box.right) target.style.paddingLeft = `${Math.round(right - box.left)}px`;
    }
    function apply(){
      makeRoom();
      scale = WordToUDFPreview.fit(viewport, wrapper, paper, fit, zoom, {crop: crop()});
      toggle.setAttribute('aria-pressed', String(fit));
      toggle.textContent = fit ? `Sığdır · %${Math.round(scale * 100)}` : `%${Math.round(scale * 100)}`;
      // The name says what the button is; pressed = fitted; the percentage is the visible extra.
      toggle.setAttribute('aria-label', `Sayfaya sığdır (şu an %${Math.round(scale * 100)})`);
      toggle.title = fit ? 'Gerçek boyuta geç (%100)' : (crop() ? 'Metni ekran genişliğine sığdır' : 'Sayfayı genişliğe sığdır');
      if(zoomOut) zoomOut.disabled = !fit && zoom <= .3;
      if(zoomIn) zoomIn.disabled = !fit && zoom >= 2;
      onChange(scale);
      return scale;
    }
    // Keep the point of the page under the fingers (or the middle of the
    // visible part) in place while the scale changes.
    function zoomTo(z, cx, cy){
      const v = viewport.getBoundingClientRect(), before = scale, pr = paper.getBoundingClientRect();
      // Buttons keep the left edge of the visible text in place (lines start there).
      const x = cx ?? Math.max(v.left, pr.left), y = cy ?? (Math.max(v.top, 0) + Math.min(v.bottom, window.innerHeight)) / 2;
      const px = (x - pr.left) / (before || 1), py = (y - pr.top) / (before || 1);
      fit = false; zoom = Math.min(2, Math.max(.3, z)); apply();
      const after = paper.getBoundingClientRect();
      const dx = after.left + px * scale - x, dy = after.top + py * scale - y;
      viewport.scrollLeft += dx;
      // Whatever the preview box cannot scroll, the page scrolls (phone, inline preview).
      const top0 = viewport.scrollTop; viewport.scrollTop = top0 + dy;
      const rest = dy - (viewport.scrollTop - top0);
      if(Math.abs(rest) > 1) window.scrollBy(0, rest);
    }
    const step = d => { const base = Math.round((fit ? scale : zoom) * 10) / 10; zoomTo(Math.round((base + d) * 10) / 10); };
    toggle.addEventListener('click', () => { if(fit) zoomTo(1); else{ fit = true; apply(); } });
    zoomIn?.addEventListener('click', () => step(.1));
    zoomOut?.addEventListener('click', () => step(-.1));
    // Pinch on the preview zooms the page, not the whole app (touch-action in workspace.css).
    let pinch = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => [(t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2];
    viewport.addEventListener('touchstart', e => { if(e.touches.length === 2){ pinch = {d: dist(e.touches), z: scale}; } }, {passive: true});
    viewport.addEventListener('touchmove', e => {
      if(!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const z = Math.round(pinch.z * dist(e.touches) / pinch.d * 100) / 100;
      if(Math.abs(z - scale) >= .01){ const [cx, cy] = mid(e.touches); zoomTo(z, cx, cy); }
    }, {passive: false});
    viewport.addEventListener('touchend', e => { if(e.touches.length < 2) pinch = null; }, {passive: true});
    // Full screen preview (phones above all): the page alone, scrollable both ways.
    function setFull(on){
      if(!section) return;
      section.classList.toggle('preview-full', on);
      document.documentElement.classList.toggle('full-preview', on);
      // Behind the full-screen preview nothing is reachable by Tab or a screen reader.
      for(const n of document.querySelectorAll('.appbar, .tabbar, .mobile-bar, main > :not(.layout), .layout > *')) if(n !== section) n.inert = on;
      if(full){ full.setAttribute('aria-pressed', String(on)); full.querySelector('.full-label').textContent = on ? 'Küçült' : 'Tam ekran'; full.title = on ? 'Tam ekrandan çık (Esc)' : 'Önizlemeyi tam ekran aç'; }
      fit = true; apply();
      viewport.scrollTop = 0;
      if(!on) section.scrollIntoView({block: 'start'});
      // The phone's "Önizleme" button disappears behind it: the focus moves to the toggle.
      full?.focus({preventScroll: true});
    }
    fullOff = () => { if(section?.classList.contains('preview-full')) setFull(false); };
    full?.addEventListener('click', () => setFull(!section.classList.contains('preview-full')));
    document.addEventListener('keydown', e => {
      // The edit panel, the format bar and the find box close first (editor-ui.js).
      if(e.key !== 'Escape' || !section?.classList.contains('preview-full')) return;
      if(document.querySelector('.edit-sheet, .palette-backdrop') || document.querySelector('.mark-pop:not([hidden])') || document.activeElement?.closest?.('.find-box')) return;
      setFull(false); full?.focus({preventScroll: true});
    });
    let t = 0; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(apply, 120); });
    document.addEventListener('wordtoudf:sheet', () => apply());
    return {apply, setFull, get scale(){ return scale; }, get fit(){ return fit; }};
  }

  /* ------------------------------ page thumbnails ------------------------------ */
  function thumbs({rail, viewport, paper, getScale}){
    if(!rail) return {update(){}};
    let pages = 0;
    const tops = () => {
      // Page n starts at the n-1th guide (paginate() writes them); page 1 at 0.
      const g = [...paper.querySelectorAll('.page-guide')].map(d => parseFloat(d.style.top) || 0).sort((a, b) => a - b);
      return [0, ...g];
    };
    function go(n){
      const y = (tops()[n - 1] || 0) * (getScale() || 1);
      const scrollable = viewport.scrollHeight > viewport.clientHeight + 4 && getComputedStyle(viewport).overflowY !== 'hidden';
      if(scrollable) viewport.scrollTo({top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth'});
      else{ const r = paper.getBoundingClientRect(); window.scrollTo({top: window.scrollY + r.top + y - 80, behavior: reduced() ? 'auto' : 'smooth'}); }
      mark(n);
    }
    function mark(n){ rail.querySelectorAll('.thumb').forEach((b, i) => b.setAttribute('aria-current', String(i + 1 === n))); }
    function current(){
      const s = getScale() || 1, y = viewport.scrollTop / s + 40;
      const t = tops(); let n = 1;
      for(let i = 0; i < t.length; i++) if(y >= t[i]) n = i + 1;
      return n;
    }
    viewport.addEventListener('scroll', () => { if(pages > 1) mark(current()); }, {passive: true});
    function update(n){
      pages = n > 0 ? n : 0;
      rail.classList.toggle('has-pages', pages > 0);
      rail.replaceChildren(...Array.from({length: pages}, (_, i) => el('button', {type: 'button', class: 'thumb', 'aria-label': `${i + 1}. sayfaya git`, 'aria-current': String(i === 0), onclick: () => go(i + 1)},
        el('span', {class: 'mini', 'aria-hidden': 'true'}), el('span', {text: String(i + 1)}))));
      if(pages > 1) mark(current());
    }
    return {update, go};
  }

  /* ------------------------------ section map ------------------------------ */
  // The petition's parts as chips above the preview (Künye, Konu, Açıklamalar,
  // I., II., Hukuki sebepler, Sonuç ve istem, İmza, Ekler): a tap goes there,
  // and the part in view is marked while the page scrolls.
  const sentenceCase = s => { const t = s.toLocaleLowerCase('tr-TR'); return t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1); };
  const headOf = p => p.textContent.replace(/\s+/gu, ' ').trim().split(/\s*[:\t]/u)[0].trim();
  const clip = (s, n) => s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
  // Where the visible part of the preview starts: its own box when it scrolls, else under the app bar.
  function viewTop(viewport){
    const own = viewport && viewport.scrollHeight > viewport.clientHeight + 1 && getComputedStyle(viewport).overflowY !== 'hidden';
    const bar = document.querySelector('.appbar')?.getBoundingClientRect().bottom || 0;
    return own ? Math.max(viewport.getBoundingClientRect().top, bar) : bar;
  }
  function sections({nav, paper, viewport}){
    if(!nav) return {update(){}};
    let items = [], current = -1, raf = 0;
    function update(){
      items = [];
      const seen = new Set();
      for(const p of paper.querySelectorAll('.paragraph[data-role]')){
        const r = p.dataset.role, head = headOf(p);
        let label = null, sub = false;
        if(r === 'court-heading'){ if(!seen.has('court')){ seen.add('court'); label = 'Başlık'; } }
        else if(r === 'metadata' || r === 'case-number'){ if(!seen.has('kunye')){ seen.add('kunye'); label = 'Künye'; } }
        else if(r === 'topic') label = 'Konu';
        else if(r === 'major-heading' || r === 'result-heading' || r === 'section-field') label = head ? sentenceCase(clip(head, 24)) : null;
        else if(r === 'section-heading'){
          // "II. HUKUKA AYKIRILIK" → "II. Hukuka aykırılık": the numeral stays as written.
          const m = /^((?:[IVXLCDM]+|\d+|[a-zçğıöşü])[.)]\s*)(.*)$/iu.exec(head);
          label = head ? clip(m ? m[1] + sentenceCase(m[2]) : sentenceCase(head), 26) : null; sub = true;
        }
        else if(r === 'signature'){ if(!seen.has('sig')){ seen.add('sig'); label = 'İmza'; } }
        else if(r === 'attachment-item'){ if(!seen.has('ek') && !items.some(x => /^ekler/iu.test(x.label))){ seen.add('ek'); label = 'Ekler'; } }
        if(label) items.push({p, label, sub});
      }
      nav.hidden = items.length < 3;
      nav.replaceChildren(...items.map((it, i) => el('button', {type: 'button', class: 'sec-chip' + (it.sub ? ' sub' : ''), 'data-i': String(i), text: it.label, title: `${it.label} bölümüne git`})));
      current = -1; spy();
    }
    nav.addEventListener('click', e => {
      const b = e.target.closest('.sec-chip'); if(!b) return;
      const it = items[Number(b.dataset.i)]; if(!it?.p.isConnected) return;
      it.p.scrollIntoView({block: 'start', behavior: reduced() ? 'auto' : 'smooth'});
      it.p.classList.remove('glow'); void it.p.offsetWidth; it.p.classList.add('glow');
    });
    function spy(){
      raf = 0;
      if(nav.hidden || !items.length) return;
      const line = viewTop(viewport) + 90;
      let at = 0;
      items.forEach((it, i) => { if(it.p.isConnected && it.p.getBoundingClientRect().top <= line) at = i; });
      if(at === current) return;
      current = at;
      nav.querySelectorAll('.sec-chip').forEach((b, i) => { b.classList.toggle('on', i === at); if(i === at) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      // Keep the marked chip in sight inside the strip (without scrolling the page).
      const b = nav.querySelector('.sec-chip.on');
      if(b && (b.offsetLeft < nav.scrollLeft || b.offsetLeft + b.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = Math.max(0, b.offsetLeft - 24);
    }
    document.addEventListener('scroll', () => { if(!raf) raf = requestAnimationFrame(spy); }, {capture: true, passive: true});
    return {update};
  }

  /* ------------------------------ check tour ------------------------------ */
  // "Kontrol turu": the findings one by one, the paragraphs each is about
  // marked on the page; ‹ › go through them, Esc ends the tour.
  function tour({button, getChecks, locate, actions = () => []}){
    let bar = null, list = [], i = 0, hits = [];
    const usable = () => (getChecks() || []).filter(c => c.code !== 'ok' && c.code !== 'profile');
    function clearHits(){ for(const p of hits) p.classList.remove('tour-hit'); hits = []; }
    function stop(){
      clearHits(); bar?.remove(); bar = null;
      button?.setAttribute('aria-pressed', 'false'); button?.classList.remove('on');
      document.removeEventListener('keydown', keys, true);
    }
    function keys(e){
      if(!bar) return;
      if(e.key === 'Escape' && !document.querySelector('.edit-sheet, .palette-backdrop, .theme-pop')){ e.preventDefault(); e.stopPropagation(); stop(); button?.focus({preventScroll: true}); }
    }
    function show(){
      clearHits();
      const c = list[i]; if(!c){ stop(); return; }
      hits = (locate(c) || []).filter(p => p.isConnected);
      for(const p of hits) p.classList.add('tour-hit');
      if(hits[0]){
        // Full screen keeps its own box; elsewhere the page scrolls.
        hits[0].scrollIntoView({block: 'center', behavior: reduced() ? 'auto' : 'smooth'});
      }
      const where = hits.length > 1 ? ` · ${hits.length} paragraf` : hits.length ? '' : ' · sayfada belirli bir yeri yok';
      bar.querySelector('.tb-level').textContent = LEVEL_TEXT[c.level] || 'Bilgi';
      bar.querySelector('.tb-level').className = `tb-level lv-${c.level}`;
      bar.querySelector('.tb-count').textContent = `${i + 1} / ${list.length}${where}`;
      bar.querySelector('.tb-text').textContent = c.message;
      bar.querySelector('.tb-prev').disabled = i === 0;
      bar.querySelector('.tb-next').disabled = i >= list.length - 1;
      bar.querySelector('.tb-acts').replaceChildren(...(actions(c) || []).filter(Boolean));
    }
    function start(){
      list = usable();
      if(!list.length){ toast('Denetimde gözden geçirilecek madde yok.'); return; }
      i = 0;
      bar = el('div', {class: 'tour-bar', role: 'region', 'aria-label': 'Kontrol turu', 'aria-live': 'polite'},
        el('div', {class: 'tb-top'}, el('span', {class: 'tb-level'}), el('span', {class: 'tb-count'}),
          el('span', {class: 'tb-nav'},
            el('button', {type: 'button', class: 'tb-prev', 'aria-label': 'Önceki madde', text: '‹', onclick: () => { if(i > 0){ i--; show(); } }}),
            el('button', {type: 'button', class: 'tb-next', 'aria-label': 'Sonraki madde', text: '›', onclick: () => { if(i < list.length - 1){ i++; show(); } }}),
            el('button', {type: 'button', class: 'tb-close', 'aria-label': 'Kontrol turunu bitir', text: '×', onclick: () => { stop(); button?.focus({preventScroll: true}); }}))),
        el('p', {class: 'tb-text'}), el('div', {class: 'tb-acts'}));
      document.body.append(bar);
      button?.setAttribute('aria-pressed', 'true'); button?.classList.add('on');
      document.addEventListener('keydown', keys, true);
      show();
      bar.querySelector('.tb-next:not(:disabled), .tb-close')?.focus({preventScroll: true});
    }
    // After a re-render (Düzelt, an edit): same finding if it is still there, else the next one.
    function refresh(){
      if(!bar) return;
      const code = list[i]?.code, msg = list[i]?.message;
      list = usable();
      if(!list.length){ stop(); toast('Denetimdeki bütün maddeler giderildi.'); return; }
      const j = list.findIndex(c => c.code === code && c.message === msg);
      i = j >= 0 ? j : Math.min(i, list.length - 1);
      show();
    }
    button?.addEventListener('click', () => bar ? stop() : start());
    return {start, stop, refresh, get active(){ return !!bar; }};
  }

  /* ------------------------------ before / after ------------------------------ */
  // "Karşılaştır": the source as it came (Word / pasted text) over the result;
  // a handle moves the border between "önce" (left) and "sonra" (right).
  function compare({button, wrapper, paper, renderSource, label = 'Önce'}){
    if(!button || !wrapper) return {sync(){}, off(){}, get on(){ return false; }};
    let over = null, handle = null, tags = null, f = .5, drag = false;
    const parse = () => {
      const t = paper.style.transform || '';
      return {s: Number(/scale\(([\d.]+)\)/u.exec(t)?.[1] || 1), tx: Number(/translateX\((-?[\d.]+)px\)/u.exec(t)?.[1] || 0)};
    };
    function sync(){
      if(!over) return;
      over.style.transform = paper.style.transform; over.style.transformOrigin = 'top left';
      const {s, tx} = parse(), w = wrapper.getBoundingClientRect().width;
      // The wrapper is as tall as the taller of the two pages.
      const h = Math.max(paper.offsetHeight, over.offsetHeight) * s;
      if(h > wrapper.offsetHeight + 1) wrapper.style.height = `${Math.round(h)}px`;
      const x = f * w, local = (x - tx) / s;
      over.style.clipPath = `inset(0 ${Math.max(0, over.offsetWidth - local)}px 0 0)`;
      handle.style.left = `${Math.round(x)}px`;
      handle.setAttribute('aria-valuenow', String(Math.round(f * 100)));
    }
    function setF(v){ f = Math.min(1, Math.max(0, v)); sync(); }
    function on(){
      over = el('article', {class: 'paper compare-paper', 'aria-hidden': 'true'});
      wrapper.classList.add('comparing'); wrapper.append(over);
      try{ renderSource(over); }catch{ off(); toast('Kaynağın önceki hali gösterilemedi.', 'error'); return; }
      tags = [el('span', {class: 'cmp-tag before', 'aria-hidden': 'true', text: label}), el('span', {class: 'cmp-tag after', 'aria-hidden': 'true', text: 'Sonra · UDF'})];
      handle = el('div', {class: 'cmp-handle', role: 'slider', tabindex: '0', 'aria-label': 'Önce / sonra ayırıcı (sol: önce, sağ: sonra)', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '50'}, el('span', {class: 'cmp-knob', 'aria-hidden': 'true'}));
      wrapper.append(...tags, handle);
      handle.addEventListener('pointerdown', e => { drag = true; handle.setPointerCapture(e.pointerId); e.preventDefault(); });
      handle.addEventListener('pointermove', e => { if(drag){ const r = wrapper.getBoundingClientRect(); setF((e.clientX - r.left) / r.width); } });
      const end = () => { drag = false; };
      handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
      handle.addEventListener('keydown', e => {
        const d = {ArrowLeft: -.05, ArrowRight: .05, Home: -1, End: 1}[e.key];
        if(d !== undefined){ e.preventDefault(); setF(f + d); }
      });
      button.setAttribute('aria-pressed', 'true'); button.classList.add('on');
      f = .5; sync();
    }
    function off(){
      if(!over && !handle) return;
      over?.remove(); handle?.remove(); for(const t of tags || []) t.remove();
      over = handle = tags = null;
      wrapper.classList.remove('comparing');
      button.setAttribute('aria-pressed', 'false'); button.classList.remove('on');
    }
    button.addEventListener('click', () => { if(over) off(); else on(); });
    return {sync, off, get on(){ return !!over; }};
  }

  /* ------------------------------ shared file ------------------------------ */
  // A file shared to the installed web app (sw.js keeps it in a local cache):
  // read once, deleted at once, the address cleaned. Nothing leaves the device.
  async function takeShared(){
    if(!new URLSearchParams(location.search).has('shared')) return null;
    history.replaceState(null, '', location.pathname + location.hash);
    try{
      const cache = await caches.open('wordtoudf-share'), res = await cache.match('shared-file');
      await cache.delete('shared-file');
      if(!res) return null;
      const name = decodeURIComponent(res.headers.get('X-File-Name') || 'paylasilan');
      return new File([await res.blob()], name, {type: res.headers.get('Content-Type') || ''});
    }catch{ return null; }
  }

  /* ------------------------------ fonts ------------------------------ */
  // The bundled Tinos (Times New Roman metrics) loads only when the preview
  // first needs it; tab stops and page guides are measured again then. The
  // interface fonts loading later (a Turkish letter in a toast, a heading)
  // do not change the preview and are ignored.
  function onFontsLoaded(fn){
    if(!document.fonts?.addEventListener) return;
    let t = 0;
    document.fonts.addEventListener('loadingdone', e => {
      if(e.fontfaces && !e.fontfaces.some(f => /tinos/iu.test(f.family))) return;
      clearTimeout(t); t = setTimeout(fn, 30);
    });
  }

  globalThis.WordToUDFUI = {toast, commands, openPalette, closePalette, checks, ring, download, zoomer, thumbs, sections, tour, compare, takeShared, onFontsLoaded, icon, el, fold, LEVEL_TEXT};
})();
