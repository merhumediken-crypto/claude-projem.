/* Theme: a colour palette (themes.css, made by tools/themes.py) and a mode —
 * automatic (follows the device), light or dark. Loaded in <head> so the page
 * never flashes in the wrong theme. The A4 paper always stays white: it shows
 * the printed document, not the app. The app-bar button opens the picker. */
(() => {
  'use strict';
  const KEY = 'wordtoudf.theme', PKEY = 'wordtoudf.palette';
  const MODES = [['auto', 'Otomatik'], ['light', 'Açık'], ['dark', 'Koyu']];
  // [id, name, character] — the same ids as tools/themes.py.
  const PALETTES = [
    ['lacivert', 'Lacivert & Altın', 'Resmî, mahkeme salonu'],
    ['bordo', 'Bordo & Fildişi', 'Sıcak, köklü büro'],
    ['zeytin', 'Zeytin & Kâğıt', 'Göz yormayan, sakin'],
    ['mermer', 'Mermer & Pirinç', 'Damarlı mermer, pirinç'],
    ['grafit', 'Grafit', 'Sade; koyuda tam siyah'],
    ['kontrast', 'Güneş', 'Yüksek kontrast, güneş altında'],
  ];
  const DEFAULT = 'lacivert';
  let mode = 'auto', palette = DEFAULT;
  try{
    const m = localStorage.getItem(KEY); if(MODES.some(x => x[0] === m)) mode = m;
    const p = localStorage.getItem(PKEY); if(PALETTES.some(x => x[0] === p)) palette = p;
  }catch{ /* storage unavailable: defaults */ }
  const root = document.documentElement;
  const nameOf = id => PALETTES.find(x => x[0] === id)?.[1] || id;
  const modeName = m => MODES.find(x => x[0] === m)?.[1] || m;
  // The phone's status bar takes the colour of the theme's app bar.
  function statusBar(){
    const meta = document.querySelector('meta[name="theme-color"]');
    const c = getComputedStyle(root).getPropertyValue('--chrome').trim();
    if(meta && c) meta.content = c;
  }
  function apply(){
    if(mode === 'auto') delete root.dataset.theme; else root.dataset.theme = mode;
    if(palette === DEFAULT) delete root.dataset.palette; else root.dataset.palette = palette;
    statusBar();
  }
  apply();
  // A short cross-fade when the theme changes (not when the page opens).
  let fade = 0;
  function change(fn){
    if(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){ root.classList.add('theme-fade'); clearTimeout(fade); fade = setTimeout(() => root.classList.remove('theme-fade'), 450); }
    fn(); apply(); syncAll();
  }
  function save(){ try{ localStorage.setItem(KEY, mode); localStorage.setItem(PKEY, palette); }catch{ /* ignore */ } }
  const setMode = m => { if(MODES.some(x => x[0] === m)) change(() => { mode = m; save(); }); };
  const setPalette = p => { if(PALETTES.some(x => x[0] === p)) change(() => { palette = p; save(); }); };

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for(const [k, v] of Object.entries(attrs)) if(k === 'text') n.textContent = v; else n.setAttribute(k, v);
    n.append(...kids); return n;
  };
  let btn = null, pop = null;
  function syncButton(){
    if(!btn) return;
    btn.dataset.mode = mode;
    const label = `Görünüm: ${nameOf(palette)}, ${modeName(mode).toLocaleLowerCase('tr-TR')}`;
    btn.setAttribute('aria-label', `${label} — değiştirmek için açın`);
    btn.title = label;
  }
  function syncAll(){
    syncButton();
    if(!pop) return;
    for(const r of pop.querySelectorAll('[role="radio"]')){
      const on = r.dataset.palette ? r.dataset.palette === palette : r.dataset.mode === mode;
      r.setAttribute('aria-checked', String(on)); r.tabIndex = on ? 0 : -1; r.classList.toggle('on', on);
    }
  }
  // Arrow keys move and choose inside a radio group (one tab stop per group).
  function radios(group, pick){
    group.addEventListener('click', e => { const r = e.target.closest('[role="radio"]'); if(r) pick(r); });
    group.addEventListener('keydown', e => {
      const list = [...group.querySelectorAll('[role="radio"]')], i = list.indexOf(document.activeElement);
      const step = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1}[e.key];
      if(i < 0 || !step) return;
      e.preventDefault();
      const next = list[(i + step + list.length) % list.length]; pick(next); next.focus();
    });
  }
  function place(){
    if(!pop || !btn) return;
    const r = btn.getBoundingClientRect(), narrow = window.innerWidth <= 760;
    pop.style.top = `${Math.round(r.bottom + 10)}px`;
    pop.style.right = narrow ? '12px' : `${Math.max(12, Math.round(window.innerWidth - r.right))}px`;
  }
  function close(focus){
    if(!pop) return;
    pop.remove(); pop = null;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('resize', place);
    if(focus) btn.focus();
  }
  function outside(e){ if(pop && !pop.contains(e.target) && !btn.contains(e.target)) close(false); }
  function open(){
    if(!btn) return;
    if(pop){ close(true); return; }
    const grid = el('div', {class: 'tp-grid', role: 'radiogroup', 'aria-labelledby': 'tpPalTitle'},
      ...PALETTES.map(([id, name, hint]) => el('button', {type: 'button', role: 'radio', class: 'tp-swatch', 'data-palette': id, 'aria-checked': 'false'},
        el('span', {class: 'sw-art', 'aria-hidden': 'true'}, el('span', {class: 'sw-bar'}), el('span', {class: 'sw-page'}), el('span', {class: 'sw-dot'})),
        el('span', {class: 'sw-name', text: name}), el('span', {class: 'sw-hint', text: hint}))));
    const modes = el('div', {class: 'segmented tp-modes', role: 'radiogroup', 'aria-labelledby': 'tpModeTitle'},
      ...MODES.map(([id, name]) => el('button', {type: 'button', role: 'radio', class: 'chip', 'data-mode': id, 'aria-checked': 'false', text: name})));
    pop = el('div', {class: 'theme-pop', role: 'dialog', 'aria-label': 'Görünüm ve tema'},
      el('span', {class: 'tp-title', id: 'tpPalTitle', text: 'Renk teması'}), grid,
      el('span', {class: 'tp-title', id: 'tpModeTitle', text: 'Açık / koyu'}), modes,
      el('p', {class: 'tp-note', text: 'Dilekçe kâğıdı her temada beyaz kalır; UYAP\'ta göreceğiniz gibi.'}));
    radios(grid, r => setPalette(r.dataset.palette));
    radios(modes, r => setMode(r.dataset.mode));
    pop.addEventListener('keydown', e => { if(e.key === 'Escape'){ e.stopPropagation(); close(true); } });
    document.body.append(pop);
    btn.setAttribute('aria-expanded', 'true');
    syncAll(); place();
    document.addEventListener('pointerdown', outside, true);
    window.addEventListener('resize', place);
    pop.querySelector('.tp-swatch[aria-checked="true"]')?.focus({preventScroll: true});
  }
  function init(){
    statusBar();
    btn = document.getElementById('themeToggle');
    if(!btn) return;
    btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
    syncButton();
    btn.addEventListener('click', open);
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  globalThis.WordToUDFTheme = {palettes: PALETTES, modes: MODES, get palette(){ return palette; }, get mode(){ return mode; }, setPalette, setMode, open, close: () => close(false)};
})();
