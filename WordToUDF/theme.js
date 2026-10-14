/* Theme: automatic (follows the device), light or dark. Loaded in <head> so
 * the page never flashes in the wrong theme. The A4 paper always stays white:
 * it shows the printed document, not the app. */
(() => {
  'use strict';
  const KEY = 'wordtoudf.theme';
  const MODES = ['auto', 'light', 'dark'];
  const LABEL = {auto: 'Tema: otomatik (cihaza göre)', light: 'Tema: açık', dark: 'Tema: koyu'};
  let mode = 'auto';
  try{ const v = localStorage.getItem(KEY); if(MODES.includes(v)) mode = v; }catch{ /* storage unavailable */ }
  const root = document.documentElement;
  const apply = () => { if(mode === 'auto') delete root.dataset.theme; else root.dataset.theme = mode; };
  apply();
  function sync(btn){
    btn.dataset.mode = mode;
    btn.setAttribute('aria-label', `${LABEL[mode]} — değiştirmek için tıklayın`);
    btn.title = LABEL[mode];
  }
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if(!btn) return;
    sync(btn);
    btn.addEventListener('click', () => {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      try{ localStorage.setItem(KEY, mode); }catch{ /* ignore */ }
      apply(); sync(btn);
    });
  });
})();
