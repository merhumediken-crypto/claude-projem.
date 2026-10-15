(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const T = WordToUDFTemplates, P = WordToUDFPipeline, S = WordToUDFSettings, L = WordToUDFLegalTypography, Lib = WordToUDFLibrary, UI = WordToUDFUI;
  const DRAFT_KEY = 'wordtoudf.templateDraft.v1';
  const settings = S.load();
  const state = {result: null, extra: {}};
  const COMMON = ['court', 'caseNo', 'role', 'otherRole', 'client', 'other', 'otherAttorney'];
  const TEXT = ['topic', 'body', 'requests', 'closing', 'attachments'];
  const draft = (() => { try{ return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') || {}; }catch{ return {}; } })();
  const saveDraft = () => { try{ localStorage.setItem(DRAFT_KEY, JSON.stringify(collect())); }catch{ /* storage unavailable */ } };
  function message(text, kind = '', action){ $('status').textContent = text; $('status').className = `status ${kind}`; if(kind === 'success' || kind === 'error') UI.toast(text, kind, undefined, action); }
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
    renderGallery(); templateCommands();
  }

  /* ------------------------------ gallery ------------------------------ */
  // Category, legal basis and a one-line description of each built-in template.
  const CATS = {hear: 'Duruşma', time: 'Süre ve cevap', obj: 'İtiraz ve talep', file: 'Dosya işlemleri', mine: 'Kendi şablonlarım'};
  const META = {
    mazeret: ['hear', 'Mesleki mazeret', 'Şehir dışı, başka duruşma ya da sağlık mazereti; erteleme ve yeni günün bildirilmesi.'],
    segbis: ['hear', 'HMK m. 149', 'Duruşmaya UYAP Avukat Portal e-Duruşma ya da SEGBİS ile katılım.'],
    tanik: ['hear', 'HMK m. 240', 'Tanıklar, adresleri ve dinletilecekleri husus.'],
    kesif: ['hear', 'HMK m. 288', 'Dava konusu yerde keşif; bilirkişi eşliğinde.'],
    eksure: ['time', 'HMK m. 127', 'Cevap dilekçesi için bir aya kadar ek süre.'],
    replik: ['time', 'HMK m. 136', 'Sıfatınıza göre başlık ve talepler kendiliğinden.'],
    islah: ['time', 'HMK m. 176', 'Kısmi ya da tamamen ıslah; harç bilgisi.'],
    tedbir: ['obj', 'HMK m. 394', 'Tedbir şartları ve teminat yönünden itiraz.'],
    bilirkisi: ['obj', 'HMK m. 281', 'Ek rapor ya da yeni bilirkişi talebi.'],
    ihtiyatihaciz: ['obj', 'İİK m. 257', 'Alacak, vade, dayanak ve teminat seçeneği.'],
    vekalet: ['file', 'UYAP erişim', 'Vekâletname ve dosyaya erişim yetkisi.'],
    beyan: ['file', 'Serbest', 'Kısa bir beyan ya da talep için sade iskelet.'],
    feragat: ['file', 'HMK m. 307', 'Feragat yetkisi ve yargılama giderleri.'],
    iade: ['file', 'HMK m. 333 (avans)', 'Kullanılmayan avans ya da fazla harcın iadesi.']
  };
  const gal = {cat: 'all', q: ''};
  function entries(){
    // The legal basis is shown under the card, so the title drops its "(HMK m. …)".
    return [...T.TEMPLATES.map(t => ({id: t.id, title: t.title, short: t.title.replace(/\s*\([^)]*\)\s*$/u, ''), cat: META[t.id]?.[0] || 'file', law: META[t.id]?.[1] || '', desc: META[t.id]?.[2] || ''})),
      ...Lib.templates().map(u => ({id: `u:${u.id}`, title: u.title, cat: 'mine', law: 'Kendi şablonum', desc: (u.topic || u.body || '').replace(/\s+/gu, ' ').trim().slice(0, 90) || 'Kendi kaydettiğiniz şablon.'}))];
  }
  const badgeText = title => (String(title).trim()[0] || '§').toLocaleUpperCase('tr-TR');
  function renderGallery(){
    const all = entries(), sel = $('tpl').value;
    // The chip or card being used keeps the keyboard focus across the rebuild.
    const act = document.activeElement, keep = act?.closest?.('#tplCats') ? {cat: act.dataset.cat} : act?.closest?.('#tplGrid') ? {tpl: act.dataset.tpl} : null;
    const counts = {all: all.length}; for(const e of all) counts[e.cat] = (counts[e.cat] || 0) + 1;
    if(gal.cat !== 'all' && !counts[gal.cat]) gal.cat = 'all';
    $('tplCats').replaceChildren(...[['all', 'Hepsi'], ...Object.entries(CATS)].filter(([k]) => counts[k]).map(([k, label]) => {
      const b = UI.el('button', {type: 'button', class: `chip cat-${k}` + (gal.cat === k ? ' on' : ''), 'aria-pressed': String(gal.cat === k), 'data-cat': k},
        UI.el('span', {class: 'dot', 'aria-hidden': 'true'}), document.createTextNode(label), UI.el('span', {class: 'count', text: String(counts[k])}));
      b.addEventListener('click', () => { gal.cat = k; renderGallery(); });
      return b;
    }));
    // "HMK 281", "hmk m.281", "md. 281" all find the same card: punctuation and "m."/"md." are ignored.
    const norm = t => ` ${UI.fold(t).replace(/[.,;:()/–-]+/gu, ' ').replace(/(\p{L})(\d)/gu, '$1 $2').replace(/\b(?:m|md|madde)\b/gu, ' ').replace(/\s+/gu, ' ')} `;
    const words = norm(gal.q).split(' ').filter(Boolean);
    const shown = all.filter(e => (gal.cat === 'all' || e.cat === gal.cat) && words.every(w => norm(`${e.title} ${e.desc} ${e.law} ${CATS[e.cat]}`).includes(w)));
    $('tplGrid').replaceChildren(...shown.map((e, i) => {
      const card = UI.el('button', {type: 'button', class: `tpl-card cat-${e.cat}`, 'aria-pressed': String(e.id === sel), 'data-tpl': e.id},
        UI.el('span', {class: 'tc-badge', 'aria-hidden': 'true', text: badgeText(e.title)}), UI.el('strong', {text: e.short || e.title}), UI.el('span', {class: 'tc-desc', text: e.desc}), UI.el('span', {class: 'tc-law', text: `${e.law}${e.law ? ' · ' : ''}${CATS[e.cat]}`}));
      card.style.animationDelay = `${Math.min(i, 12) * 25}ms`;
      card.addEventListener('click', () => pick(e.id));
      return card;
    }));
    if(!shown.length) $('tplGrid').append(UI.el('p', {class: 'tpl-empty', text: 'Bu aramayla eşleşen şablon yok.'}));
    if(keep?.cat) $('tplCats').querySelector(`[data-cat="${keep.cat}"]`)?.focus({preventScroll: true});
    if(keep?.tpl && $('tplGallery').open) $('tplGrid').querySelector(`[data-tpl="${CSS.escape(keep.tpl)}"]`)?.focus({preventScroll: true});
    const cur = all.find(e => e.id === sel);
    if(cur){
      $('tplBadge').textContent = badgeText(cur.title); $('tplBadge').className = `tc-badge cat-${cur.cat}`;
      $('tplTitle').textContent = cur.title; $('tplLaw').textContent = `${cur.law}${cur.law ? ' · ' : ''}${CATS[cur.cat]}`;
      $('tplGallerySub').textContent = `Seçili: ${cur.title} · ${all.length} şablon`;
    }
  }
  // One palette entry per template (own templates come and go).
  function templateCommands(){
    // Entries keep their place in the palette (same id = replaced in place); deleted ones go.
    const ids = new Set(entries().map(e => `tpl:t:${e.id}`));
    UI.commands.remove(c => String(c.id).startsWith('tpl:t:') && !ids.has(c.id));
    UI.commands.add(entries().map(e => ({id: `tpl:t:${e.id}`, group: 'Şablonlar', label: e.title, hint: `${e.law}${e.law ? ' · ' : ''}${CATS[e.cat]}`, icon: 'i-grid', keywords: `${e.desc} şablon`, run: () => pick(e.id)})));
  }
  function pick(id, scroll = true){
    // An own template saved in another tab: refresh the list first.
    if(![...$('tpl').options].some(o => o.value === id)) fillTemplateSelect($('tpl').value);
    if(![...$('tpl').options].some(o => o.value === id)) return;
    if($('tpl').value !== id){ $('tpl').value = id; useTemplate(); }
    else renderGallery();
    if(scroll){
      $('tplGallery').open = false;
      $('court').closest('.panel').scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
      // The keyboard continues in the form the gallery folded away to.
      $('court').focus({preventScroll: true});
    }
  }
  $('tplSearch').addEventListener('input', () => { gal.q = $('tplSearch').value; renderGallery(); });
  fillTemplateSelect();
  // A user template behaves like a built-in one: its {PLACEHOLDERS} become
  // the template fields; standard ones are filled from the form / settings.
  function userTemplate(id){
    const u = Lib.templates().find(t => `u:${t.id}` === id);
    if(!u) return null;
    const all = Lib.placeholders(u), own = all.filter(p => !p.standard);
    // Values by placeholder (any spelling: {MUVEKKIL} is {MÜVEKKİL}).
    const values = f => {
      const std = {court: $('court').value, caseNo: $('caseNo').value, client: $('client').value, other: $('other').value,
        otherAttorney: $('otherAttorney').value, today: L.todayTR(), attorney: settings.ownAttorney.name};
      const v = {};
      for(const p of all) v[p.key] = p.standard ? std[p.standard] : f[`ph${own.indexOf(p)}`] ?? '';
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
  function showAttorney(){
    $('attorneyNote').textContent = settings.ownAttorney.name
      ? `Vekil: ${settings.ownAttorney.name}${settings.ownAttorney.uets ? ` (UETS: ${settings.ownAttorney.uets})` : ' (UETS kayıtlı değil)'} — Word → UDF sayfasındaki ayarlardan değiştirilebilir.`
      : 'Vekil adı ayarlarda boş; Word → UDF sayfasındaki ayarlardan ekleyin.';
  }
  showAttorney();

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
    const t = current(), f = {client: $('client').value.trim(), caseNo: $('caseNo').value.trim(), role: $('role').value, ...extraValues()};
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
  // when followed by a space and only when it is the line's own position:
  // "20.10.2026 tarihli …" starts with a date and "3. kişilerdeki …" as the
  // first request is an ordinal, not a list number.
  const lines = id => $(id).value.split(/\r?\n/u).map(s => s.trim()).filter(Boolean).map((s, i) => {
    const m = /^(\d{1,2})\s*[.)-](?=\s)\s*/u.exec(s);
    return m && Number(m[1]) === i + 1 ? s.slice(m[0].length).trim() : s;
  }).filter(Boolean);
  function build(){
    const common = Object.fromEntries(COMMON.map(k => [k, $(k).value]));
    const role = common.role;
    const own = settings.ownAttorney.name;
    const sig = S.signatureLines(settings, {sifat: T.roleWord(role), muvekkil: common.client.trim(), avukat: own});
    const src = T.sourceLines(common, {topic: $('topic').value, body: $('body').value.split(/\r?\n/u), requests: lines('requests'), closing: $('closing').value, attachments: lines('attachments')}, {attorneyName: own, signatureLines: sig});
    return P.typeset(T.toBlocks(src), {profile: 'legal', settings, now: new Date(), edits: editor.edits});
  }
  const zoom = UI.zoomer({viewport: $('previewViewport'), wrapper: $('paperScale'), paper: $('paper'), toggle: $('zoomToggle'), zoomIn: $('zoomIn'), zoomOut: $('zoomOut'), full: $('previewFull'), section: $('previewSection')});
  const thumbs = UI.thumbs({rail: $('thumbs'), viewport: $('previewViewport'), paper: $('paper'), getScale: () => zoom.scale});
  // The petition's parts above the preview, and the check tour.
  const sections = UI.sections({nav: $('secMap'), paper: $('paper'), viewport: $('previewViewport')});
  const tour = UI.tour({button: $('tourStart'), getChecks: () => state.result?.checks, locate: c => editor.locate(c), actions: c => [c.fix ? fixButton(c) : null]});
  const fitPaper = () => zoom.apply();
  const fixButton = c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'secondary inline-btn'; b.textContent = 'Düzelt'; b.addEventListener('click', () => editor.applyFix(c.fix)); return b; };
  function render(){
    // A change after a download: the green "İndirildi" no longer describes this text.
    if($('download').dataset.state === 'done') UI.download($('download'), 'idle');
    try{
      const t = build(); state.result = t;
      const pg = WordToUDFPreview.render($('paper'), t.blocks, {margins: t.norm.margins, font: P.LEGAL_FONT, size: P.LEGAL_SIZE});
      showPages(pg);
      showFileName();
      editor.decorate();
      $('checksPanel').hidden = false;
      UI.checks({list: 'checkList', stats: 'checkStats', ring: 'checkRing', big: 'ringBig', small: 'ringSmall', legend: 'ringLegend'}, t.checks, {
        buttons: c => [c.fix ? fixButton(c) : null],
        fixed: editor.cleanups().map(id => ({text: editor.cleanupLabel(id), undo: () => editor.dropCleanup(id)}))});
      tour.refresh();
      saveDraft();
    }catch(err){ message(`Önizleme oluşturulamadı: ${err.message}`, 'error'); }
  }
  function showPages(pg){
    $('previewCount').textContent = `≈ ${pg.pages} sayfa · A4`;
    $('pageNote').hidden = !pg.signatureAlone;
    $('pageNote').textContent = pg.signatureAlone ? `Uyarı (yaklaşık): imza bloğu ${pg.pages}. sayfaya tek başına düşüyor; bir paragrafı kısaltmayı düşünün.` : '';
    fitPaper(); thumbs.update(pg.pages); sections.update();
  }
  let timer = 0; function schedule(){ clearTimeout(timer); timer = setTimeout(render, 150); }
  // Paragraph editor on the preview (same as the converter page). Edits are
  // keyed by paragraph text, so changing a template field that alters a
  // paragraph simply leaves that paragraph's old edit unused.
  const editor = WordToUDFEditorUI.attach({paper: $('paper'), toolbar: $('previewTools'), getBlocks: () => state.result?.blocks,
    onChange: render, onMessage: (m, a) => message(m, 'success', a), enabled: () => !!state.result, extraStyles: () => settings.experimental ? ['highlight'] : []});

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
    const t = current(), u = t.user;
    // A user template remembers which side the client was on; a one-sided
    // built-in one (ıslah, feragat: davacı; ihtiyati haciz: alacaklı) sets it.
    const role = u ? u.role : t.role;
    if(role && T.ROLES.includes(role)){ $('role').value = role; $('otherRole').value = (u && u.otherRole) || T.OPPOSITE[role] || $('otherRole').value; }
    disarmDelete();
    editor.reset(); buildFields(); edited = false; regenerate(true);
    renderGallery();
  }
  $('tpl').addEventListener('change', useTemplate);
  // Save the current text as the user's own template (names → placeholders).
  $('tplSave').addEventListener('click', () => {
    const title = $('tplName').value.trim();
    if(!title){ message('Şablona bir ad verin.', 'error'); $('tplName').focus(); return; }
    const info = Object.fromEntries(COMMON.map(k => [k, $(k).value]));
    const u = current().user;
    let parts, note = '';
    if(u && !edited){
      // An own template's text was not touched: keep its {PLACEHOLDERS} exactly
      // (re-generalising the filled text would bake today's values in).
      parts = {topic: u.topic, body: u.body, requests: u.requests, closing: u.closing, attachments: u.attachments};
    }else{
      // Edited text: the filled values go back to their own placeholders.
      const more = [], extra = rawExtra(), empty = [];
      if(u){
        const all = Lib.placeholders(u), own = all.filter(p => !p.standard);
        for(const p of all){
          const v = String(p.standard === 'today' ? L.todayTR() : p.standard === 'attorney' ? settings.ownAttorney.name
            : p.standard ? info[p.standard] ?? '' : extra[`ph${own.indexOf(p)}`] ?? '').trim();
          // An empty field shows as "…" in the text; a filled one goes back to its placeholder.
          if(v) more.push([v, p.label]); else empty.push(p.label);
        }
      }
      const g = v => { let out = Lib.generalize(v, info, more); if(empty.length === 1) out = out.split('…').join(`{${empty[0]}}`); return out; };
      parts = {topic: g($('topic').value), body: g($('body').value), requests: lines('requests').map(g).join('\n'), closing: g($('closing').value), attachments: lines('attachments').map(g).join('\n')};
      if(empty.length > 1) note = ` Boş bırakılan ${empty.length} alan metinde “…” olarak kaldı; şablonu kullanmadan önce bunları {ALAN ADI} biçiminde yazın.`;
    }
    try{
      const tpl = Lib.saveTemplate({title, role: $('role').value, otherRole: $('otherRole').value, ...parts});
      // Continue with the saved template: its fields fill the text from now on.
      fillTemplateSelect(`u:${tpl.id}`); buildFields(); $('tplName').value = ''; edited = false; regenerate(true);
      message(`“${tpl.title}” kendi şablonlarınıza kaydedildi.${note}`, note ? 'error' : 'success');
    }catch(err){ message(err.message, 'error'); }
  });
  let delArmed = 0;
  // Switching templates cancels a pending "press again to delete".
  function disarmDelete(){ clearTimeout(delArmed); delArmed = 0; $('tplDelete').textContent = 'Bu şablonu sil'; }
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
  // Some template texts depend on the side (e.g. cevaba cevap / ikinci cevap).
  $('role').addEventListener('change', () => { $('otherRole').value = T.OPPOSITE[$('role').value] || $('otherRole').value; regenerate(false); });
  for(const k of COMMON) $(k).addEventListener('input', () => regenerate(false));
  for(const k of TEXT) $(k).addEventListener('input', () => { edited = true; schedule(); });
  $('regen').addEventListener('click', () => regenerate(true));
  // Tinos arrived: measure the same paragraphs again (no re-render, the selection and the panel stay).
  UI.onFontsLoaded(() => { if(state.result) showPages(WordToUDFPreview.relayout($('paper'), {margins: state.result.norm.margins})); });

  function fileBase(){
    const client = P.safeName($('client').value || 'Dilekce').replace(/\s+/gu, '_');
    const t = current();
    const source = `${client}_${t.fileId || t.id}_${L.todayTR().replace(/\./gu, '_')}`;
    // The user's file name pattern (shared with the converter page).
    return P.fileName(settings.fileName, {date: L.todayTR(), client: $('client').value.trim(), caseNo: T.caseNumber($('caseNo').value), type: t.title, source});
  }
  function showFileName(){ $('fileNamePreview').textContent = `→ ${fileBase()}.udf`; }
  $('fileNamePattern').value = settings.fileName || '';
  // Only the file name is written, onto the latest stored settings (another tab may have changed the attorney).
  $('fileNamePattern').addEventListener('input', () => {
    const cur = S.load(); cur.fileName = $('fileNamePattern').value; settings.fileName = cur.fileName;
    if(!S.save(cur)) message('Dosya adı kalıbı bu tarayıcıda saklanamadı (depolama kapalı veya dolu); bu oturumda geçerli.', 'error');
    showFileName();
  });
  // Settings changed on the converter page (attorney, UETS, file name): follow them here.
  window.addEventListener('storage', e => {
    // Own templates saved or deleted in another tab: list, gallery and palette follow.
    if(e.key === 'wordtoudf.userTemplates.v1'){ fillTemplateSelect($('tpl').value); return; }
    if(e.key !== S.KEY) return;
    Object.assign(settings, S.load()); showAttorney();
    if(document.activeElement !== $('fileNamePattern')) $('fileNamePattern').value = settings.fileName || '';
    schedule();
  });
  $('printPdf').addEventListener('click', () => {
    render(); const t = state.result; if(!t) return;
    try{
      message('Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin; “Üstbilgi ve altbilgi” kutusunu kapatın.', 'success');
      WordToUDFPrint.printBlocks(t.blocks, {margins: t.norm.margins, font: P.LEGAL_FONT, size: P.LEGAL_SIZE, title: fileBase()});
    }catch(err){ message(`PDF hazırlanamadı: ${err.message}`, 'error'); }
  });
  $('download').addEventListener('click', async () => {
    if($('download').dataset.state === 'working') return;
    render(); const t = state.result; if(!t) return;
    const errors = t.checks.filter(c => c.level === 'error');
    UI.download($('download'), 'working');
    try{
      const res = await P.toUdf(t.blocks, {margins: t.norm.margins});
      downloadBlob(res.bytes, `${fileBase()}.udf`, 'application/octet-stream');
      UI.download($('download'), 'done');
      message(`UDF hazır: ${res.paragraphs} paragraf.${errors.length ? ` Denetimde ${errors.length} hata var; göndermeden önce bakın.` : ''} UYAP'ta açıp kontrol edin.`, errors.length ? 'error' : 'success');
    }catch(err){ UI.download($('download'), 'idle'); message(`UDF oluşturulamadı: ${err.message}`, 'error'); }
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
  $('mbPreview').addEventListener('click', () => zoom.setFull(true));
  /* ------------------------------ command palette (Ctrl+K) ------------------------------ */
  UI.commands.add([
    {id: 'tpl:udf', keepFull: true, group: 'İndir', label: 'UDF oluştur ve indir', hint: 'UYAP Doküman Editörü dosyası', icon: 'i-download', keywords: 'indir kaydet', run: () => $('download').click()},
    {id: 'tpl:docx', keepFull: true, group: 'İndir', label: 'Word (DOCX) indir', hint: 'UDF ile aynı düzen', icon: 'i-doc', keywords: 'word', run: () => $('downloadDocx').click()},
    {id: 'tpl:pdf', keepFull: true, group: 'İndir', label: 'PDF olarak kaydet', hint: 'Yazdırma penceresi açılır', icon: 'i-report', keywords: 'yazdır', run: () => $('printPdf').click()},
    {id: 'tpl:find', keepFull: true, group: 'Düzenle', label: 'Bul / değiştir', hint: 'Önizlemenin tamamında ara (Ctrl+F)', icon: 'i-search', keywords: 'ara', when: () => !!state.result, run: () => editor.openFind()},
    {id: 'tpl:regen', group: 'Düzenle', label: 'Metni şablondan yeniden oluştur', hint: 'Elle değiştirilen metin şablon metniyle değişir', icon: 'i-layers', keywords: 'sıfırla', run: () => $('regen').click()},
    {id: 'tpl:gallery', group: 'Şablonlar', label: 'Şablon galerisini aç', hint: 'Kategoriye göre ya da arayarak seç', icon: 'i-grid', keywords: 'seç liste', run: () => { $('tplGallery').open = true; $('tplGallery').scrollIntoView({block: 'start'}); $('tplSearch').focus({preventScroll: true}); }}
  ]);
  // templates.html#mazeret (from the command palette of another page): open that template.
  function fromHash(){
    let id = ''; try{ id = decodeURIComponent(location.hash.slice(1)); }catch{ /* malformed: ignored */ }
    if(id && [...$('tpl').options].some(o => o.value === id)){ pick(id, false); $('tplGallery').open = false; }
    // Used once: a reload must restore the draft, not open the linked template again over it.
    if(location.hash) history.replaceState(null, '', location.pathname + location.search);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
  // A returning visit (a draft) starts with the gallery folded.
  if(draft.tpl && !location.hash) $('tplGallery').open = false;

  if('serviceWorker' in navigator && /^https?:$/u.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
