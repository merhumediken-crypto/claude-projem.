(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const T = WordToUDFTemplates, P = WordToUDFPipeline, S = WordToUDFSettings, L = WordToUDFLegalTypography, Lib = WordToUDFLibrary;
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

  // Built-in templates, then the user's own ("u:<id>").
  function fillTemplateSelect(selected){
    const sel = $('tpl'); sel.replaceChildren();
    const built = document.createElement('optgroup'); built.label = 'Hazır şablonlar';
    for(const t of T.TEMPLATES) built.append(new Option(t.title, t.id));
    sel.append(built);
    const mine = Lib.templates();
    if(mine.length){ const g = document.createElement('optgroup'); g.label = `Kendi şablonlarım (${mine.length})`; for(const t of mine) g.append(new Option(t.title, `u:${t.id}`)); sel.append(g); }
    if(selected && [...sel.options].some(o => o.value === selected)) sel.value = selected;
  }
  fillTemplateSelect();
  // A user template behaves like a built-in one: its {PLACEHOLDERS} become
  // the template fields; standard ones are filled from the form / settings.
  function userTemplate(id){
    const u = Lib.templates().find(t => `u:${t.id}` === id);
    if(!u) return null;
    const own = Lib.placeholders(u).filter(p => !p.standard);
    const values = f => {
      const v = {MAHKEME: $('court').value, 'ESAS NO': $('caseNo').value, MÜVEKKİL: $('client').value, 'KARŞI TARAF': $('other').value,
        'KARŞI TARAF VEKİLİ': $('otherAttorney').value, TARİH: L.todayTR(), VEKİL: settings.ownAttorney.name};
      own.forEach((p, i) => { v[p.key] = f[`ph${i}`] ?? ''; });
      return v;
    };
    const lines = t => t ? t.split(/\n/u).map(x => x.trim()).filter(Boolean) : [];
    return {id: `u:${u.id}`, user: u, title: u.title, fileId: 'sablon',
      fields: own.map((p, i) => ({id: `ph${i}`, label: p.label, type: 'text'})),
      topic: f => Lib.fill(u.topic, values(f)), body: f => lines(Lib.fill(u.body, values(f))), requests: f => lines(Lib.fill(u.requests, values(f))),
      closing: f => Lib.fill(u.closing, values(f)) || 'Karar verilmesini saygıyla talep ederiz.', attachments: f => lines(Lib.fill(u.attachments, values(f)))};
  }
  const current = () => userTemplate($('tpl').value) || T.byId($('tpl').value);
  for(const r of T.ROLES) $('role').add(new Option(r, r));
  $('attorneyNote').textContent = settings.ownAttorney.name
    ? `Vekil: ${settings.ownAttorney.name}${settings.ownAttorney.uets ? ` (UETS: ${settings.ownAttorney.uets})` : ' (UETS kayıtlı değil)'} — Word → UDF sayfasındaki ayarlardan değiştirilebilir.`
    : 'Vekil adı ayarlarda boş; Word → UDF sayfasındaki ayarlardan ekleyin.';

  // Template-specific inputs.
  function extraValues(){
    const t = current(), out = {};
    for(const f of t.fields){
      const el = $(`f_${f.id}`); if(!el) continue;
      out[f.id] = f.type === 'checkbox' ? el.checked : f.type === 'date' ? T.trDate(el.value) : el.value;
    }
    return out;
  }
  function rawExtra(){
    const t = current(), out = {};
    for(const f of t.fields){ const el = $(`f_${f.id}`); if(el) out[f.id] = f.type === 'checkbox' ? el.checked : el.value; }
    return out;
  }
  function buildFields(values = {}){
    const t = current(), box = $('tplFields'); box.replaceChildren();
    const u = t.user;
    $('tplDelete').hidden = !u; $('tplNote').hidden = !u;
    if(u) $('tplNote').textContent = t.fields.length ? `Kendi şablonunuz · ${t.fields.length} alan` : 'Kendi şablonunuz · ek alan yok (mahkeme, esas no ve taraflar 2. adımdan).';
    if(!t.fields.length && u){ const p = document.createElement('p'); p.className = 'note small'; p.textContent = 'Bu şablonda doldurulacak ek alan yok.'; box.append(p); }
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
    const t = current(), v = rawExtra();
    for(const f of t.fields){ const w = $('tplFields').querySelector(`[data-field="${f.id}"]`); if(w) w.hidden = !!(f.showIf && !f.showIf(v)); }
  }
  // Fill the text areas from the template. Edited text is kept unless forced.
  let edited = false;
  function regenerate(force){
    if(edited && !force){ schedule(); return; }
    // Template text may use the common fields too (e.g. the client's name).
    const t = current(), f = {client: $('client').value.trim(), caseNo: $('caseNo').value.trim(), ...extraValues()};
    $('topic').value = t.topic(f); $('body').value = t.body(f).join('\n'); $('requests').value = t.requests(f).join('\n');
    $('closing').value = typeof t.closing === 'function' ? t.closing(f) : t.closing; $('attachments').value = t.attachments(f).join('\n');
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
    return P.typeset(T.toBlocks(src), {profile: 'legal', settings, now: new Date(), edits: editor.edits});
  }
  function fitPaper(){
    const scale = WordToUDFPreview.fit($('previewViewport'), $('paperScale'), $('paper'), state.fit);
    $('zoomToggle').setAttribute('aria-pressed', String(state.fit));
    $('zoomToggle').textContent = state.fit ? `Sığdır · %${Math.round(scale * 100)}` : 'Gerçek boyut';
  }
  const LEVEL_TEXT = {error: 'Hata', warn: 'Uyarı', info: 'Bilgi', suggest: 'Öneri'};
  function render(){
    try{
      const t = build(); state.result = t;
      WordToUDFPreview.render($('paper'), t.blocks, {margins: t.norm.margins, font: P.LEGAL_FONT, size: P.LEGAL_SIZE});
      fitPaper();
      editor.decorate();
      const list = $('checkList'); list.replaceChildren(); $('checksPanel').hidden = false;
      const counts = {error: 0, warn: 0, info: 0, suggest: 0};
      for(const c of t.checks){
        counts[c.level]++; const li = document.createElement('li'); li.className = `check-${c.level}`; li.dataset.code = c.code; li.append(Object.assign(document.createElement('strong'), {textContent: `${LEVEL_TEXT[c.level]}: `}), c.message);
        if(c.fix){ const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary inline-btn'; b.textContent = 'Düzelt'; b.addEventListener('click', () => editor.applyFix(c.fix)); li.append(' ', b); }
        list.append(li);
      }
      $('checkStats').textContent = `${counts.error} hata · ${counts.warn} uyarı${counts.suggest ? ` · ${counts.suggest} öneri` : ''}`;
      $('checkStats').className = 'pill' + (counts.error ? ' pill-error' : counts.warn ? ' pill-warn' : ' pill-ok');
      saveDraft();
    }catch(err){ message(`Önizleme oluşturulamadı: ${err.message}`, 'error'); }
  }
  let timer = 0; function schedule(){ clearTimeout(timer); timer = setTimeout(render, 150); }
  // Paragraph editor on the preview (same as the converter page). Edits are
  // keyed by paragraph text, so changing a template field that alters a
  // paragraph simply leaves that paragraph's old edit unused.
  const editor = WordToUDFEditorUI.attach({paper: $('paper'), toolbar: $('previewTools'), getBlocks: () => state.result?.blocks,
    onChange: render, onMessage: m => message(m, 'success'), enabled: () => !!state.result});

  // Restore draft or start from the first template.
  // A deleted user template falls back to the first built-in one.
  if(draft.tpl) fillTemplateSelect(draft.tpl);
  for(const k of COMMON) if(draft[k] !== undefined) $(k).value = draft[k];
  if(!draft.role) $('role').value = 'DAVALI';
  if(!draft.otherRole) $('otherRole').value = T.OPPOSITE[$('role').value] || '';
  buildFields(draft.extra || {});
  if(draft.topic !== undefined && draft.tpl === $('tpl').value){ for(const k of TEXT) $(k).value = draft[k] ?? ''; edited = !!draft.edited; schedule(); }
  else regenerate(true);

  function useTemplate(){
    const u = current().user;
    // A user template remembers which side the client was on.
    if(u?.role && T.ROLES.includes(u.role)){ $('role').value = u.role; $('otherRole').value = u.otherRole || T.OPPOSITE[u.role] || $('otherRole').value; }
    editor.reset(); buildFields(); edited = false; regenerate(true);
  }
  $('tpl').addEventListener('change', useTemplate);
  // Save the current text as the user's own template (names → placeholders).
  $('tplSave').addEventListener('click', () => {
    const title = $('tplName').value.trim();
    if(!title){ message('Şablona bir ad verin.', 'error'); $('tplName').focus(); return; }
    const info = Object.fromEntries(COMMON.map(k => [k, $(k).value]));
    const g = id => Lib.generalize($(id).value, info);
    try{
      const tpl = Lib.saveTemplate({title, role: $('role').value, otherRole: $('otherRole').value, topic: g('topic'), body: g('body'),
        requests: lines('requests').map(x => Lib.generalize(x, info)).join('\n'), closing: g('closing'), attachments: lines('attachments').map(x => Lib.generalize(x, info)).join('\n')});
      // Continue with the saved template: its fields fill the text from now on.
      fillTemplateSelect(`u:${tpl.id}`); buildFields(); $('tplName').value = ''; edited = false; regenerate(true);
      message(`“${tpl.title}” kendi şablonlarınıza kaydedildi.`, 'success');
    }catch(err){ message(err.message, 'error'); }
  });
  let delArmed = 0;
  $('tplDelete').addEventListener('click', () => {
    const u = current().user; if(!u) return;
    if(!delArmed){ delArmed = setTimeout(() => { delArmed = 0; $('tplDelete').textContent = 'Bu şablonu sil'; }, 4000); $('tplDelete').textContent = 'Silmek için tekrar basın'; return; }
    clearTimeout(delArmed); delArmed = 0; $('tplDelete').textContent = 'Bu şablonu sil';
    Lib.removeTemplate(u.id); fillTemplateSelect(T.TEMPLATES[0].id); useTemplate();
    message(`“${u.title}” silindi.`, 'success');
  });
  // Saved case cards fill "Dosya ve taraflar".
  Lib.picker($('casePicker'), {
    read: () => Object.fromEntries(COMMON.map(k => [k, $(k).value])),
    apply: c => { for(const k of COMMON) if(k === 'role' ? T.ROLES.includes(c.role) : c[k] !== undefined) $(k).value = c[k] || ''; regenerate(false); },
    onMessage: (m, kind) => message(m, kind || 'success')});
  $('role').addEventListener('change', () => { $('otherRole').value = T.OPPOSITE[$('role').value] || $('otherRole').value; schedule(); });
  for(const k of COMMON) $(k).addEventListener('input', () => regenerate(false));
  for(const k of TEXT) $(k).addEventListener('input', () => { edited = true; schedule(); });
  $('regen').addEventListener('click', () => regenerate(true));
  $('zoomToggle').addEventListener('click', () => { state.fit = !state.fit; fitPaper(); });
  let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fitPaper, 120); });

  function fileBase(){
    const client = P.safeName($('client').value || 'Dilekce').replace(/\s+/gu, '_');
    const t = current();
    return `${client}_${t.fileId || t.id}_${L.todayTR().replace(/\./gu, '_')}`;
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
      P.assertHasText(t.blocks);
      const bytes = await WordToUDFDocxWriter.create({options: {margins: t.norm.margins, landscape: false, font: P.LEGAL_FONT, size: P.LEGAL_SIZE}, blocks: t.blocks, headers: [], footers: []});
      downloadBlob(bytes, `${fileBase()}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      message('Word belgesi indirildi.', 'success');
    }catch(err){ message(`Word oluşturulamadı: ${err.message}`, 'error'); }
  });
  // Phone: quick actions at the bottom (the form is long, the preview below it).
  $('mbDownload').addEventListener('click', () => $('download').click());
  $('mbPreview').addEventListener('click', () => $('previewSection').scrollIntoView({behavior: 'smooth', block: 'start'}));
  if('serviceWorker' in navigator && /^https?:$/u.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
