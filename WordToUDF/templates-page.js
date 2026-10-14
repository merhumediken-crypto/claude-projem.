(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const T = WordToUDFTemplates, P = WordToUDFPipeline, S = WordToUDFSettings, L = WordToUDFLegalTypography;
  const DRAFT_KEY = 'wordtoudf.templateDraft.v1';
  const settings = S.load();
  const state = {fit: true, result: null, extra: {}};
  const COMMON = ['court', 'caseNo', 'role', 'otherRole', 'client', 'other', 'otherAttorney'];
  const TEXT = ['topic', 'body', 'requests', 'closing', 'attachments'];
  const draft = (() => { try{ return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}; }catch{ return {}; } })();
  const saveDraft = () => { try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(collect())); }catch{ /* storage unavailable */ } };
  function message(text, kind = ''){ $('status').textContent = text; $('status').className = `status ${kind}`; }
  function downloadBlob(bytes, name, mime){
    const url = URL.createObjectURL(new Blob([bytes], {type: mime}));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  for(const t of T.TEMPLATES) $('tpl').add(new Option(t.title, t.id));
  for(const r of T.ROLES) $('role').add(new Option(r, r));
  $('attorneyNote').textContent = settings.ownAttorney.name
    ? `Vekil: ${settings.ownAttorney.name}${settings.ownAttorney.uets ? ` (UETS: ${settings.ownAttorney.uets})` : ' (UETS kayıtlı değil)'} — Word → UDF sayfasındaki ayarlardan değiştirilebilir.`
    : 'Vekil adı ayarlarda boş; Word → UDF sayfasındaki ayarlardan ekleyin.';

  // Template-specific inputs.
  function extraValues(){
    const t = T.byId($('tpl').value), out = {};
    for(const f of t.fields){
      const el = $(`f_${f.id}`); if(!el) continue;
      out[f.id] = f.type === 'checkbox' ? el.checked : f.type === 'date' ? T.trDate(el.value) : el.value;
    }
    return out;
  }
  function rawExtra(){
    const t = T.byId($('tpl').value), out = {};
    for(const f of t.fields){ const el = $(`f_${f.id}`); if(el) out[f.id] = f.type === 'checkbox' ? el.checked : el.value; }
    return out;
  }
  function buildFields(values = {}){
    const t = T.byId($('tpl').value), box = $('tplFields'); box.replaceChildren();
    for(const f of t.fields){
      const wrap = document.createElement('div'); wrap.className = 'tpl-field'; wrap.dataset.field = f.id;
      const id = `f_${f.id}`;
      let el;
      if(f.type === 'select'){ el = document.createElement('select'); el.className = 'profile-select'; for(const [v, l] of f.options) el.add(new Option(l, v)); }
      else if(f.type === 'textarea'){ el = document.createElement('textarea'); el.rows = 3; }
      else { el = document.createElement('input'); el.type = f.type === 'checkbox' ? 'checkbox' : f.type === 'date' ? 'date' : 'text'; el.autocomplete = 'off'; }
      el.id = id; if(f.placeholder) el.placeholder = f.placeholder;
      const v = values[f.id] ?? f.value;
      if(f.type === 'checkbox') el.checked = v !== undefined ? !!v : false; else if(v !== undefined) el.value = v;
      if(f.type === 'checkbox'){ const lab = document.createElement('label'); lab.className = 'check'; lab.append(el, Object.assign(document.createElement('span'), {textContent: f.label})); wrap.append(lab); }
      else { const lab = document.createElement('label'); lab.className = 'setting-label'; lab.htmlFor = id; lab.textContent = f.label; wrap.append(lab, el); }
      el.addEventListener('input', () => { syncVisibility(); regenerate(false); });
      el.addEventListener('change', () => { syncVisibility(); regenerate(false); });
      box.append(wrap);
    }
    syncVisibility();
  }
  function syncVisibility(){
    const t = T.byId($('tpl').value), v = rawExtra();
    for(const f of t.fields){ const w = $('tplFields').querySelector(`[data-field="${f.id}"]`); if(w) w.hidden = !!(f.showIf && !f.showIf(v)); }
  }
  // Fill the text areas from the template. Edited text is kept unless forced.
  let edited = false;
  function regenerate(force){
    if(edited && !force){ schedule(); return; }
    const t = T.byId($('tpl').value), f = extraValues();
    $('topic').value = t.topic(f); $('body').value = t.body(f).join('\n'); $('requests').value = t.requests(f).join('\n');
    $('closing').value = t.closing; $('attachments').value = t.attachments(f).join('\n');
    edited = false; schedule();
  }
  function collect(){
    const o = {tpl: $('tpl').value, extra: rawExtra(), edited};
    for(const k of [...COMMON, ...TEXT]) o[k] = $(k).value;
    return o;
  }
  // A typed "1. " / "2) " number is removed (the list numbers itself), but only
  // when followed by a space: "20.10.2026 tarihli …" starts with a date.
  const lines = id => $(id).value.split(/\r?\n/u).map(s => s.replace(/^\s*\d{1,2}\s*[.)-](?=\s)\s*/u, '').trim()).filter(Boolean);
  function build(){
    const common = Object.fromEntries(COMMON.map(k => [k, $(k).value]));
    const role = common.role;
    const own = settings.ownAttorney.name;
    const sig = S.signatureLines(settings, {sifat: T.roleWord(role), muvekkil: common.client.trim(), avukat: own});
    const src = T.sourceLines(common, {topic: $('topic').value, body: $('body').value.split(/\r?\n/u), requests: lines('requests'), closing: $('closing').value, attachments: lines('attachments')}, {attorneyName: own, signatureLines: sig});
    return P.typeset(T.toBlocks(src), {profile: 'legal', settings, now: new Date()});
  }
  function fitPaper(){
    const scale = WordToUDFPreview.fit($('previewViewport'), $('paperScale'), $('paper'), state.fit);
    $('zoomToggle').setAttribute('aria-pressed', String(state.fit));
    $('zoomToggle').textContent = state.fit ? `Sığdır · %${Math.round(scale * 100)}` : 'Gerçek boyut';
  }
  const LEVEL_TEXT = {error: 'Hata', warn: 'Uyarı', info: 'Bilgi'};
  function render(){
    try{
      const t = build(); state.result = t;
      WordToUDFPreview.render($('paper'), t.blocks, {margins: t.norm.margins, font: P.LEGAL_FONT, size: P.LEGAL_SIZE});
      fitPaper();
      const list = $('checkList'); list.replaceChildren(); $('checksPanel').hidden = false;
      const counts = {error: 0, warn: 0, info: 0};
      for(const c of t.checks){ counts[c.level]++; const li = document.createElement('li'); li.className = `check-${c.level}`; li.dataset.code = c.code; li.append(Object.assign(document.createElement('strong'), {textContent: `${LEVEL_TEXT[c.level]}: `}), c.message); list.append(li); }
      $('checkStats').textContent = `${counts.error} hata · ${counts.warn} uyarı`;
      $('checkStats').className = 'pill' + (counts.error ? ' pill-error' : counts.warn ? ' pill-warn' : ' pill-ok');
      saveDraft();
    }catch(err){ message(`Önizleme oluşturulamadı: ${err.message}`, 'error'); }
  }
  let timer = 0; function schedule(){ clearTimeout(timer); timer = setTimeout(render, 150); }

  // Restore draft or start from the first template.
  if(draft.tpl) $('tpl').value = draft.tpl;
  for(const k of COMMON) if(draft[k] !== undefined) $(k).value = draft[k];
  if(!draft.role) $('role').value = 'DAVALI';
  if(!draft.otherRole) $('otherRole').value = T.OPPOSITE[$('role').value] || '';
  buildFields(draft.extra || {});
  if(draft.topic !== undefined && draft.tpl === $('tpl').value){ for(const k of TEXT) $(k).value = draft[k] ?? ''; edited = !!draft.edited; schedule(); }
  else regenerate(true);

  $('tpl').addEventListener('change', () => { buildFields(); edited = false; regenerate(true); });
  $('role').addEventListener('change', () => { $('otherRole').value = T.OPPOSITE[$('role').value] || $('otherRole').value; schedule(); });
  for(const k of COMMON) $(k).addEventListener('input', schedule);
  for(const k of TEXT) $(k).addEventListener('input', () => { edited = true; schedule(); });
  $('regen').addEventListener('click', () => regenerate(true));
  $('zoomToggle').addEventListener('click', () => { state.fit = !state.fit; fitPaper(); });
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fitPaper, 120); });

  function fileBase(){
    const client = P.safeName($('client').value || 'Dilekce').replace(/\s+/gu, '_');
    return `${client}_${T.byId($('tpl').value).id}_${L.todayTR().replace(/\./gu, '_')}`;
  }
  $('download').addEventListener('click', async () => {
    render(); const t = state.result; if(!t) return;
    const errors = t.checks.filter(c => c.level === 'error');
    try{
      const res = await P.toUdf(t.blocks, {margins: t.norm.margins});
      downloadBlob(res.bytes, `${fileBase()}.udf`, 'application/octet-stream');
      message(`UDF hazır: ${res.paragraphs} paragraf.${errors.length ? ` Denetimde ${errors.length} hata var; göndermeden önce bakın.` : ''} UYAP'ta açıp kontrol edin.`, errors.length ? 'error' : 'success');
    }catch(err){ message(`UDF oluşturulamadı: ${err.message}`, 'error'); }
  });
  $('downloadDocx').addEventListener('click', async () => {
    render(); const t = state.result; if(!t) return;
    try{
      const bytes = await WordToUDFDocxWriter.create({options: {margins: t.norm.margins, landscape: false, font: P.LEGAL_FONT, size: P.LEGAL_SIZE}, blocks: t.blocks, headers: [], footers: []});
      downloadBlob(bytes, `${fileBase()}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      message('Word belgesi indirildi.', 'success');
    }catch(err){ message(`Word oluşturulamadı: ${err.message}`, 'error'); }
  });
  if('serviceWorker' in navigator && /^https?:$/u.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
