/* User settings: attorney/office profile, kept out of the conversion code.
 *
 * DEFAULTS is the only place where the petition writer's own attorney is
 * named. Everything else (legal-typography.js, templates, checks) reads the
 * profile from here or from the saved copy in this browser's localStorage.
 * Nothing in this module ever leaves the device: export/import are plain
 * JSON files the user saves and opens themselves.
 */
(() => {
  'use strict';
  const KEY = 'wordtoudf.settings.v3';
  const LEGACY_KEY = 'wordtoudf.attorneys.v2';
  const UETS_RE = /^\d{5}-\d{5}-\d{5}$/u;
  const DEFAULTS = Object.freeze({
    version: 3,
    ownAttorney: Object.freeze({name: 'Av. Fatih NAKIŞLI', uets: '16615-16448-62422'}),
    otherEnabled: false,
    others: Object.freeze([]),
    // "{sıfat} {müvekkil} Vekili" / "{avukat}" — used by the template page.
    signature: Object.freeze({lines: Object.freeze(['{sifat} {muvekkil} Vekili', '{avukat}'])}),
    listMode: 'text',
    lineSpacing: 1.5,
    dateToday: true,
    markUets: true,
    splitRequests: false,
    // v1.10: download file name pattern ('' = source / template name) and
    // opt-in UDF features not yet confirmed in UYAP (text highlight).
    fileName: '',
    experimental: false
  });

  const str = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/gu, ' ').trim().slice(0, max);
  const normUets = v => str(v, 40).replace(/\s+/gu, '');
  function attorney(a){ return {name: str(a?.name, 120), uets: normUets(a?.uets)}; }

  // Accepts anything (old saves, imported files) and returns a clean object
  // with every field present. Unknown keys are dropped.
  function sanitize(input){
    const src = input && typeof input === 'object' ? input : {};
    const own = src.ownAttorney ?? src.own;
    const others = Array.isArray(src.others) ? src.others.slice(0, 50).map(attorney).filter(o => o.name || o.uets) : [];
    const lines = Array.isArray(src.signature?.lines) ? src.signature.lines.slice(0, 4).map(l => str(l, 160)).filter(Boolean) : null;
    return {
      version: 3,
      ownAttorney: own ? attorney(own) : {...DEFAULTS.ownAttorney},
      otherEnabled: !!src.otherEnabled,
      others,
      signature: {lines: lines?.length ? lines : [...DEFAULTS.signature.lines]},
      listMode: src.listMode === 'auto' ? 'auto' : 'text',
      lineSpacing: Number(src.lineSpacing) === 1 ? 1 : 1.5,
      dateToday: src.dateToday !== false,
      markUets: src.markUets !== false,
      splitRequests: !!src.splitRequests,
      fileName: str(src.fileName, 120),
      experimental: src.experimental === true
    };
  }
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(raw) return sanitize(JSON.parse(raw));
      const legacy = localStorage.getItem(LEGACY_KEY);
      if(legacy) return sanitize(JSON.parse(legacy));
    }catch{ /* private mode / corrupt value: fall back to defaults */ }
    return sanitize(DEFAULTS);
  }
  function save(settings){
    try{ localStorage.setItem(KEY, JSON.stringify(sanitize(settings))); return true; }catch{ return false; }
  }
  function exportJson(settings){
    return JSON.stringify({application: 'WordToUDF', kind: 'settings', ...sanitize(settings)}, null, 2);
  }
  function importJson(text){
    let data;
    try{ data = JSON.parse(String(text)); }catch{ throw new Error('Ayar dosyası okunamadı (geçerli JSON değil).'); }
    if(!data || typeof data !== 'object' || (data.application && data.application !== 'WordToUDF')) throw new Error('Bu dosya WordToUDF ayar dosyası değil.');
    return sanitize(data);
  }
  // Registry entries handed to the typography layer: only complete pairs.
  function registry(settings){
    const s = sanitize(settings);
    return s.otherEnabled ? s.others.filter(o => o.name && UETS_RE.test(o.uets)) : [];
  }
  function invalidUets(settings){
    const s = sanitize(settings), bad = [];
    if(s.ownAttorney.uets && !UETS_RE.test(s.ownAttorney.uets)) bad.push('kendi UETS');
    if(s.otherEnabled) s.others.forEach((o, i) => { if(o.uets && !UETS_RE.test(o.uets)) bad.push(`${i + 1}. başka vekil`); });
    return bad;
  }
  function signatureLines(settings, vars){
    const s = sanitize(settings);
    return s.signature.lines.map(l => l.replace(/\{(\w+)\}/gu, (_, k) => str(vars?.[k] ?? '', 160)).replace(/\s+/gu, ' ').trim()).filter(Boolean);
  }
  globalThis.WordToUDFSettings = {DEFAULTS, UETS_RE, sanitize, load, save, exportJson, importJson, registry, invalidUets, signatureLines};
})();
