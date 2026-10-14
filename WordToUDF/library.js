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
  // "…MAHKEMESİ'NE" / "…MAHKEMESİNE" / "…DAİRESİNE" → the court's own name.
  // Without an apostrophe only after an office noun, so a name like "ADANA" stays whole.
  const OFFICE = /^(.*(?:MAHKEMESİ|HAKİMLİĞİ|DAİRESİ|BAŞKANLIĞI|MÜDÜRLÜĞÜ|SAVCILIĞI|KURULU|KOMİSYONU|BAKANLIĞI|KURUMU))N[EA]$/u;
  const courtName = s => {
    const t = clean(s).replace(/[’']\s*(?:NE|NA|NDE|NDA|ne|na|nde|nda)$/u, '');
    const m = OFFICE.exec(upper(t));
    return m && upper(t).length === t.length ? t.slice(0, m[1].length) : t;
  };
  // "2026/1929 Esas", "2026/1929 E." and "2026/1929" are the same file.
  const caseKey = s => { const m = /(\d{4})\s*\/\s*(\d+)/u.exec(String(s || '')); return m ? `${m[1]}/${Number(m[2])}` : upper(s); };
  const sameCase = (a, b) => caseKey(a.caseNo) === caseKey(b.caseNo) && upper(courtName(a.court)) === upper(courtName(b.court)) && upper(a.client) === upper(b.client)
    // Without court and case number only the parties identify the file.
    && (a.caseNo || a.court || b.caseNo || b.court || upper(a.other) === upper(b.other));
  function cases(){ return read(CASES_KEY).map(sanitizeCase).filter(Boolean).sort((a, b) => b.updated.localeCompare(a.updated)); }
  // Same file (court + case no + client) is updated instead of duplicated; a
  // field the caller does not send (undefined) keeps the stored value.
  // imported: keep the incoming time stamp and never replace a newer card.
  const defined = o => Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));
  function saveCase(c, {imported = false} = {}){
    let card = sanitizeCase({...c, updated: imported ? c?.updated : new Date().toISOString()});
    if(!card) throw new Error('Kaydedilecek dosya bilgisi yok: en az mahkeme, esas no veya taraf adı gerekir.');
    const list = cases();
    const i = list.findIndex(x => x.id === c.id || sameCase(x, card));
    if(i >= 0){
      if(imported && list[i].updated > card.updated) return null;
      card = sanitizeCase({...list[i], ...defined(c), id: list[i].id, updated: card.updated});
      list.splice(i, 1);
    }
    // At the cap a new card is refused rather than silently dropping an old one.
    else if(list.length >= MAX_CASES) throw new Error(`En fazla ${MAX_CASES} dosya kartı saklanabilir; yenisi için eski bir kartı silin.`);
    list.push(card); list.sort((a, b) => b.updated.localeCompare(a.updated));
    if(!write(CASES_KEY, list)) throw new Error('Dosya kartı bu tarayıcıda saklanamadı (depolama kapalı veya dolu).');
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
      if(b.role === 'court-heading' && !court) court = courtName(flat(b));
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
    // The own attorney named on a row that belongs to no party: the client is
    // unknown, so it stays empty rather than becoming the first (other) party.
    const ownRow = own && rows.some(r => r.kind === 'attorney' && upper(r.value).includes(own));
    const mine = parties.find(p => own && upper(p.attorney).includes(own)) || (ownRow ? null : parties[0]);
    const other = parties.find(p => p !== mine);
    const strip = s => clean(s).replace(/\s*\(UETS[^)]*\)\s*$/u, '');
    return sanitizeCase({court, caseNo: rows.find(r => r.kind === 'case')?.value || '', role: mine?.label || '', client: mine?.value || '',
      otherRole: other?.label || '', other: other?.value || '', otherAttorney: strip(other?.attorney)});
  }

  /* ------------------------------ user templates ------------------------------ */
  function sanitizeTemplate(t){
    if(!t || typeof t !== 'object') return null;
    const out = {id: validId(t.id) ? t.id : newId(), title: line(t.title, 120)};
    for(const k of TPL_TEXT) out[k] = str(String(t[k] ?? '').replace(/\r\n?/gu, '\n'), 20000).trim();
    out.role = upper(t.role).slice(0, 60); out.otherRole = upper(t.otherRole).slice(0, 60);
    if(!out.title || !(out.body || out.requests || out.topic)) return null;
    out.updated = stamp(t.updated);
    return out;
  }
  function templates(){ return read(TPL_KEY).map(sanitizeTemplate).filter(Boolean).sort((a, b) => a.title.localeCompare(b.title, 'tr')); }
  function saveTemplate(t, {imported = false} = {}){
    const tpl = sanitizeTemplate({...t, updated: imported ? t?.updated : new Date().toISOString()});
    if(!tpl) throw new Error('Şablon için ad ve en az bir metin (KONU, açıklama veya talep) gerekir.');
    const list = templates();
    const i = list.findIndex(x => x.id === t.id || x.title.toLocaleLowerCase('tr-TR') === tpl.title.toLocaleLowerCase('tr-TR'));
    if(i >= 0){ if(imported && list[i].updated > tpl.updated) return null; tpl.id = list[i].id; list.splice(i, 1); }
    // The list is sorted by title, so trimming it would drop an arbitrary template: refuse instead.
    else if(list.length >= MAX_TEMPLATES) throw new Error(`En fazla ${MAX_TEMPLATES} kendi şablonu saklanabilir; yenisi için birini silin.`);
    list.push(tpl);
    if(!write(TPL_KEY, list)) throw new Error('Şablon bu tarayıcıda saklanamadı (depolama kapalı veya dolu).');
    return tpl;
  }
  function removeTemplate(id){ write(TPL_KEY, templates().filter(t => t.id !== id)); }

  // Placeholders: {MÜVEKKİL}, {ESAS NO}, {ALACAK TUTARI}… (letters, digits, spaces).
  const PH_RE = /\{([\p{L}\p{N}][\p{L}\p{N} _-]{0,39})\}/gu;
  const phKey = name => upper(name).replace(/[\s_-]+/gu, ' ');
  // {MUVEKKIL}, {Müvekkil} and {MÜVEKKİL} are one field (typed on any keyboard).
  const FOLD = {'İ': 'I', 'Ü': 'U', 'Ö': 'O', 'Ş': 'S', 'Ç': 'C', 'Ğ': 'G', 'Â': 'A', 'Î': 'I', 'Û': 'U'};
  const phFold = name => phKey(name).replace(/[İÜÖŞÇĞÂÎÛ]/gu, ch => FOLD[ch]);
  // Filled automatically from the form / settings on the template page.
  const STANDARD = Object.freeze({'MAHKEME': 'court', 'ESAS NO': 'caseNo', 'MÜVEKKİL': 'client', 'KARŞI TARAF': 'other', 'KARŞI TARAF VEKİLİ': 'otherAttorney', 'TARİH': 'today', 'VEKİL': 'attorney'});
  const STD = new Map(Object.entries(STANDARD).map(([k, v]) => [phFold(k), v]));
  function placeholders(tpl){
    const seen = new Map();
    for(const k of TPL_TEXT) for(const m of String(tpl?.[k] || '').matchAll(PH_RE)){ const f = phFold(m[1]); if(!seen.has(f)) seen.set(f, {key: phKey(m[1]), label: clean(m[1])}); }
    return [...seen.entries()].map(([f, p]) => ({...p, standard: STD.get(f) || null}));
  }
  // values: {KEY: text} (any spelling of the key); an empty value becomes "…" (never invented).
  function fill(text, values){
    const v = new Map(Object.entries(values || {}).map(([k, x]) => [phFold(k), x]));
    return String(text || '').replace(PH_RE, (_, name) => clean(v.get(phFold(name))) || '…');
  }
  // Turkish case folding that keeps every position (İ→i, I→ı before lower-casing).
  const lowerTr = s => s.replace(/İ/gu, 'i').replace(/I/gu, 'ı').toLowerCase();
  const WORDCH = /[\p{L}\p{N}]/u;
  // Turn the case's own names into placeholders so the template is reusable:
  // whole words only, any letter case ("İsa ÇİFTÇİ" also matches "İsa Çiftçi"),
  // never inside an existing {PLACEHOLDER}. more: extra [value, placeholder] pairs.
  function generalize(text, info, more = []){
    let out = String(text || '');
    const pairs = [['caseNo', 'ESAS NO'], ['client', 'MÜVEKKİL'], ['other', 'KARŞI TARAF'], ['otherAttorney', 'KARŞI TARAF VEKİLİ'], ['court', 'MAHKEME']]
      .map(([k, ph]) => [clean(info?.[k]), ph]).concat((more || []).map(([v, ph]) => [clean(v), ph]))
      .filter(([v]) => v.length >= 3).sort((a, b) => b[0].length - a[0].length);
    for(const [v, ph] of pairs){
      const hay = lowerTr(out), pin = lowerTr(v);
      if(hay.length !== out.length || pin.length !== v.length){ out = out.split(v).join(`{${ph}}`); continue; }
      let res = '', last = 0, i = hay.indexOf(pin);
      while(i >= 0){
        const end = i + pin.length;
        const inside = out.lastIndexOf('{', i) > out.lastIndexOf('}', i - 1);
        if(!inside && (i === 0 || !WORDCH.test(out[i - 1])) && (end >= out.length || !WORDCH.test(out[end]))){ res += out.slice(last, i) + `{${ph}}`; last = end; i = hay.indexOf(pin, end); }
        else i = hay.indexOf(pin, i + 1);
      }
      out = res + out.slice(last);
    }
    return out;
  }
  // Template parts from a typeset petition (roles from legal-typography / edits).
  function partsFromBlocks(blocks){
    const flat = b => (b.runs || []).map(r => r.text || '').join('');
    const body = (b) => b.listMarker && b.runs?.[0]?.text === `${b.listMarker}\t` ? flat(b).slice(b.runs[0].text.length) : flat(b);
    const role = b => String(b.role || '').replace(/^edit-/u, '');
    const out = {topic: '', body: [], sections: [], requests: [], closing: '', attachments: []};
    // Only paragraphs inside AÇIKLAMALAR count as body (not "T.C." or a title).
    // HUKUKİ SEBEPLER / DELİLLER travel as "LABEL: value" lines after the body;
    // the template page puts them back in their place when it typesets.
    let zone = 'head';
    const prose = r => ['explanation-body', 'section-heading', 'body', 'plain', 'quote', 'heading'].includes(r);
    for(const b of blocks || []){
      if(b.kind !== 'paragraph') continue;
      if(b.fieldKind === 'explanations') zone = 'body';
      else if(['legal-basis', 'evidence'].includes(b.fieldKind)){
        zone = 'section';
        const m = /^([^\t]*)\t\s*:\s?(.*)$/su.exec(flat(b));
        out.sections.push(m ? `${clean(m[1])}:${clean(m[2]) ? ` ${clean(m[2])}` : ''}` : clean(flat(b)));
        continue;
      }
      else if(['result', 'attachments'].includes(b.fieldKind) || b.role === 'result-heading') zone = 'after';
      const r = role(b), t = clean(body(b));
      if(!t) continue;
      if(zone === 'section' && !b.fieldKind && prose(r)){ out.sections.push(t); continue; }
      if(b.fieldKind === 'topic') out.topic = clean(flat(b).replace(/^[^\t]*\t\s*:\s?/u, ''));
      else if(r === 'result-item') out.requests.push(t);
      else if(zone === 'body' && !b.fieldKind && prose(r)) out.body.push(t);
      else if(r === 'result-closing' || r === 'closing') out.closing = t.replace(/\s+\d{2}\.\d{2}\.\d{4}$/u, '');
      else if(r === 'attachment-item') out.attachments.push(t);
    }
    return {topic: out.topic, body: [...out.body, ...out.sections].join('\n'), requests: out.requests.join('\n'), closing: out.closing, attachments: out.attachments.join('\n')};
  }

  /* ------------------------------ export / import ------------------------------ */
  function exportData(){ return {cases: cases(), templates: templates()}; }
  // Everything with client data this browser keeps: cards, own templates and the
  // template page's last draft (settings and theme stay).
  const DRAFT_KEY = 'wordtoudf.templateDraft.v1';
  function clearAll(){ for(const k of [CASES_KEY, TPL_KEY, DRAFT_KEY]){ try{ localStorage.removeItem(k); }catch{ /* storage unavailable */ } } }
  // Merge (never wipe): same file / same title is updated, the rest is added.
  // skipped counts entries that were invalid or did not fit (cap / storage full).
  function importData(data){
    const res = {cases: 0, templates: 0, skipped: 0, kept: 0};
    if(!data || typeof data !== 'object') return res;
    // A local card / template newer than the backup's copy is kept (res.kept).
    for(const c of (Array.isArray(data.cases) ? data.cases : []).slice(0, MAX_CASES)){ try{ if(saveCase(c, {imported: true})) res.cases++; else res.kept++; }catch{ res.skipped++; } }
    for(const t of (Array.isArray(data.templates) ? data.templates : []).slice(0, MAX_TEMPLATES)){ try{ if(saveTemplate(t, {imported: true})) res.templates++; else res.kept++; }catch{ res.skipped++; } }
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
    templates, saveTemplate, removeTemplate, sanitizeTemplate, placeholders, fill, generalize, partsFromBlocks, exportData, importData, clearAll, picker};
})();
