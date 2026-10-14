/* Manual paragraph editing (v1.5.0).
 *
 * The user taps a paragraph in the preview and changes its type, alignment,
 * emphasis, size, indents, spacing or text; can delete it, merge it with the
 * next paragraph, or insert a blank line / page break before it. Several
 * paragraphs can be edited at once.
 *
 * Edits are stored per paragraph KEY ("<occurrence>|<first 80 chars>" of the
 * typeset text), so they survive re-rendering when an unrelated setting
 * changes, and are applied after legal typography, before checks and UDF
 * writing. Edits never happen automatically; everything here is the user's
 * explicit choice and is listed in the report.
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
    return e;
  }
  const isEmpty = e => !e || !Object.keys(e).length;

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
  const bodyText = b => b.listMarker && b.runs[0]?.text === `${b.listMarker}\t` ? flatten({runs: b.runs.slice(1)}) : flatten(b);

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

  function replaceText(b, text){
    const T = I();
    const marker = b.listMarker && b.runs[0]?.text === `${b.listMarker}\t` ? b.runs[0] : null;
    const body = (marker ? b.runs.slice(1) : b.runs).filter(r => clean(r.text));
    const style = {...T.originRun({runs: body})};
    delete style.text;
    // Inline emphasis (one bold word, an italic citation) cannot survive free
    // text editing: a style is kept only if the WHOLE paragraph had it. Law
    // and case citations are re-styled the same way the typography layer does.
    for(const k of ['bold', 'italic', 'underline']) style[k] = body.length > 0 && body.every(r => !!r[k]);
    const nb = {...b, runs: [...(marker ? [marker] : []), T.plainRun(text, style)]};
    T.styleRegex(nb, T.LAW_RE, {italic: true});
    T.styleRegex(nb, T.CASE_RE, {bold: true, italic: true});
    return nb;
  }

  function fineTune(b, e){
    const T = I();
    if(e.align) b.alignment = e.align;
    const patch = {};
    for(const k of ['bold', 'italic', 'underline']) if(typeof e[k] === 'boolean') patch[k] = e[k];
    if(e.size) patch.size = e.size;
    if(Object.keys(patch).length){
      // The list number keeps normal weight; everything else gets the patch.
      const marker = b.listMarker && b.runs[0]?.text === `${b.listMarker}\t`;
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
  // insertions and type changes): 1., 2., 3. / a), b) per list id.
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
    if(e.mergeNext) out.push('sonraki paragrafla birleştirildi');
    if(e.blankBefore) out.push('önüne boş satır');
    if(e.blankAfter) out.push('arkasına boş satır');
    if(e.breakBefore) out.push('önüne sayfa sonu');
    if(e.remove) out.push('silindi');
    return out.join(', ');
  }

  // edits: Map-like (key → edit) or plain object. Returns the edited blocks,
  // each editable paragraph tagged with `editKey` for the preview.
  function apply(blocks, edits, opts = {}){
    const map = typeof edits?.get === 'function' && typeof edits.size === 'number' ? edits : new Map(Object.entries(edits || {}));
    const keys = blockKeys(blocks), out = [], log = [];
    let applied = 0;
    for(let i = 0; i < blocks.length; i++){
      const src = blocks[i], key = keys[i];
      const e = key ? sanitize(map.get(key)) : {};
      if(!key || isEmpty(e)){ out.push(key ? {...src, editKey: key} : src); continue; }
      applied++;
      log.push({key, excerpt: clean(flatten(src)).slice(0, 60), summary: describe(e)});
      // A deleted paragraph takes its own inserted blank lines / page break with it.
      if(e.remove){ continue; }
      if(e.breakBefore) out.push({kind: 'page-break', inserted: true, insertedBy: key});
      if(e.blankBefore) out.push(blank(key));
      let b = I().cloneBlock(src);
      if(e.mergeNext){
        // Join with the next paragraph (e.g. a line Word broke in two).
        let j = i + 1;
        while(j < blocks.length && blocks[j].kind === 'paragraph' && !clean(flatten(blocks[j]))) j++;
        const next = blocks[j];
        if(next?.kind === 'paragraph'){
          const n = stripMarker(I().cloneBlock(next));
          const tail = I().trimRuns(n.runs);
          if(tail.length){ b.runs = [...I().trimRuns(b.runs.map(r => ({...r}))), I().plainRun(' ', tail[0]), ...tail]; }
          i = j; // the merged paragraph (and blank lines before it) are consumed
        }
      }
      if(e.role) b = applyRole(b, e.role, opts);
      if(e.text !== undefined) b = replaceText(b, e.text);
      b = fineTune(b, e);
      b.editKey = key; b.edited = true;
      out.push(b);
      if(e.blankAfter) out.push(blank(key));
    }
    renumber(out);
    return {blocks: out, applied, log};
  }

  // Current visible state of a paragraph, used to show which buttons are on.
  function state(block){
    const runs = (block?.runs || []).filter((r, i) => !(block.listMarker && i === 0) && clean(r.text));
    const all = k => runs.length > 0 && runs.every(r => !!r[k]);
    return {align: block?.alignment || 'left', bold: all('bold'), italic: all('italic'), underline: all('underline'),
      size: runs[0]?.size ?? 12, line: block?.line ?? 1, text: bodyText(block || {}), role: block?.role || ''};
  }

  globalThis.WordToUDFEdits = {ROLES, ALIGN, SIZES, LINES, SPACES, INDENTS, sanitize, blockKeys, apply, describe, state, renumber};
})();
