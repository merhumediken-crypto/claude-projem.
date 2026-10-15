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
  function toast(text, kind = 'success', ms){
    const t = String(text || '').trim(); if(!t || !document.body) return;
    // Under a phone's bottom sheet the only visible strip is the edited paragraph: no toast over it.
    if(kind !== 'error' && document.body.classList.contains('sheet-open') && window.matchMedia?.('(max-width: 760px)').matches) return;
    if(!toastBox){ toastBox = el('div', {class: 'toasts', 'aria-hidden': 'true'}); document.body.append(toastBox); }
    // The same note again (e.g. several edits in a row) refreshes instead of stacking.
    const last = toastBox.lastElementChild;
    if(last && last.dataset.text === t && !last.classList.contains('leaving')){ clearTimeout(Number(last.dataset.timer)); arm(last, ms ?? (kind === 'error' ? 7000 : 3200)); return; }
    const node = el('div', {class: `toast ${kind}`}, el('span', {class: 't-ico'}, icon(kind === 'error' ? 'i-alert' : 'i-tick')), el('span', {text: t}));
    node.dataset.text = t;
    node.addEventListener('click', () => leave(node));
    toastBox.append(node);
    while(toastBox.children.length > 3) toastBox.firstElementChild.remove();
    arm(node, ms ?? (kind === 'error' ? 7000 : 3200));
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
  commands.add({id: 'theme', group: 'Görünüm', label: 'Temayı değiştir', hint: 'Otomatik → açık → koyu', icon: 'i-moon', keywords: 'koyu açık karanlık gece tema', run: () => document.getElementById('themeToggle')?.click()});

  let pal = null, palPrev = null, palActive = 0, palItems = [];
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
    pal.addEventListener('mousedown', e => { if(e.target === pal) closePalette(); });
    input.addEventListener('input', () => { palActive = 0; renderPalette(); });
    dialog.addEventListener('keydown', e => {
      if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){ e.preventDefault(); if(palItems.length){ palActive = (palActive + (e.key === 'ArrowDown' ? 1 : -1) + palItems.length) % palItems.length; markActive(true); } }
      else if(e.key === 'Home' && e.target !== input){ e.preventDefault(); palActive = 0; markActive(true); }
      else if(e.key === 'Enter' && e.target === input){ e.preventDefault(); runActive(); }
      else if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); closePalette(); }
      else if(e.key === 'Tab'){ e.preventDefault(); (document.activeElement === input ? close : input).focus(); }
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
    // With a query: best matches first; without: in registration order, grouped.
    if(words.length) found.sort((a, b) => b.s - a.s || a.i - b.i);
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
    try{ c.run(); }catch(err){ toast(err.message || String(err), 'error'); }
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
      const li = el('li', {class: 'check-fixed'});
      li.append(el('span', {class: 'ci', 'aria-hidden': 'true'}, icon('i-tick')), el('span', {class: 'ct'}, el('strong', {text: 'Düzeltildi: '}), document.createTextNode(f.text)));
      if(f.undo) li.append(el('span', {class: 'ca'}, el('button', {type: 'button', class: 'secondary inline-btn', text: 'Geri al', onclick: f.undo})));
      rows.push(li);
    }
    ul.replaceChildren(...rows);
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
  // Fit to width (default) or a fixed scale; "−" / "+" step by 10 %.
  function zoomer({viewport, wrapper, paper, toggle, zoomIn, zoomOut, onChange = () => {}}){
    let fit = true, zoom = 1, scale = 1;
    function apply(){
      scale = WordToUDFPreview.fit(viewport, wrapper, paper, fit, zoom);
      toggle.setAttribute('aria-pressed', String(fit));
      toggle.textContent = fit ? `Sığdır · %${Math.round(scale * 100)}` : `%${Math.round(scale * 100)}`;
      toggle.title = fit ? 'Gerçek boyuta geç (%100)' : 'Sayfayı genişliğe sığdır';
      if(zoomOut) zoomOut.disabled = !fit && zoom <= .3;
      if(zoomIn) zoomIn.disabled = !fit && zoom >= 2;
      onChange(scale);
      return scale;
    }
    const step = d => { const base = Math.round((fit ? scale : zoom) * 10) / 10; fit = false; zoom = Math.min(2, Math.max(.3, Math.round((base + d) * 10) / 10)); apply(); };
    toggle.addEventListener('click', () => { if(fit){ fit = false; zoom = 1; } else fit = true; apply(); });
    zoomIn?.addEventListener('click', () => step(.1));
    zoomOut?.addEventListener('click', () => step(-.1));
    let t = 0; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(apply, 120); });
    return {apply, get scale(){ return scale; }, get fit(){ return fit; }};
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

  /* ------------------------------ fonts ------------------------------ */
  // The bundled Tinos (Times New Roman metrics) loads only when the preview
  // first needs it; tab stops and page guides are measured again then.
  function onFontsLoaded(fn){
    if(!document.fonts?.addEventListener) return;
    let t = 0;
    document.fonts.addEventListener('loadingdone', () => { clearTimeout(t); t = setTimeout(fn, 30); });
  }

  globalThis.WordToUDFUI = {toast, commands, openPalette, closePalette, checks, ring, download, zoomer, thumbs, onFontsLoaded, icon, el, fold, LEVEL_TEXT};
})();
