/* The user's own library (v1.9.0): case cards and petition templates.
 *
 * A CASE CARD remembers one file: court, case number, the client and the
 * other party (with their roles) and the other party's attorney. Choosing it
 * fills the template form or the paste form in one go.
 * A USER TEMPLATE is a petition text with {PLACEHOLDER} fields, saved from
 * the template page or from any converted / pasted petition.
 *
 * Both live only in this browser's localStorage (like the settings) and travel
 * with the settings export file. Everything is sanitised on load, save and
 * import; nothing is ever sent anywhere.
 */
(() => {
  'use strict';
  const CASES_KEY = 'wordtoudf.cases.v1';
  const TPL_KEY = 'wordtoudf.userTemplates.v1';
  const MAX_CASES = 300, MAX_TEMPLATES = 100;
  const CASE_FIELDS = ['court', 'caseNo', 'role', 'client', 'otherRole', 'other', 'otherAttorney', 'note'];
  const TPL_TEXT = ['topic', 'body', 'requests', 'closing', 'attachments'];
  const str = (v, max = 300) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/gu, ' ').slice(0, max);
  const line = (v, max = 300) => str(v, max).replace(/\s+/gu, ' ').trim();
  const clean = s => String(s ?? '').replace(/\s+/gu, ' ').trim();
  const upper = s => clean(s).toLocaleUpperCase('tr-TR');
  const newId = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).slice(0, 16);
  const validId = id => typeof id === 'string' && /^[a-z0-9]{6,16}$/u.test(id);
  const stamp = v => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v) : new Date()).toISOString();

  function read(key){ try{ const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; }catch{ return []; } }
  function write(key, list){ try{ localStorage.setItem(key, JSON.stringify(list)); return true; }catch{ return false; } }

  /* ------------------------------ case cards ------------------------------ */
  function sanitizeCase(c){
    if(!c || typeof c !== 'object') return null;
    const out = {id: validId(c.id) ? c.id : newId()};
    for(const k of CASE_FIELDS) out[k] = line(c[k], k === 'note' ? 500 : 300);
    out.role = upper(out.role).slice(0, 60); out.otherRole = upper(out.otherRole).slice(0, 60);
    if(!out.court && !out.caseNo && !out.client && !out.other) return null;
    out.updated = stamp(c.updated);
    return out;
  }
  const caseLabel = c => [c.caseNo || 'Esas no yok', c.client, c.other ? `– ${c.other}` : '', c.court ? `(${c.court})` : ''].filter(Boolean).join(' ').slice(0, 140);
  const sameCase = (a, b) => upper(a.caseNo) === upper(b.caseNo) && upper(a.court) === upper(b.court) && upper(a.client) === upper(b.client);
  function cases(){ return read(CASES_KEY).map(sanitizeCase).filter(Boolean).sort((a, b) => b.updated.localeCompare(a.updated)); }
  // Same file (court + case no + client) is updated instead of duplicated.
  function saveCase(c){
    const card = sanitizeCase({...c, updated: new Date().toISOString()});
    if(!card) throw new Error('Kaydedilecek dosya bilgisi yok: en az mahkeme, esas no veya taraf adı gerekir.');
    const list = cases();
    const i = list.findIndex(x => x.id === c.id || sameCase(x, card));
    if(i >= 0){ card.id = list[i].id; list.splice(i, 1); }
    list.unshift(card);
    if(!write(CASES_KEY, list.slice(0, MAX_CASES))) throw new Error('Dosya kartı bu tarayıcıda saklanamadı (depolama kapalı veya dolu).');
    return card;
  }
  function removeCase(id){ write(CASES_KEY, cases().filter(c => c.id !== id)); }

  // Case card from a typeset petition (künye rows carry fieldKind/fieldLabel).
  // The client is the party whose VEKİLİ row names the user's own attorney;
  // otherwise the first party.
  function caseFromBlocks(blocks, ownName = ''){
    const rows = [];
    let court = '';
    const flat = b => (b.runs || []).map(r => r.text || '').join('');
    for(const b of blocks || []){
      if(b.kind !== 'paragraph') continue;
      if(b.role === 'court-heading' && !court) court = clean(flat(b)).replace(/[’']\s*(?:NE|NA|NDE|NDA)$/u, '');
      if(!b.fieldKind) continue;
      const m = /^([^\t]*)\t\s*:\s?(.*)$/su.exec(flat(b));
      if(m) rows.push({kind: b.fieldKind, label: clean(m[1]), value: clean(m[2])});
    }
    const own = upper(ownName).replace(/^AV\.\s*/u, '');
    const parties = [];
    rows.forEach((r, i) => {
      if(r.kind !== 'party' || !r.value) return;
      const att = rows.slice(i + 1).find((x, j, a) => x.kind === 'attorney' && !a.slice(0, j).some(y => y.kind === 'party'));
      parties.push({...r, attorney: att?.value || ''});
    });
    const mine = parties.find(p => own && upper(p.attorney).includes(own)) || parties[0];
    const other = parties.find(p => p !== mine);
    const strip = s => clean(s).replace(/\s*\(UETS[^)]*\)\s*$/u, '');
    return sanitizeCase({court, caseNo: rows.find(r => r.kind === 'case')?.value || '', role: mine?.label || '', client: mine?.value || '',
      otherRole: other?.label || '', other: other?.value || '', otherAttorney: strip(other?.attorney)});
  }

  /* ------------------------------ user templates ------------------------------ */
  function sanitizeTemplate(t){
    if(!t || typeof t !== 'object') return null;
    const out = {id: validId(t.id) ? t.id : newId(), title: line(t.title, 120)};
    for(const k of TPL_TEXT) out[k] = str(t[k], 20000).replace(/\r\n?/gu, '\n').trim();
    out.role = upper(t.role).slice(0, 60); out.otherRole = upper(t.otherRole).slice(0, 60);
    if(!out.title || !(out.body || out.requests || out.topic)) return null;
    out.updated = stamp(t.updated);
    return out;
  }
  function templates(){ return read(TPL_KEY).map(sanitizeTemplate).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title, 'tr')); }
  function saveTemplate(t){
    const tpl = sanitizeTemplate({...t, updated: new Date().toISOString()});
    if(!tpl) throw new Error('Şablon için ad ve en az bir metin (KONU, açıklama veya talep) gerekir.');
    const list = templates();
    const i = list.findIndex(x => x.id === t.id || x.title.toLocaleLowerCase('tr-TR') === tpl.title.toLocaleLowerCase('tr-TR'));
    if(i >= 0){ tpl.id = list[i].id; list.splice(i, 1); }
    list.push(tpl);
    if(!write(TPL_KEY, list.slice(-MAX_TEMPLATES))) throw new Error('Şablon bu tarayıcıda saklanamadı (depolama kapalı veya dolu).');
    return tpl;
  }
  function removeTemplate(id){ write(TPL_KEY, templates().filter(t => t.id !== id)); }

  // Placeholders: {MÜVEKKİL}, {ESAS NO}, {ALACAK TUTARI}… (letters, digits, spaces).
  const PH_RE = /\{([\p{L}\p{N} _-]{1,40})\}/gu;
  const phKey = name => upper(name).replace(/[\s_-]+/gu, ' ');
  // Filled automatically from the form / settings on the template page.
  const STANDARD = Object.freeze({'MAHKEME': 'court', 'ESAS NO': 'caseNo', 'MÜVEKKİL': 'client', 'KARŞI TARAF': 'other', 'KARŞI TARAF VEKİLİ': 'otherAttorney', 'TARİH': 'today', 'VEKİL': 'attorney'});
  function placeholders(tpl){
    const seen = new Map();
    for(const k of TPL_TEXT) for(const m of String(tpl?.[k] || '').matchAll(PH_RE)){ const key = phKey(m[1]); if(!seen.has(key)) seen.set(key, clean(m[1])); }
    return [...seen.entries()].map(([key, label]) => ({key, label, standard: STANDARD[key] || null}));
  }
  // values: {KEY: text}; an empty value becomes "…" (never invented).
  function fill(text, values){
    return String(text || '').replace(PH_RE, (_, name) => clean(values?.[phKey(name)]) || '…');
  }
  // Turn the case's own names into placeholders so the template is reusable.
  function generalize(text, info){
    let out = String(text || '');
    const pairs = [['caseNo', 'ESAS NO'], ['client', 'MÜVEKKİL'], ['other', 'KARŞI TARAF'], ['otherAttorney', 'KARŞI TARAF VEKİLİ'], ['court', 'MAHKEME']]
      .map(([k, ph]) => [clean(info?.[k]), ph]).filter(([v]) => v.length >= 3).sort((a, b) => b[0].length - a[0].length);
    for(const [v, ph] of pairs) out = out.split(v).join(`{${ph}}`);
    return out;
  }
  // Template parts from a typeset petition (roles from legal-typography / edits).
  function partsFromBlocks(blocks){
    const flat = b => (b.runs || []).map(r => r.text || '').join('');
    const body = (b) => b.listMarker && b.runs?.[0]?.text === `${b.listMarker}\t` ? flat(b).slice(b.runs[0].text.length) : flat(b);
    const role = b => String(b.role || '').replace(/^edit-/u, '');
    const out = {topic: '', body: [], requests: [], closing: '', attachments: []};
    // Only paragraphs inside AÇIKLAMALAR count as body (not "T.C." or a title).
    let zone = 'head';
    for(const b of blocks || []){
      if(b.kind !== 'paragraph') continue;
      if(b.fieldKind === 'explanations') zone = 'body';
      else if(['legal-basis', 'evidence', 'result', 'attachments'].includes(b.fieldKind) || b.role === 'result-heading') zone = 'after';
      const r = role(b), t = clean(body(b));
      if(!t) continue;
      if(b.fieldKind === 'topic') out.topic = clean(flat(b).replace(/^[^\t]*\t\s*:\s?/u, ''));
      else if(r === 'result-item') out.requests.push(t);
      else if(zone === 'body' && !b.fieldKind && ['explanation-body', 'section-heading', 'body', 'plain', 'quote', 'heading'].includes(r)) out.body.push(t);
      else if(r === 'result-closing' || r === 'closing') out.closing = t.replace(/\s+\d{2}\.\d{2}\.\d{4}$/u, '');
      else if(r === 'attachment-item') out.attachments.push(t);
    }
    return {topic: out.topic, body: out.body.join('\n'), requests: out.requests.join('\n'), closing: out.closing, attachments: out.attachments.join('\n')};
  }

  /* ------------------------------ export / import ------------------------------ */
  function exportData(){ return {cases: cases(), templates: templates()}; }
  // Merge (never wipe): same file / same title is updated, the rest is added.
  function importData(data){
    const res = {cases: 0, templates: 0};
    if(!data || typeof data !== 'object') return res;
    for(const c of (Array.isArray(data.cases) ? data.cases : []).slice(0, MAX_CASES)){ try{ saveCase(c); res.cases++; }catch{ /* skip invalid */ } }
    for(const t of (Array.isArray(data.templates) ? data.templates : []).slice(0, MAX_TEMPLATES)){ try{ saveTemplate(t); res.templates++; }catch{ /* skip invalid */ } }
    return res;
  }

  /* ------------------------------ case picker (DOM) ------------------------------ */
  // A select of saved cards plus "Kaydet" / "Sil". read() → current fields,
  // apply(card) → fill the form. Deleting needs a second press (no dialogs).
  function picker(container, {read: readFields, apply, onMessage = () => {}, saveLabel = 'Dosya kartı olarak kaydet'}){
    const sel = document.createElement('select'); sel.className = 'profile-select case-select'; sel.setAttribute('aria-label', 'Kayıtlı dosya kartı');
    const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary tool-btn'; save.textContent = saveLabel;
    const del = document.createElement('button'); del.type = 'button'; del.className = 'secondary tool-btn danger-text'; del.textContent = 'Sil'; del.disabled = true;
    const row = document.createElement('div'); row.className = 'case-actions'; row.append(save, del);
    container.replaceChildren(sel, row);
    function fillSelect(selected = ''){
      const list = cases();
      sel.replaceChildren(new Option(list.length ? `Kayıtlı dosyadan doldur… (${list.length})` : 'Kayıtlı dosya kartı yok', ''));
      for(const c of list) sel.add(new Option(caseLabel(c), c.id));
      sel.value = selected; sel.disabled = !list.length; del.disabled = !selected;
    }
    let armed = 0;
    sel.addEventListener('change', () => {
      const c = cases().find(x => x.id === sel.value);
      del.disabled = !c; del.textContent = 'Sil'; armed = 0;
      if(c){ apply(c); onMessage(`“${caseLabel(c)}” dosya bilgileri dolduruldu.`); }
    });
    save.addEventListener('click', () => {
      try{ const card = saveCase(readFields() || {}); fillSelect(card.id); onMessage(`Dosya kartı kaydedildi: ${caseLabel(card)}`); }
      catch(err){ onMessage(err.message, 'error'); }
    });
    del.addEventListener('click', () => {
      if(!sel.value) return;
      if(!armed){ armed = setTimeout(() => { armed = 0; del.textContent = 'Sil'; }, 4000); del.textContent = 'Silmek için tekrar basın'; return; }
      clearTimeout(armed); armed = 0;
      removeCase(sel.value); fillSelect(''); del.textContent = 'Sil'; onMessage('Dosya kartı silindi.');
    });
    fillSelect('');
    return {refresh: () => fillSelect(sel.value)};
  }

  globalThis.WordToUDFLibrary = {CASE_FIELDS, TPL_TEXT, STANDARD, cases, saveCase, removeCase, caseLabel, caseFromBlocks, sanitizeCase,
    templates, saveTemplate, removeTemplate, sanitizeTemplate, placeholders, fill, generalize, partsFromBlocks, exportData, importData, picker};
})();
