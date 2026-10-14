/* Manual paragraph editing (v1.5.0, word/sentence formatting v1.8.0).
 *
 * The user taps a paragraph in the preview and changes its type, alignment,
 * emphasis, size, indents, spacing or text; can delete it, merge it with the
 * next paragraph, insert a blank line / page break before it, add new
 * paragraphs after it or move it. Several paragraphs can be edited at once.
 * Words and sentences inside a paragraph can be made bold / italic /
 * underlined / struck through ("marks"), in one paragraph or everywhere.
 *
 * Edits are stored per paragraph KEY ("<occurrence>|<first 80 chars>" of the
 * typeset text), so they survive re-rendering when an unrelated setting
 * changes, and are applied after legal typography, before checks and UDF
 * writing. Edits never happen automatically; everything here is the user's
 * explicit choice and is listed in the report.
 *
 * A mark remembers the marked TEXT (and where it was): after any change it is
 * looked up again in the paragraph. If the text is no longer there the mark is
 * not applied and reported as lost; it is never moved onto other words.
 */
(() => {
  'use strict';
  const L = () => globalThis.WordToUDFLegalTypography;
  const I = () => L().internals;
  const flatten = b => (b?.runs || []).map(r => r.text || '').join('');
  const clean = s => String(s ?? '').replace(/\s+/gu, ' ').trim();

  // Paragraph types the user can choose. `list` types become numbered items
  // and are renumbered with the rest of their list.
  const ROLES = Object.freeze({
    body: 'Gövde paragrafı',
    plain: 'Düz paragraf',
    heading: 'Ara başlık',
    center: 'Ortalı başlık',
    'result-item': 'Talep maddesi',
    'attachment-item': 'Ek maddesi',
    closing: 'Kapanış cümlesi',
    quote: 'Alıntı (karar / metin)',
    signature: 'İmza satırı'
  });
  const ALIGN = Object.freeze({left: 'Sola', center: 'Ortala', right: 'Sağa', justify: 'İki yana'});
  const SIZES = Object.freeze([10, 11, 12, 13, 14, 16]);
  const LINES = Object.freeze([1, 1.15, 1.5, 2]);
  const SPACES = Object.freeze([0, 3, 6, 12, 18]);   // pt
  const INDENTS = Object.freeze([0, 0.5, 1, 1.25, 2, 3]); // cm
  const BOOL = ['bold', 'italic', 'underline', 'remove', 'blankBefore', 'blankAfter', 'breakBefore', 'mergeNext'];
  // Inline (word / sentence) styles.
  const MARK_STYLES = Object.freeze(['bold', 'italic', 'underline', 'strike']);
  const MARK_TEXT = Object.freeze({bold: 'kalın', italic: 'italik', underline: 'altı çizili', strike: 'üstü çizili'});
  // Edits that belong to the whole document (not one paragraph) live under this key.
  const DOC_KEY = '*doc';
  // Key of a paragraph the user added after <parent>: "<parent>#+<id>".
  const CHILD_RE = /^(.*)#\+([a-z0-9]{1,12})$/su;
  const childKey = (parent, id) => `${parent}#+${id}`;
  const parentOf = key => CHILD_RE.exec(String(key))?.[1] ?? null;

  function sanitizeMark(m){
    if(!m || typeof m !== 'object' || typeof m.text !== 'string') return null;
    const text = m.text.replace(/\r\n?/gu, '\n').slice(0, 2000);
    if(!text.trim()) return null;
    const out = {text};
    if(Number.isInteger(m.at) && m.at >= 0 && m.at < 1e6) out.at = m.at;
    let styled = false;
    for(const k of MARK_STYLES) if(typeof m[k] === 'boolean'){ out[k] = m[k]; styled = true; }
    return styled ? out : null;
  }
  // Keep only known fields with allowed values; drop everything else.
  function sanitize(edit){
    if(typeof edit === 'string') edit = {role: edit};
    const e = {}, src = edit && typeof edit === 'object' ? edit : {};
    if(ROLES[src.role]) e.role = src.role;
    if(ALIGN[src.align]) e.align = src.align;
    for(const k of BOOL) if(typeof src[k] === 'boolean') e[k] = src[k];
    for(const k of ['remove', 'blankBefore', 'blankAfter', 'breakBefore', 'mergeNext']) if(e[k] === false) delete e[k];
    if(SIZES.includes(Number(src.size))) e.size = Number(src.size);
    if(LINES.includes(Number(src.line))) e.line = Number(src.line);
    for(const k of ['above', 'below']) if(SPACES.includes(Number(src[k]))) e[k] = Number(src[k]);
    for(const k of ['first', 'left', 'right']) if(INDENTS.includes(Number(src[k]))) e[k] = Number(src[k]);
    if(typeof src.text === 'string' && src.text.length <= 20000) e.text = src.text.replace(/\r\n?/gu, '\n');
    if(Array.isArray(src.marks)){ const marks = src.marks.slice(-200).map(sanitizeMark).filter(Boolean); if(marks.length) e.marks = marks; }
    if(Array.isArray(src.addAfter)){
      const seen = new Set();
      const items = src.addAfter.slice(0, 50).filter(x => x && typeof x === 'object' && /^[a-z0-9]{1,12}$/u.test(x.id) && typeof x.text === 'string' && x.text.trim() && !seen.has(x.id) && seen.add(x.id))
        .map(x => ({id: x.id, text: x.text.replace(/\r\n?/gu, '\n').slice(0, 20000), ...(ROLES[x.role] ? {role: x.role} : {})}));
      if(items.length) e.addAfter = items;
    }
    if(Number.isInteger(src.move) && src.move !== 0 && Math.abs(src.move) <= 500) e.move = src.move;
    return e;
  }
  const isEmpty = e => !e || !Object.keys(e).length;

  /* ------------------------------ document-wide rules ------------------------------ */
  // {marks: [{text, caseSensitive, wholeWord, bold…}], replace: [{from, to, caseSensitive, wholeWord}]}
  function sanitizeDoc(doc){
    const src = doc && typeof doc === 'object' ? doc : {};
    const opts = x => ({...(x.caseSensitive === true ? {caseSensitive: true} : {}), ...(x.wholeWord === true ? {wholeWord: true} : {})});
    const marks = (Array.isArray(src.marks) ? src.marks : []).slice(-100).map(m => {
      const s = sanitizeMark(m); return s ? {text: s.text, ...opts(m), ...Object.fromEntries(MARK_STYLES.filter(k => k in s).map(k => [k, s[k]]))} : null;
    }).filter(Boolean);
    const replace = (Array.isArray(src.replace) ? src.replace : []).slice(-100)
      .filter(r => r && typeof r.from === 'string' && r.from.trim() && typeof r.to === 'string')
      .map(r => ({from: r.from.slice(0, 500), to: r.to.slice(0, 2000).replace(/\r\n?|\n/gu, ' '), ...opts(r)}));
    const out = {};
    if(marks.length) out.marks = marks;
    if(replace.length) out.replace = replace;
    return out;
  }

  // Turkish-aware search: "i̇/İ" and "ı/I" fold with the Turkish locale.
  const fold = s => s.toLocaleLowerCase('tr-TR');
  const WORD_CH = /[\p{L}\p{N}]/u;
  function findMatches(text, needle, {caseSensitive = false, wholeWord = false} = {}){
    const out = [];
    if(!needle) return out;
    let hay = text, pin = needle;
    if(!caseSensitive){
      const ft = fold(text), fn = fold(needle);
      // Only when folding keeps every position (true for Turkish text).
      if(ft.length === text.length && fn.length === needle.length){ hay = ft; pin = fn; }
    }
    let i = hay.indexOf(pin);
    while(i >= 0){
      const end = i + pin.length;
      const ok = !wholeWord || ((i === 0 || !WORD_CH.test(text[i - 1])) && (end >= text.length || !WORD_CH.test(text[end])));
      if(ok){ out.push({start: i, end}); i = hay.indexOf(pin, end); }
      else i = hay.indexOf(pin, i + 1);
    }
    return out;
  }

  /* ------------------------------ run helpers ------------------------------ */
  const markerLength = b => b?.listMarker && b.runs?.[0]?.text === `${b.listMarker}\t` ? b.runs[0].text.length : 0;
  const bodyText = b => flatten(b).slice(markerLength(b));
  // Give [start, end) of the flattened text the patch; runs are split as needed.
  function styleRange(runs, start, end, patch){
    const out = []; let off = 0;
    for(const r of runs){
      const t = String(r.text || ''), a = off, z = off + t.length;
      off = z;
      if(!t || z <= start || a >= end){ out.push(r); continue; }
      const s = Math.max(start, a) - a, e = Math.min(end, z) - a;
      if(s > 0) out.push({...r, text: t.slice(0, s)});
      out.push({...r, ...patch, text: t.slice(s, e)});
      if(e < t.length) out.push({...r, text: t.slice(e)});
    }
    return out;
  }
  // Replace [start, end) with text; the new text takes the style of the first replaced character.
  function replaceRange(runs, start, end, text){
    const out = []; let off = 0, done = false;
    for(const r of runs){
      const t = String(r.text || ''), a = off, z = off + t.length;
      off = z;
      if(!t || z <= start || a >= end){ out.push(r); continue; }
      const s = Math.max(start, a) - a, e = Math.min(end, z) - a;
      if(s > 0) out.push({...r, text: t.slice(0, s)});
      if(!done){ if(text) out.push({...r, text}); done = true; }
      if(e < t.length) out.push({...r, text: t.slice(e)});
    }
    if(!done && text) out.push({...(runs.at(-1) || {}), text});
    return out.filter(r => r.text !== '');
  }
  // Join neighbouring runs that look the same (fewer UDF elements).
  function mergeRuns(runs){
    const out = [];
    for(const r of runs){
      const p = out.at(-1);
      if(p && Object.keys(p).length === Object.keys(r).length && Object.keys(r).every(k => k === 'text' || p[k] === r[k])) out[out.length - 1] = {...p, text: p.text + r.text};
      else out.push(r);
    }
    return out;
  }
  const patchOf = m => Object.fromEntries(MARK_STYLES.filter(k => typeof m[k] === 'boolean').map(k => [k, m[k]]));

  // Paragraph marks: the occurrence nearest to where the text was marked.
  function applyMarks(b, marks, lost){
    if(!marks?.length) return b;
    const base = markerLength(b), body = bodyText(b);
    let runs = b.runs;
    for(const m of marks){
      const hits = findMatches(body, m.text, {caseSensitive: true});
      if(!hits.length){ lost.push({text: m.text}); continue; }
      const at = m.at ?? 0;
      const hit = hits.reduce((x, y) => Math.abs(y.start - at) < Math.abs(x.start - at) ? y : x);
      runs = styleRange(runs, base + hit.start, base + hit.end, patchOf(m));
    }
    return {...b, runs: mergeRuns(runs)};
  }
  // Document marks: every occurrence.
  function applyDocMarks(b, marks, stats){
    if(!marks?.length || b.kind !== 'paragraph') return b;
    const base = markerLength(b), body = bodyText(b);
    let runs = b.runs, hit = false;
    marks.forEach((m, i) => {
      const found = findMatches(body, m.text, m);
      for(const f of found) runs = styleRange(runs, base + f.start, base + f.end, patchOf(m));
      if(found.length){ hit = true; stats.marks[i] = (stats.marks[i] || 0) + found.length; }
    });
    return hit ? {...b, runs: mergeRuns(runs)} : b;
  }
  function applyDocReplace(b, rules, stats){
    if(!rules?.length || b.kind !== 'paragraph') return b;
    let runs = b.runs, changed = false;
    const base = markerLength(b);
    rules.forEach((r, i) => {
      const body = flatten({runs}).slice(base);
      const found = findMatches(body, r.from, r);
      // Right to left so earlier offsets stay valid.
      for(const f of [...found].reverse()) runs = replaceRange(runs, base + f.start, base + f.end, r.to);
      if(found.length){ changed = true; stats.replace[i] = (stats.replace[i] || 0) + found.length; }
    });
    return changed ? {...b, runs: mergeRuns(runs)} : b;
  }

  /* ------------------------------ sentences ------------------------------ */
  // Abbreviations that end with a dot but do not end a sentence (lower case).
  const ABBR = new Set(['av', 'dr', 'prof', 'doç', 'doc', 'yrd', 'öğr', 'gör', 'arş', 'uzm', 'm', 'md', 'mad', 'fık', 'f', 'b', 'c', 's', 'sh', 'ss', 'sy',
    'vb', 'vs', 'vd', 'bkz', 'krş', 'karş', 'örn', 'ör', 'no', 'nr', 'nu', 'e', 'k', 't', 'd', 'hd', 'cd', 'hgk', 'cgk', 'ibk', 'yibk', 'ltd', 'şti', 'tic', 'san',
    'mah', 'mh', 'cad', 'cd', 'sok', 'sk', 'apt', 'blv', 'bul', 'kat', 'tel', 'fax', 'faks', 'yön', 'gen', 'müd', 'bşk', 'başk', 'ord', 'st']);
  const OPEN_Q = '"“‘«(\'';
  const CLOSE_Q = '"”’»)\']';
  // Split a paragraph into sentences: [{start, end, text}] (offsets in text).
  function sentences(text){
    const s = String(text || ''), out = [];
    let start = 0;
    const push = (a, z) => {
      while(a < z && /\s/u.test(s[a])) a++;
      while(z > a && /\s/u.test(s[z - 1])) z--;
      if(z > a) out.push({start: a, end: z, text: s.slice(a, z)});
    };
    for(let i = 0; i < s.length; i++){
      const ch = s[i];
      if(ch === '\n'){ push(start, i); start = i + 1; continue; }
      if(!'.!?…'.includes(ch)) continue;
      let j = i;
      while(j + 1 < s.length && '.!?…'.includes(s[j + 1])) j++;
      let k = j + 1;
      while(k < s.length && CLOSE_Q.includes(s[k])) k++;
      if(k < s.length && !/\s/u.test(s[k])) continue;           // "14.10.2026", "uyap.gov.tr"
      let n = k; while(n < s.length && /\s/u.test(s[n])) n++;
      if(n < s.length){
        let c = s[n];
        if(OPEN_Q.includes(c) && n + 1 < s.length) c = s[n + 1];
        if(!/\p{Lu}/u.test(c)) continue;                      // next sentence starts upper-case
      }
      if(ch === '.' && j === i){
        const before = s.slice(0, i);
        const num = /(\d+)$/u.exec(before);
        if(num && num[1].length <= 2) continue;               // "8. Asliye", "3. HD"
        const tok = /([\p{L}.]+)$/u.exec(before)?.[1] || '';
        if(tok.includes('.')) continue;                       // "T.C.", "A.Ş."
        if(tok.length === 1) continue;                        // initials "A. KAYA"
        if(ABBR.has(tok.toLocaleLowerCase('tr-TR'))) continue;
      }
      push(start, k); start = k; i = k - 1;
    }
    push(start, s.length);
    return out;
  }

  /* ------------------------------ keys ------------------------------ */
  function blockKeys(blocks){
    const seen = new Map();
    return blocks.map(b => {
      if(b.kind !== 'paragraph' || b.inserted) return null;
      const t = clean(flatten(b)).slice(0, 80);
      const n = (seen.get(t) || 0) + 1; seen.set(t, n);
      return `${n}|${t}`;
    });
  }

  const PT = 72 / 2.54;
  function stripMarker(b){
    if(b.listMarker && b.runs[0]?.text === `${b.listMarker}\t`) b.runs = b.runs.slice(1);
    else if(b.listMarker) b.runs = I().trimRuns(I().sliceRuns(b.runs, b.listMarker.length + 1));
    delete b.listMarker; delete b.listId; delete b.listLevel; delete b.list;
    b.tabStops = [];
    return b;
  }

  function applyRole(src, role, opts){
    const T = I(), R = T.NORMAL_RULES();
    const line = opts?.lineSpacing ?? 1.5;
    if(role === 'result-item' || role === 'attachment-item'){
      const plain = stripMarker(T.cloneBlock(src));
      const list = L().SCHEMA.lists[role === 'result-item' ? 'result' : 'attachments'];
      const ctx = {opts: {listMode: opts?.listMode === 'auto' ? 'auto' : 'text'}, listCounters: {}, changes: []};
      const b = T.makeListItem(plain, list, role, ctx, role === 'result-item' ? line : 1);
      T.setAllRuns(b, {underline: false});
      return b;
    }
    const b = stripMarker(T.cloneBlock(src));
    const set = o => Object.assign(b, {left: 0, first: 0, right: 0, above: 0, below: 0, ...o});
    if(role === 'signature'){ set({alignment: 'right', line: 1}); T.setAllRuns(b, {bold: true, underline: false}); }
    else if(role === 'body'){ set({alignment: 'justify', first: (R.explanationFirstCm ?? 1.25) * PT, above: (R.explanationParagraphCm ?? .15) * PT, below: (R.explanationParagraphCm ?? .15) * PT, line}); T.setAllRuns(b, {bold: false, underline: false}); }
    else if(role === 'plain'){ set({alignment: 'left', line}); T.setAllRuns(b, {bold: false, underline: false}); }
    else if(role === 'heading'){ set({alignment: 'left', above: .15 * PT, below: .15 * PT, line}); T.setAllRuns(b, {bold: true, underline: true}); }
    else if(role === 'center'){ set({alignment: 'center', line: 1}); T.setAllRuns(b, {bold: true, underline: false}); }
    else if(role === 'closing'){ set({alignment: 'justify', line}); T.setAllRuns(b, {bold: false, underline: false}); }
    else if(role === 'quote'){ set({alignment: 'justify', left: PT, right: PT, above: 3, below: 3, line: 1}); T.setAllRuns(b, {italic: true, bold: false, underline: false, size: 11}); }
    b.role = `edit-${role}`;
    return b;
  }

  // New text for a paragraph. The parts the user did not change keep their
  // formatting (a bold word, an italic citation); the typed part takes the
  // style of the text it replaces (or continues the text before it).
  function replaceText(b, text){
    const T = I();
    const marker = markerLength(b) ? b.runs[0] : null;
    const body = marker ? b.runs.slice(1) : b.runs;
    const old = flatten({runs: body});
    if(old === text) return b;
    let p = 0; while(p < old.length && p < text.length && old[p] === text[p]) p++;
    let q = 0; while(q < old.length - p && q < text.length - p && old[old.length - 1 - q] === text[text.length - 1 - q]) q++;
    const styleAt = pos => { let off = 0; for(const r of body){ const n = String(r.text || '').length; if(pos < off + n) return r; off += n; } return body.at(-1) || {}; };
    let style;
    if(p === 0 && q === 0){
      // Complete rewrite: an emphasis is kept only if the WHOLE paragraph had it.
      const visible = body.filter(r => clean(r.text));
      style = {...T.originRun({runs: visible})};
      for(const k of MARK_STYLES) style[k] = visible.length > 0 && visible.every(r => !!r[k]);
    } else style = {...(p < old.length - q ? styleAt(p) : styleAt(Math.max(0, p - 1)))};
    delete style.text;
    const mid = text.slice(p, text.length - q);
    const runs = [...T.sliceRuns(body, 0, p), ...(mid ? [T.plainRun(mid, style)] : []), ...T.sliceRuns(body, old.length - q)];
    const nb = {...b, runs: mergeRuns([...(marker ? [marker] : []), ...runs])};
    T.styleRegex(nb, T.LAW_RE, {italic: true});
    T.styleRegex(nb, T.CASE_RE, {bold: true, italic: true});
    return nb;
  }

  function fineTune(b, e){
    if(e.align) b.alignment = e.align;
    const patch = {};
    for(const k of ['bold', 'italic', 'underline']) if(typeof e[k] === 'boolean') patch[k] = e[k];
    if(e.size) patch.size = e.size;
    if(Object.keys(patch).length){
      // The list number keeps normal weight; everything else gets the patch.
      const marker = markerLength(b) > 0;
      b.runs = b.runs.map((r, i) => marker && i === 0 ? (e.size ? {...r, size: e.size} : r) : {...r, ...patch});
    }
    if(e.line) b.line = e.line;
    if(e.above !== undefined) b.above = e.above;
    if(e.below !== undefined) b.below = e.below;
    if(e.first !== undefined && !b.listMarker && !b.list) b.first = e.first * PT;
    if(e.left !== undefined){
      const extra = e.left * PT;
      if(b.listMarker || b.list){ b.left = (b.listLevel ? 36 : 18) + extra; if(b.listMarker) b.tabStops = [{pos: b.left, align: 'left', leader: 'none'}]; }
      else b.left = extra;
    }
    if(e.right !== undefined) b.right = e.right * PT;
    return b;
  }

  // Number text-mode lists again in document order (after deletions,
  // insertions, moves and type changes): 1., 2., 3. / a), b) per list id.
  function renumber(blocks){
    const counters = {};
    for(const b of blocks){
      if(!b.listMarker || !b.listId) continue;
      const c = counters[b.listId] ||= [0, 0];
      let marker;
      if(b.listLevel === 1){ c[1]++; marker = `${I().alphaMarker(c[1])})`; }
      else { c[0]++; c[1] = 0; marker = `${c[0]}.`; }
      // New runs array: unedited blocks share their runs with the typeset
      // input, which must stay untouched for the next render.
      if(b.runs[0]?.text === `${b.listMarker}\t`) b.runs = [{...b.runs[0], text: `${marker}\t`}, ...b.runs.slice(1)];
      b.listMarker = marker;
    }
    return blocks;
  }

  const blank = key => ({kind: 'paragraph', runs: [], alignment: 'left', left: 0, first: 0, right: 0, above: 0, below: 0, line: 1, role: 'inserted-blank', inserted: true, insertedBy: key});

  // The type a new paragraph gets by default: the same kind as the one above.
  function defaultRole(b){
    const r = String(b?.role || '').replace(/^edit-/u, '');
    if(r === 'result-item' || r === 'attachment-item') return r;
    if(r === 'explanation-body' || r === 'body' && b?.alignment === 'justify') return 'body';
    if(r === 'quote' || r === 'closing' || r === 'heading') return 'body';
    return 'plain';
  }
  function newParagraph(parent, item, opts){
    const T = I();
    const style = {...T.originRun(parent)}; delete style.text;
    for(const k of MARK_STYLES) delete style[k];
    delete style.size;
    const b = {kind: 'paragraph', runs: [T.plainRun(item.text, style)], alignment: 'justify', left: 0, first: 0, right: 0, above: 0, below: 0, line: parent?.line || 1, tabStops: []};
    return applyRole(b, item.role || defaultRole(parent), opts);
  }

  function describe(e){
    const out = [];
    if(e.role) out.push(`tür: ${ROLES[e.role]}`);
    if(e.align) out.push(`hizalama: ${ALIGN[e.align].toLocaleLowerCase('tr-TR')}`);
    for(const [k, t] of [['bold', 'kalın'], ['italic', 'italik'], ['underline', 'altı çizili']]) if(typeof e[k] === 'boolean') out.push(e[k] ? t : `${t} değil`);
    if(e.size) out.push(`${e.size} punto`);
    if(e.line) out.push(`satır aralığı ${String(e.line).replace('.', ',')}`);
    if(e.first !== undefined) out.push(`ilk satır ${String(e.first).replace('.', ',')} cm`);
    if(e.left !== undefined) out.push(`sol girinti ${String(e.left).replace('.', ',')} cm`);
    if(e.right !== undefined) out.push(`sağ girinti ${String(e.right).replace('.', ',')} cm`);
    if(e.above !== undefined) out.push(`önce ${e.above} pt`);
    if(e.below !== undefined) out.push(`sonra ${e.below} pt`);
    if(e.text !== undefined) out.push('metin değiştirildi');
    for(const m of e.marks || []) out.push(`“${clean(m.text).slice(0, 40)}${clean(m.text).length > 40 ? '…' : ''}” ${describeStyle(m)}`);
    if(e.mergeNext) out.push('sonraki paragrafla birleştirildi');
    if(e.blankBefore) out.push('önüne boş satır');
    if(e.blankAfter) out.push('arkasına boş satır');
    if(e.breakBefore) out.push('önüne sayfa sonu');
    if(e.addAfter?.length) out.push(`altına ${e.addAfter.length} yeni paragraf`);
    if(e.move) out.push(`${Math.abs(e.move)} sıra ${e.move < 0 ? 'yukarı' : 'aşağı'} taşındı`);
    if(e.remove) out.push('silindi');
    return out.join(', ');
  }
  function describeStyle(m){
    const on = MARK_STYLES.filter(k => m[k] === true).map(k => MARK_TEXT[k]);
    const off = MARK_STYLES.filter(k => m[k] === false).map(k => MARK_TEXT[k]);
    if(!on.length && off.length === MARK_STYLES.length) return 'düz yazı';
    return [on.join(' + '), off.length ? `${off.join('/')} kaldırıldı` : ''].filter(Boolean).join(', ');
  }
  function describeDoc(doc, stats){
    const out = [];
    (doc.replace || []).forEach((r, i) => out.push(`“${r.from}” → “${r.to}” (${stats.replace[i] || 0} yerde)`));
    (doc.marks || []).forEach((m, i) => out.push(`her “${m.text}” ${describeStyle(m)} (${stats.marks[i] || 0} yerde)`));
    return out;
  }

  // Move whole paragraph units (with their blank lines / page breaks) among
  // the visible paragraphs; a unit moved by -1 lands above the paragraph
  // that was above it.
  function moveUnits(units){
    const arr = units.slice();
    for(const u of units){
      if(!u.move) continue;
      const keyed = arr.filter(x => x.key && x.items.some(b => b.kind === 'paragraph'));
      const k = keyed.indexOf(u); if(k < 0) continue;
      const t = Math.max(0, Math.min(keyed.length - 1, k + u.move)); if(t === k) continue;
      const target = keyed[t];
      arr.splice(arr.indexOf(u), 1);
      const ti = arr.indexOf(target);
      arr.splice(u.move < 0 ? ti : ti + 1, 0, u);
    }
    return arr;
  }

  // edits: Map-like (key → edit) or plain object. Returns the edited blocks,
  // each editable paragraph tagged with `editKey` for the preview.
  function apply(blocks, edits, opts = {}){
    const map = typeof edits?.get === 'function' && typeof edits.size === 'number' ? edits : new Map(Object.entries(edits || {}));
    const doc = sanitizeDoc(map.get(DOC_KEY));
    const docStats = {replace: [], marks: []};
    const keys = blockKeys(blocks), units = [], log = [], lost = [];
    let applied = 0;
    // Shared steps for an edited paragraph (original or added).
    const finish = (b, e, key) => {
      if(e.role) b = applyRole(b, e.role, opts);
      if(e.text !== undefined) b = replaceText(b, e.text);
      b = fineTune(b, e);
      b = applyDocMarks(b, doc.marks, docStats);
      const before = lost.length;
      b = applyMarks(b, e.marks, lost);
      for(let n = before; n < lost.length; n++) lost[n].key = key;
      return b;
    };
    for(let i = 0; i < blocks.length; i++){
      let src = blocks[i];
      const key = keys[i];
      // Document replacements touch the typeset text, never the user's own typing.
      if(doc.replace && src.kind === 'paragraph') src = applyDocReplace(src, doc.replace, docStats);
      const e = key ? sanitize(map.get(key)) : {};
      const unit = {key, move: e.move || 0, items: []};
      units.push(unit);
      if(!key || isEmpty(e)){
        const b = applyDocMarks(src, doc.marks, docStats);
        unit.items.push(key ? {...b, editKey: key} : b);
        continue;
      }
      applied++;
      log.push({key, excerpt: clean(flatten(src)).slice(0, 60), summary: describe(e)});
      // A deleted paragraph takes its own inserted blank lines / page break
      // with it; paragraphs the user added after it stay.
      if(!e.remove){
        if(e.breakBefore) unit.items.push({kind: 'page-break', inserted: true, insertedBy: key});
        if(e.blankBefore) unit.items.push(blank(key));
        let b = I().cloneBlock(src);
        if(e.mergeNext){
          // Join with the next paragraph (e.g. a line Word broke in two).
          let j = i + 1;
          while(j < blocks.length && blocks[j].kind === 'paragraph' && !clean(flatten(blocks[j]))) j++;
          const next = blocks[j];
          if(next?.kind === 'paragraph'){
            const n = stripMarker(I().cloneBlock(doc.replace ? applyDocReplace(next, doc.replace, {replace: [], marks: []}) : next));
            const tail = I().trimRuns(n.runs);
            if(tail.length){ b.runs = [...I().trimRuns(b.runs.map(r => ({...r}))), I().plainRun(' ', tail[0]), ...tail]; }
            i = j; // the merged paragraph (and blank lines before it) are consumed
          }
        }
        b = finish(b, e, key);
        b.editKey = key; b.edited = true;
        unit.items.push(b);
        if(e.blankAfter) unit.items.push(blank(key));
      }
      // Paragraphs the user added after this one: each is its own unit
      // (movable, editable, removable) right after the parent.
      for(const item of e.addAfter || []){
        const ck = childKey(key, item.id), ce = sanitize(map.get(ck));
        const cu = {key: ck, move: ce.move || 0, items: []};
        units.push(cu);
        if(ce.remove) continue;
        if(ce.breakBefore) cu.items.push({kind: 'page-break', inserted: true, insertedBy: ck});
        if(ce.blankBefore) cu.items.push(blank(ck));
        let c = newParagraph(unit.items.findLast?.(x => x.kind === 'paragraph' && !x.inserted) || src, item, opts);
        c = finish(c, ce, ck);
        c.editKey = ck; c.edited = true; c.added = true;
        cu.items.push(c);
        if(ce.blankAfter) cu.items.push(blank(ck));
        if(!isEmpty(ce)){ applied++; log.push({key: ck, excerpt: clean(item.text).slice(0, 60), summary: `eklenen paragraf: ${describe(ce)}`}); }
      }
    }
    const out = renumber(moveUnits(units).flatMap(u => u.items));
    const docLog = describeDoc(doc, docStats);
    if(docLog.length) log.push({key: DOC_KEY, excerpt: 'Belgenin tamamı', summary: docLog.join('; ')});
    return {blocks: out, applied, log, lost, doc: docStats};
  }

  // Current visible state of a paragraph, used to show which buttons are on.
  function state(block){
    const runs = (block?.runs || []).filter((r, i) => !(block.listMarker && i === 0) && clean(r.text));
    const all = k => runs.length > 0 && runs.every(r => !!r[k]);
    return {align: block?.alignment || 'left', bold: all('bold'), italic: all('italic'), underline: all('underline'),
      size: runs[0]?.size ?? 12, line: block?.line ?? 1, text: bodyText(block || {}), role: block?.role || ''};
  }
  // Is every character of [start, end) (body offsets) styled with k?
  function rangeHas(block, start, end, k){
    const base = markerLength(block);
    let off = 0, any = false;
    for(const r of block?.runs || []){
      const t = String(r.text || ''), a = off - base, z = a + t.length;
      off += t.length;
      if(z <= start || a >= end || !t.trim()) continue;
      any = true;
      if(!r[k]) return false;
    }
    return any;
  }

  globalThis.WordToUDFEdits = {ROLES, ALIGN, SIZES, LINES, SPACES, INDENTS, MARK_STYLES, MARK_TEXT, DOC_KEY, sanitize, sanitizeDoc, blockKeys, apply, describe, describeStyle, state,
    renumber, sentences, findMatches, bodyText, markerLength, rangeHas, childKey, parentOf, styleRange, replaceRange};
})();
