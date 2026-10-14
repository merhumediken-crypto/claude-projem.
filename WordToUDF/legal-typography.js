/* Semantic legal-petition typography layer (v1.4.1).
 *
 * Pipeline: docx.js keeps the source → normalize.js applies page/AÇIKLAMALAR
 * geometry → this layer canonicalises a legal petition → udf.js serialises.
 *
 * Everything that defines the petition standard lives in SCHEMA and FIELD
 * registries below, so one rule is never copied into several functions.
 *
 * The petition contract implemented here:
 *  - Every künye and section label is "LABEL<TAB>: value". The label and the
 *    colon are bold + underlined, the tab run between them is underlined too
 *    (one continuous line from label to colon, v1.4.1), the value is normal. All colons sit on ONE shared tab stop (SCHEMA.colonTabCm).
 *  - Long values wrap naturally: left=0, first=0, no hanging indent and no
 *    second tab. Labels too wide for the column are split over two lines.
 *  - DOSYA NO + KARAR NO become one DOSYA NO row ("2026/713 E. 2026/708 K.").
 *  - Attorney rows carry UETS on the same paragraph; separate attorney
 *    address/UETS rows are fused, never duplicated, never invented.
 *  - KONU, HUKUKİ SEBEPLER, HUKUKİ DELİLLER, SONUÇ VE İSTEM carry their value
 *    on the label row; AÇIKLAMALAR and EKLER have an empty value.
 *  - SONUÇ VE İSTEM intro is exactly SCHEMA.resultIntro, requests become a
 *    real numbered list, the closing sentence is outside the list and ends
 *    with today's Europe/Istanbul date on the same paragraph.
 *  - EKLER entries become a separate real numbered list.
 * The layer never invents case numbers, UETS numbers, requests or attachments.
 * Every textual change is recorded in statistics.changes for the report.
 */
(() => {
  'use strict';

  const PT_PER_CM = 72 / 2.54;
  const NORMAL_RULES = () => globalThis.WordToUDFNormalize?.RULES || {};

  const SCHEMA = Object.freeze({
    colonTabCm: 6.0,          // shared x position of every ":" (≈170 pt)
    labelGapPt: 5,            // minimum white space between label and colon
    labelSize: 12,
    bodySize: 12,
    courtSize: 14,
    titleSize: 12.5,
    hangingPt: 18,            // list number column
    bodyLine: 1.5,            // explanation/result/section line spacing
    kunyeLine: 1,
    font: 'Times New Roman',  // legal profile: one petition font, never Word theme fonts (Cambria/Calibri)
    resultIntro: 'Yukarıda arz edilen sebeplerle;',
    defaultClosing: 'Karar verilmesini vekâleten talep ederim.',
    timeZone: 'Europe/Istanbul',
    // The petition writer's own attorney profile. Used for the VEKİLİ row when
    // the source names this attorney; other attorneys get a UETS number only
    // when the user enters one for them (otherwise the value stays plain).
    // Single source: settings.js DEFAULTS (the user can change it in the UI).
    get ownAttorney(){ return globalThis.WordToUDFSettings?.DEFAULTS?.ownAttorney || null; },
    lists: Object.freeze({
      result: Object.freeze({id: '1', type: 'NUMBER_TYPE_NUMBER_DOT', format: 'decimal', suffix: '.'}),
      attachments: Object.freeze({id: '2', type: 'NUMBER_TYPE_NUMBER_DOT', format: 'decimal', suffix: '.'}),
      sub: Object.freeze({type: 'NUMBER_TYPE_CHAR_SMALL_PARENTHESIS', format: 'lowerLetter', suffix: ')'})
    })
  });

  const flatten = b => (b?.runs || []).map(r => r.text || '').join('');
  const clean = s => String(s || '').replace(/\s+/gu, ' ').trim();
  const upper = s => clean(s).toLocaleUpperCase('tr-TR');
  const stripColon = s => upper(s).replace(/\s*[:：.]\s*$/u, '').trim();

  const RULES_SRC = globalThis.WordToUDFLegalRules;
  if(!RULES_SRC) throw new Error('legal-rules.js, legal-typography.js dosyasından önce yüklenmelidir.');
  const {REQUEST_END_RE, FIELD_RULES, SECTION_RULES, COURT_RE, PETITION_TITLE_RE, INTERNAL_HEADING_RE, SIGNATURE_UPPER_RE, CLOSING_TAIL_RE, CLOSING_SPLIT_RE, INTRO_RE, DATE_ONLY_RE, TRAILING_DATE_RE, LIST_PREFIX_RE, SUB_PREFIX_RE, LAW_RE, CASE_RE, RESULT_EMPHASIS_RE, INSTITUTION_RE, GIVEN_NAMES, BOLD_WIDTHS} = RULES_SRC;
  const fieldRule = label => FIELD_RULES.find(r => r.re.test(stripColon(label))) || null;
  const sectionRule = label => SECTION_RULES.find(r => r.re.test(stripColon(label))) || null;

  const labelWidthPt = (label, size = SCHEMA.labelSize) => [...String(label)].reduce((sum, ch) => sum + (BOLD_WIDTHS[ch] ?? (/\d/u.test(ch) ? 500 : 600)), 0) / 1000 * size;

  const cloneBlock = b => ({...b, runs: (b.runs || []).map(r => ({...r})), tabStops: b.tabStops?.map(t => ({...t})), list: b.list ? {...b.list} : undefined});
  function setAllRuns(block, patch){ block.runs = block.runs.map(r => ({...r, ...patch})); return block; }
  function plainRun(text, src = {}){ const copy = {...src, text}; delete copy.hidden; return copy; }
  function originRun(block){ return {...((block?.runs || []).find(r => clean(r.text)) || {})}; }

  // Slice runs by flattened-text offsets, keeping per-run formatting.
  function sliceRuns(runs, start, end = Infinity){
    const out = []; let offset = 0;
    for(const run of runs || []){
      const text = String(run.text || ''), from = offset, to = offset + text.length;
      offset = to;
      const a = Math.max(start, from), b = Math.min(end, to);
      if(b > a) out.push({...run, text: text.slice(a - from, b - from)});
    }
    return out;
  }
  function trimRuns(runs){
    const out = runs.map(r => ({...r}));
    while(out.length && !out[0].text.replace(/^[\s\t]+/u, '')) out.shift();
    if(out.length) out[0].text = out[0].text.replace(/^[\s\t]+/u, '');
    while(out.length && !out.at(-1).text.replace(/[\s\t]+$/u, '')) out.pop();
    if(out.length) out.at(-1).text = out.at(-1).text.replace(/[\s\t]+$/u, '');
    return out.filter(r => r.text);
  }

  // Search the complete paragraph, then style the matched ranges across Word
  // run boundaries. A citation can be split by bold/italic/font Word runs.
  function styleRegex(block, regex, patch, {skipRuns} = {}){
    const original = block.runs || [];
    const full = original.map(r => String(r.text || '')).join('');
    if(!full) return block;
    const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
    const re = new RegExp(regex.source, flags), matches = [];
    let match;
    while((match = re.exec(full))){
      if(match[0].length) matches.push({start: match.index, end: match.index + match[0].length});
      else re.lastIndex++;
    }
    if(!matches.length) return block;
    const next = []; let offset = 0, mi = 0;
    for(const run of original){
      const content = String(run.text || '');
      const runStart = offset, runEnd = offset + content.length;
      offset = runEnd;
      if(!content) continue;
      if(skipRuns?.(run)){ next.push(run); continue; }
      while(mi < matches.length && matches[mi].end <= runStart) mi++;
      let cursor = runStart, k = mi;
      while(k < matches.length && matches[k].start < runEnd){
        const m = matches[k];
        if(m.start > cursor){ next.push({...run, text: content.slice(cursor - runStart, Math.min(m.start, runEnd) - runStart)}); cursor = m.start; }
        const until = Math.min(m.end, runEnd);
        if(until > cursor){ next.push({...run, ...patch, text: content.slice(cursor - runStart, until - runStart)}); cursor = until; }
        if(m.end <= runEnd) k++; else break;
      }
      if(cursor < runEnd) next.push({...run, text: content.slice(cursor - runStart)});
      mi = k;
    }
    block.runs = next.filter(r => r.text);
    return block;
  }

  /* ------------------------------ detection ------------------------------ */
  function uppercaseRatio(text){
    const letters = [...text].filter(c => /\p{L}/u.test(c));
    if(!letters.length) return 1;
    return letters.filter(c => c === c.toLocaleUpperCase('tr-TR')).length / letters.length;
  }
  function isCourtHeading(text, index){
    const u = upper(text);
    if(index > 8 || !u || u.length > 150) return false;
    if(!COURT_RE.test(u)) return false;
    return uppercaseRatio(text) > 0.78;
  }
  function isPetitionTitle(text, index){
    const u = upper(text);
    if(parseField(text)) return false;
    return index <= 12 && u.length >= 12 && u.length <= 240 && PETITION_TITLE_RE.test(u);
  }
  function isInternalHeading(text){
    const t = clean(text);
    if(!INTERNAL_HEADING_RE.test(t) || t.length > 220) return false;
    return uppercaseRatio(t) > .62;
  }

  // "LABEL : value", "LABEL<TAB>: value", "LABEL:" — label must be known.
  function parseField(text){
    const raw = String(text || '');
    const m = /^[\s ]*([^:：\n]{2,60}?)[\s \t]*[:：][ \t ]*(.*)$/su.exec(raw);
    if(!m) return null;
    const label = clean(m[1]);
    const rule = fieldRule(label), section = rule ? null : sectionRule(label);
    if(!rule && !section) return null;
    return {label, value: clean(m[2]), valueOffset: raw.length - m[2].length, rule, section};
  }
  function parseStandaloneLabel(text){
    const t = clean(text);
    if(!t || t.length > 60) return null;
    const bare = t.replace(/[\s\t]*[:：.]?\s*$/u, '');
    const rule = fieldRule(bare), section = rule ? null : sectionRule(bare);
    if(!rule && !section) return null;
    if(rule && !/[:：]\s*$/u.test(t)) return null; // künye labels need a colon
    if(section && uppercaseRatio(bare) < 0.8) return null; // "Sonuç" prose
    return {label: bare, value: '', valueOffset: String(text).length, rule, section};
  }
  const lineField = text => parseField(text) || parseStandaloneLabel(text);
  function parseCasePair(s){
    const m = /^\s*((?:DOSYA|ESAS)\s+NO)\s*[:：]?\s*(.*?)\s+KARAR\s+NO\s*[:：]\s*(.*?)\s*$/iu.exec(s);
    return m && m[2] && m[3] ? {esas: /^ESAS/iu.test(m[1]), first: m[2], second: m[3]} : null;
  }
  const isSectionLine = text => !!(lineField(text)?.section);

  /* ------------------------------ person names ------------------------------ */
  function casePerson(words, changes){
    const caps = words.map(w => w.toLocaleUpperCase('tr-TR'));
    // Source already marks the surname (some word in capitals): keep it.
    if(words.some((w, i) => w.length > 1 && w === caps[i])) return null;
    let known = 0;
    while(known < words.length && GIVEN_NAMES.has(caps[known])) known++;
    known = Math.min(known, words.length - 1);
    let surnames = words.length - known;
    if(!(surnames === 1 || (surnames === 2 && words.length >= 4))) surnames = 1;
    if(known === 0 && words.length >= 3) changes?.push({type: 'name-ambiguous', before: words.join(' '), after: 'yalnız son sözcük büyütüldü; kontrol edin'});
    return words.map((w, i) => i >= words.length - surnames ? caps[i] : w).join(' ');
  }
  const NAME_WORD = "[\\p{Lu}][\\p{Ll}'’]+(?:-[\\p{Lu}][\\p{Ll}'’]+)?";
  const PERSON_RE = new RegExp(`^((?:(?:Av\\.|Avukat|Stj\\.\\s*Av\\.|Dr\\.|Prof\\.|Doç\\.)\\s+)*)(${NAME_WORD}(?:\\s+${NAME_WORD}){1,5})(\\s*)$`, 'u');
  function nameCase(value, changes){
    const v = clean(value);
    if(!v || /\d/u.test(v) || INSTITUTION_RE.test(upper(v))) return value;
    const m = PERSON_RE.exec(v);
    if(!m) return value;
    const cased = casePerson(m[2].split(/\s+/u), changes);
    if(!cased) return value;
    const out = m[1] + cased + m[3];
    if(out !== v) changes?.push({type: 'surname', before: v, after: out});
    return out;
  }
  // "İtiraz Eden Vekili Av. Ayşe Nur Geyik Öztürkmen" → surname in caps.
  function nameCaseTail(text, changes){
    const m = new RegExp(`^(.*?(?:^|\\s))((?:Av\\.|Avukat)\\s+${NAME_WORD}(?:\\s+${NAME_WORD}){1,5})\\s*$`, 'u').exec(text);
    if(!m) return text;
    return m[1] + nameCase(m[2], changes);
  }

  /* ------------------------------ UETS ------------------------------ */
  const UETS_NUMBER_RE = /^\d{5}-\d{5}-\d{5}$/u;
  const personKey = s => upper(s).replace(/^(?:AV\.|AVUKAT)\s*/u, '').replace(/[^\p{L}\s]/gu, '').replace(/\s+/gu, ' ').trim();
  // Registry text: one attorney per line, "Av. Ad SOYAD = 12345-12345-12345".
  function parseUetsRegistry(input){
    const map = new Map(), errors = [];
    const lines = Array.isArray(input) ? input.map(x => `${x.name}=${x.uets}`) : String(input || '').split(/\r?\n/u);
    lines.forEach((line, i) => {
      if(!line.trim()) return;
      const m = /^(.+?)\s*[=:|]\s*(\S+)\s*$/u.exec(line);
      if(!m || !UETS_NUMBER_RE.test(m[2]) || personKey(m[1]).split(' ').length < 2){ errors.push(i + 1); return; }
      map.set(personKey(m[1]), m[2]);
    });
    return {map, errors};
  }
  function attorneyValue(value, extras, ctx){
    let v = clean(value);
    if(!v) return '';
    const segments = v.split(/\s*,\s*(?=(?:Av\.|Avukat)\s)/u);
    const fused = extras.uets.filter(Boolean);
    const out = segments.map(seg => {
      // A bare "(UETS)" marker without a number is replaced by the real
      // number when one is known, otherwise removed (left empty).
      let s = nameCase(clean(seg.replace(/\s*\(\s*UETS\s*\)\s*/giu, ' ')), ctx.changes);
      if(/UETS/iu.test(s) || !ctx.opts.markUets) return s;
      const known = ctx.uets.get(personKey(s.replace(/\(.*$/u, '')));
      if(known){ ctx.changes.push({type: 'uets-profile', before: s, after: `${s} (UETS: ${known})`}); return `${s} (UETS: ${known})`; }
      if(fused.length && segments.length === 1) return `${s} (UETS: ${fused.join(', ')})`;
      return s;
    });
    v = out.join(', ');
    if(fused.length && segments.length > 1) v += ` (UETS: ${fused.join(', ')})`;
    if(extras.address.length) v += `, ${extras.address.join(', ')}`;
    return v;
  }

  /* ------------------------------ row builders ------------------------------ */
  const colonTabPt = opts => Math.round((opts.colonTabCm ?? NORMAL_RULES().colonTabCm ?? SCHEMA.colonTabCm) * PT_PER_CM * 100) / 100;
  function splitLabel(label, limit){
    const words = label.split(' ');
    if(words.length < 2 || labelWidthPt(label) + SCHEMA.labelGapPt <= limit) return [label];
    let first = words[0], i = 1;
    while(i < words.length - 1 && labelWidthPt(`${first} ${words[i]}`) + SCHEMA.labelGapPt <= limit) first += ` ${words[i++]}`;
    return [first, words.slice(i).join(' ')];
  }
  // One physical "LABEL<TAB>: value" paragraph (plus an optional first label
  // line when the label is too wide for the shared colon column).
  // Field rows are always left aligned: in a justified paragraph UDF editors
  // ignore the TabSet (Swing adds a fixed gap), so KONU/HUKUKİ SEBEPLER colons
  // drifted right of the shared colon column.
  function fieldRows(label, valueRuns, source, role, ctx, {fieldKind, line, alignment = 'left', above = 0, below = 0} = {}){
    const origin = originRun(source);
    delete origin.italic; delete origin.strike;
    const tab = colonTabPt(ctx.opts);
    const lab = upper(label);
    const parts = splitLabel(lab, tab);
    const labelStyle = {...origin, bold: true, underline: true, italic: false, size: SCHEMA.labelSize};
    const base = {...cloneBlock(source), kind: 'paragraph', alignment, left: 0, first: 0, right: 0, above, below,
      line: line ?? SCHEMA.kunyeLine, tabStops: [{pos: tab, align: 'left', leader: 'none'}], role, fieldKind, fieldLabel: lab};
    delete base.list; delete base.numId; delete base.ilvl;
    const rows = [];
    if(parts.length > 1){
      rows.push({...base, runs: [plainRun(parts[0], labelStyle)], tabStops: [], role: 'field-label-line', below: 0});
      rows[0].fieldLabel = lab;
    }
    const value = trimRuns(valueRuns || []);
    const runs = [plainRun(parts.at(-1), labelStyle), plainRun('\t', {...origin, bold: false, underline: true, italic: false}), plainRun(':', labelStyle)];
    if(value.length){
      value[0] = {...value[0], text: ' ' + value[0].text};
      for(const r of value) runs.push(plainRun(r.text, {...r, bold: r.keepBold ? r.bold : false, underline: false, size: SCHEMA.bodySize}));
    }
    rows.push({...base, runs, above: parts.length > 1 ? 0 : above});
    if(parts.length > 1) ctx.changes.push({type: 'label-split', before: lab, after: parts.join(' / ')});
    return rows;
  }
  const textRuns = (text, source) => [plainRun(text, {...originRun(source), bold: false, underline: false})];

  /* ------------------------------ dates ------------------------------ */
  function todayTR(now = new Date(), timeZone = SCHEMA.timeZone){
    const parts = Object.fromEntries(new Intl.DateTimeFormat('tr-TR', {timeZone, day: '2-digit', month: '2-digit', year: 'numeric'})
      .formatToParts(now instanceof Date ? now : new Date(now)).map(p => [p.type, p.value]));
    return `${parts.day}.${parts.month}.${parts.year}`;
  }

  /* ------------------------------ list helpers ------------------------------ */
  function stripListPrefix(block){
    const text = flatten(block);
    let m = LIST_PREFIX_RE.exec(text), sub = false;
    if(!m){ m = SUB_PREFIX_RE.exec(text); sub = !!m; }
    if(!m) return {block, removed: '', sub: false};
    const b = cloneBlock(block);
    b.runs = trimRuns(sliceRuns(block.runs, m[0].length));
    return {block: b, removed: clean(m[0]), sub};
  }
  const alphaMarker = n => { let out = ''; while(n > 0){ n--; out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26); } return out; };
  function makeListItem(block, list, role, ctx, line){
    const {block: b, removed, sub} = stripListPrefix(block);
    const spec = sub ? {...list, ...SCHEMA.lists.sub} : list;
    delete b.numId; delete b.ilvl;
    b.role = role;
    b.alignment = 'justify';
    b.left = SCHEMA.hangingPt * (sub ? 2 : 1); b.first = -SCHEMA.hangingPt; b.right = 0;
    b.above = 0; b.below = 0; b.line = line; b.tabStops = [];
    if(removed) ctx.changes.push({type: 'manual-number', before: `${removed} ${clean(flatten(b)).slice(0, 60)}`, after: ctx.opts.listMode === 'text' ? 'sıralı liste numarası' : 'otomatik liste numarası'});
    if(ctx.opts.listMode === 'text'){
      // Visible "1.<TAB>" number in the hanging column. Some UDF viewers draw
      // an automatic list number on top of the first word ("114.10.2026");
      // a text number with an explicit tab stop renders identically everywhere.
      const counters = ctx.listCounters[list.id] ||= [0, 0];
      if(sub) counters[1]++; else { counters[0]++; counters[1] = 0; }
      const marker = sub ? `${alphaMarker(counters[1])}${spec.suffix}` : `${counters[0]}${spec.suffix}`;
      delete b.list;
      b.listMarker = marker;
      b.tabStops = [{pos: b.left, align: 'left', leader: 'none'}];
      b.runs = [plainRun(`${marker}\t`, {...originRun(b), bold: false, italic: false, underline: false}), ...b.runs];
    } else b.list = {kind: 'number', id: list.id, level: sub ? 1 : 0, raw: spec.type, format: spec.format, suffix: spec.suffix};

    return b;
  }

  /* ------------------------------ request split ------------------------------ */
  // Offsets where one paragraph holding several requests can be cut:
  // "... kabulüne, müvekkil ... bırakılmasına, ... öğrenilmesine," → 3 parts.
  // Each part must be a real clause (≥ 4 words) so "kabulüne, reddine" lists
  // inside a single request are not torn apart.
  function requestCuts(text){
    const cuts = [], re = /([\p{L}]+),\s+/gu;
    let m, last = 0;
    while((m = re.exec(text))){
      if(!REQUEST_END_RE.test(m[1])) continue;
      const end = m.index + m[0].length;
      const part = text.slice(last, end), rest = text.slice(end);
      if(part.trim().split(/\s+/u).length < 4 || rest.trim().split(/\s+/u).length < 4) continue;
      cuts.push(end); last = end;
    }
    return cuts;
  }
  function splitRequestBlock(block){
    const text = flatten(block), cuts = requestCuts(text);
    if(!cuts.length) return [block];
    const bounds = [0, ...cuts, text.length], parts = [];
    for(let i = 0; i + 1 < bounds.length; i++){
      const b = cloneBlock(block);
      b.runs = trimRuns(sliceRuns(block.runs, bounds[i], bounds[i + 1]));
      // A new item starts with a capital letter ("müvekkil" → "Müvekkil").
      if(i > 0 && b.runs.length) b.runs[0] = {...b.runs[0], text: b.runs[0].text.charAt(0).toLocaleUpperCase('tr-TR') + b.runs[0].text.slice(1)};
      if(b.runs.length) parts.push(b);
    }
    return parts.length > 1 ? parts : [block];
  }

  /* ------------------------------ künye phase ------------------------------ */
  function isKunyeBoundary(text, index){
    return !text || !!lineField(text) || isPetitionTitle(text, index) || isCourtHeading(text, index) || !!parseCasePair(text);
  }
  // An all-capitals short line ("GİRİŞ", "T.C.") is a heading, not the next
  // line of an address or title. Capitalised company names are still values.
  function isCapsHeading(text){
    return !!text && text.length <= 60 && !/\d/u.test(text) && uppercaseRatio(text) > 0.9 && !INSTITUTION_RE.test(upper(text)) && [...text].filter(c => /\p{L}/u.test(c)).length >= 2;
  }
  function canonicalLabel(field){
    const r = field.rule;
    return r?.to || stripColon(field.label);
  }
  function reflowKunye(blocks, limit, ctx){
    const out = [];
    let last = null; // last emitted field {kind, rows, label, value, extras, source}
    const fields = [];
    const emit = f => {
      const kind = f.kind;
      let valueText = f.value;
      // Name/UETS changes are logged once, for the final form of the row.
      const log = [], local = {...ctx, changes: log};
      if(kind === 'attorney') valueText = attorneyValue(f.value, f.extras, local);
      else if(['party', 'defender'].includes(kind)) valueText = nameCase(f.value, log);
      f.log = log;
      if(!fields.includes(f)) fields.push(f);
      const rows = fieldRows(f.label, valueText ? textRuns(valueText, f.source) : [], f.source,
        kind === 'topic' ? 'topic' : kind === 'case' ? 'case-number' : 'metadata', ctx,
        {fieldKind: kind, alignment: 'left'});
      if(f.rows){ out.splice(out.indexOf(f.rows[0]), f.rows.length, ...rows); }
      else out.push(...rows);
      f.rows = rows;
      last = f;
    };
    const labelChange = (from, to) => { if(upper(from) !== upper(to)) ctx.changes.push({type: 'label', before: upper(from), after: to}); };
    for(let i = 0; i < limit; i++){
      const b = blocks[i], text = clean(flatten(b));
      if(b.kind !== 'paragraph' || b.source === 'table'){ out.push(b); last = null; continue; }
      const pair = parseCasePair(text);
      if(pair){
        emit(caseField(pair.esas, pair.first, pair.second, b, ctx));
        ctx.stats.paired++; last = null; continue;
      }
      const field = lineField(text);
      if(!field || field.section){
        // Continuation fragment of the previous value (address, long title).
        // An unknown CAPITALISED label with a colon ("KARŞI VEKİL ADRESİ: …") is
        // a künye row we do not know, never the continuation of the previous value.
        const unknownLabel = /^[A-ZÇĞİÖŞÜÂÎÛ][A-ZÇĞİÖŞÜÂÎÛ .]{2,45}\s*[:：]/u.test(text);
        if(last && text && !unknownLabel && !isKunyeBoundary(text, i) && !isCapsHeading(text) && !INTERNAL_HEADING_RE.test(text) && text.length <= 300 && ['party', 'address', 'attorney', 'topic', 'file', 'other', 'defender'].includes(last.kind)
          && !(last.kind === 'topic' && /[.!?]$/u.test(last.value))){
          last.value = last.value ? `${last.value}${last.kind === 'attorney' && /^(?:Av\.|Avukat)\s/u.test(text) ? ', ' : ' '}${text}` : text;
          ctx.stats.merged++;
          emit(last); continue;
        }
        out.push(b); last = null; continue;
      }
      const kind = field.rule.kind;
      let value = field.value;
      let consumed = 0;
      if(!value && i + 1 < limit){
        const next = blocks[i + 1], nextText = clean(flatten(next));
        if(next.kind === 'paragraph' && next.source !== 'table' && !isKunyeBoundary(nextText, i + 1)){ value = nextText; consumed = 1; ctx.stats.merged++; }
      }
      // Case number + KARAR NO on the next line → one DOSYA NO row.
      if(kind === 'case'){
        let j = i + 1 + consumed;
        while(j < limit && !clean(flatten(blocks[j])) && j < i + 3) j++;
        const nf = j < limit && blocks[j].kind === 'paragraph' ? lineField(clean(flatten(blocks[j]))) : null;
        if(nf?.rule?.kind === 'karar'){
          let kv = nf.value, extra = 0;
          if(!kv && j + 1 < limit && !isKunyeBoundary(clean(flatten(blocks[j + 1])), j + 1)){ kv = clean(flatten(blocks[j + 1])); extra = 1; }
          if(kv && value){
            emit(caseField(!!field.rule.esas, value, kv, b, ctx));
            ctx.stats.paired++; last = null; i = j + extra; continue;
          }
        }
      }
      // Attorney-specific address / UETS rows join the preceding VEKİLİ row.
      if(last?.kind === 'attorney' && (kind === 'uets' || kind === 'attorney-extra' || kind === 'address')){
        const u = /(\d{5}\s*-\s*\d{5}\s*-\s*\d{5})/u.exec(value);
        if(kind === 'uets'){ last.extras.uets.push(u ? u[1].replace(/\s+/gu, '') : value); }
        else {
          const rest = clean(value.replace(/(?:,?\s*UETS\s*[:：]?\s*)?\d{5}\s*-\s*\d{5}\s*-\s*\d{5}/giu, '').replace(/\bUETS\b\s*[:：]?/giu, ''));
          if(u) last.extras.uets.push(u[1].replace(/\s+/gu, ''));
          if(rest) last.extras.address.push(rest);
        }
        ctx.changes.push({type: 'attorney-fuse', before: `${upper(field.label)}: ${value}`, after: 'VEKİLİ satırına taşındı'});
        ctx.stats.merged++;
        emit(last); i += consumed; continue;
      }
      const label = canonicalLabel(field);
      labelChange(field.label, label);
      emit({kind, label, value, source: b, extras: {uets: [], address: []}});
      i += consumed;
    }
    for(const f of fields) ctx.changes.push(...f.log);
    return out;
  }
  function caseField(esas, first, second, source, ctx){
    let a = clean(first), k = clean(second);
    if(esas && /^\d{4}\/\d+$/u.test(a)) a += ' E.';
    if(/^\d{4}\/\d+$/u.test(k)) k += ' K.';
    ctx.changes.push({type: 'case-number', before: `${esas ? 'ESAS' : 'DOSYA'} NO: ${clean(first)} / KARAR NO: ${clean(second)}`, after: `DOSYA NO : ${a} ${k}`});
    return {kind: 'case', label: 'DOSYA NO', value: `${a} ${k}`, source, extras: {uets: [], address: []}};
  }

  /* ------------------------------ section phase ------------------------------ */
  function nextNonEmpty(blocks, from, to){
    for(let j = from; j < to; j++) if(blocks[j].kind === 'paragraph' && clean(flatten(blocks[j]))) return j;
    return -1;
  }
  function sectionStartIndex(blocks, from, to){
    for(let j = from; j < to; j++) if(blocks[j].kind === 'paragraph' && blocks[j].source !== 'table' && isSectionLine(flatten(blocks[j]))) return j;
    return to;
  }
  function explanationHeading(b, field, ctx, out){
    const rows = fieldRows(stripColon(field.label), [], b, 'major-heading', ctx, {fieldKind: 'explanations'});
    out.push(...rows);
    if(field.value){
      const body = cloneBlock(b);
      body.runs = trimRuns(sliceRuns(b.runs, field.valueOffset));
      const R = NORMAL_RULES();
      body.alignment = 'justify'; body.left = 0; body.right = 0;
      body.first = (R.explanationFirstCm ?? 1.25) * PT_PER_CM;
      body.above = body.below = (R.explanationParagraphCm ?? 0.15) * PT_PER_CM;
      body.line = ctx.opts.lineSpacing; body.tabStops = [];
      body.role = 'explanation-body'; body.zone = 'expl';
      out.push(body);
      ctx.changes.push({type: 'explanations-split', before: clean(flatten(b)).slice(0, 80), after: 'AÇIKLAMALAR başlığı ayrı, metin sonraki paragrafta'});
    }
  }
  function inlineSection(blocks, i, field, end, ctx, out){
    const b = blocks[i];
    const line = ctx.opts.lineSpacing;
    if(field.value){
      out.push(...fieldRows(stripColon(field.label), sliceRuns(b.runs, field.valueOffset), b, 'section-field', ctx, {fieldKind: field.section.kind, line, alignment: 'left'}));
      return i;
    }
    const stop = sectionStartIndex(blocks, i + 1, end);
    const filled = [];
    for(let j = i + 1; j < stop; j++) if(blocks[j].kind === 'paragraph' && clean(flatten(blocks[j]))) filled.push(j);
    if(filled.length === 1 && blocks[filled[0]].source !== 'table'){
      const j = filled[0];
      out.push(...fieldRows(stripColon(field.label), blocks[j].runs, b, 'section-field', ctx, {fieldKind: field.section.kind, line, alignment: 'left'}));
      ctx.changes.push({type: 'section-inline', before: `${stripColon(field.label)} / ${clean(flatten(blocks[j])).slice(0, 60)}`, after: 'başlıkla aynı paragraf'});
      for(let k = j + 1; k < stop; k++) out.push(blocks[k]);
      return stop - 1;
    }
    out.push(...fieldRows(stripColon(field.label), [], b, 'major-heading', ctx, {fieldKind: field.section.kind}));
    for(let k = i + 1; k < stop; k++){
      const c = cloneBlock(blocks[k]);
      if(c.kind === 'paragraph' && c.source !== 'table'){ c.left = 0; c.first = 0; c.line = line; }
      out.push(c);
    }
    return stop - 1;
  }
  function isSignatureLike(text){
    const t = clean(text);
    return !!t && t.length <= 125 && SIGNATURE_UPPER_RE.test(upper(t)) && !/[.!?]$/u.test(t) && !/[.!?]\s+\S/u.test(t.replace(/\b(?:Av|Dr|Prof|Doç|Stj)\.\s*/gu, ''));
  }
  function resultSection(blocks, i, field, end, ctx, out){
    const b = blocks[i], line = ctx.opts.lineSpacing;
    const zoneEnd = (() => { for(let j = i + 1; j < end; j++){ const f = lineField(flatten(blocks[j])); if(f?.section?.kind === 'attachments') return j; } return end; })();
    // Candidate paragraphs (inline value first).
    const seq = [];
    if(field.value){ const v = cloneBlock(b); v.runs = trimRuns(sliceRuns(b.runs, field.valueOffset)); seq.push({block: v, idx: i, inline: true}); }
    for(let j = i + 1; j < zoneEnd; j++) seq.push({block: blocks[j], idx: j});
    const textOf = s => clean(flatten(s.block));
    // 1. intro
    let pos = seq.findIndex(s => s.block.kind === 'paragraph' && textOf(s));
    if(pos >= 0 && INTRO_RE.test(textOf(seq[pos]))){
      const t = textOf(seq[pos]);
      const m = INTRO_RE.exec(t);
      // Parenthetical additions after the intro are dropped by user decision.
      const rest = clean(t.slice(m[0].length).replace(/^\s*[;:,]?\s*(?:\([^)]*\)\s*)?[;:,]?\s*/u, ''));
      if(t !== SCHEMA.resultIntro) ctx.changes.push({type: 'result-intro', before: t, after: SCHEMA.resultIntro});
      if(rest){
        const start = flatten(seq[pos].block).indexOf(rest.slice(0, 12));
        const nb = cloneBlock(seq[pos].block);
        nb.runs = start >= 0 ? trimRuns(sliceRuns(seq[pos].block.runs, start)) : textRuns(rest, seq[pos].block);
        seq[pos] = {block: nb, idx: seq[pos].idx};
      } else seq.splice(pos, 1);
    } else ctx.changes.push({type: 'result-intro', before: '(yok)', after: SCHEMA.resultIntro});
    out.push(...fieldRows(stripColon(field.label), textRuns(SCHEMA.resultIntro, b), b, 'result-heading', ctx, {fieldKind: 'result', line}));
    // 2. closing: last non-numbered closing sentence, or a closing tail inside the last item.
    let closing = -1, closingBlock = null;
    for(let k = seq.length - 1; k >= 0; k--){
      const t = textOf(seq[k]);
      if(!t || seq[k].block.kind !== 'paragraph') continue;
      const stripped = t.replace(TRAILING_DATE_RE, '');
      // A long last request that ends with "... karar verilmesini ... talep
      // ederiz." carries the closing itself: split it instead of appending a
      // second (default) closing sentence.
      if(CLOSING_TAIL_RE.test(stripped) && stripped.length > 220){
        const split = CLOSING_SPLIT_RE.exec(stripListPrefix(seq[k].block).block.runs.map(r => r.text).join('').replace(TRAILING_DATE_RE, ''));
        if(!split || !clean(split[1])) continue;
      }
      if(CLOSING_TAIL_RE.test(stripped)){
        const numbered = LIST_PREFIX_RE.test(t) || SUB_PREFIX_RE.test(t);
        const split = CLOSING_SPLIT_RE.exec(stripListPrefix(seq[k].block).block.runs.map(r => r.text).join('').replace(TRAILING_DATE_RE, ''));
        if(!numbered && (!split || /^(?:karar|hüküm)/iu.test(stripped)) && stripped.length <= 220){ closing = k; closingBlock = seq[k].block; break; }
        if(split && clean(split[1])){
          // "4. Yargılama giderlerinin ... yükletilmesine karar verilmesini talep ederim."
          const item = cloneBlock(seq[k].block);
          const full = flatten(item);
          const cut = full.lastIndexOf(split[2].trim().slice(0, 15));
          item.runs = trimRuns(sliceRuns(item.runs, 0, cut));
          if(!/[,;.:]$/u.test(flatten(item))) item.runs.push(plainRun(',', item.runs.at(-1) || {}));
          const cb = cloneBlock(seq[k].block);
          const tail = split[2].trim();
          cb.runs = trimRuns(sliceRuns(seq[k].block.runs, cut));
          cb.runs[0] = {...cb.runs[0], text: cb.runs[0].text.charAt(0).toLocaleUpperCase('tr-TR') + cb.runs[0].text.slice(1)};
          seq.splice(k, 1, {block: item, idx: seq[k].idx}, {block: cb, idx: seq[k].idx, split: true});
          closing = k + 1; closingBlock = cb;
          ctx.changes.push({type: 'closing-split', before: t, after: `${clean(flatten(item))} | ${tail}`});
          break;
        }
        if(numbered){ // "1. Karar verilmesini talep ederim." – a closing typed as an item
          closing = k; closingBlock = stripListPrefix(seq[k].block).block; seq[k] = {block: closingBlock, idx: seq[k].idx}; break;
        }
      }
    }
    // 3. items: everything non-empty before the closing (or before a signature).
    let itemsEnd = closing >= 0 ? closing : seq.length;
    if(closing < 0){
      for(let k = 0; k < seq.length; k++){ if(isSignatureLike(textOf(seq[k])) && !LIST_PREFIX_RE.test(textOf(seq[k]))){ itemsEnd = k; break; } }
      while(itemsEnd > 0 && !textOf(seq[itemsEnd - 1])) itemsEnd--;
    }
    let items = 0, droppedBlank = 0;
    for(let k = 0; k < itemsEnd; k++){
      const s = seq[k];
      if(s.block.kind !== 'paragraph' || s.block.source === 'table'){ out.push(s.block); continue; }
      const t = textOf(s);
      if(!t){ droppedBlank++; continue; }
      if(DATE_ONLY_RE.test(t)){ ctx.dateLines.push(t); continue; }
      const {block: bare} = stripListPrefix(s.block);
      const parts = splitRequestBlock(bare);
      if(parts.length > 1){
        ctx.stats.splittable += parts.length;
        if(ctx.opts.splitRequests){
          ctx.changes.push({type: 'request-split', before: clean(flatten(bare)).slice(0, 80) + '…', after: `${parts.length} ayrı talep maddesi`});
          for(const part of parts){
            const item = makeListItem(part, SCHEMA.lists.result, 'result-item', ctx, line);
            styleRegex(item, RESULT_EMPHASIS_RE, {bold: true});
            out.push(item); items++;
          }
          continue;
        }
      }
      const item = makeListItem(s.block, SCHEMA.lists.result, 'result-item', ctx, line);
      styleRegex(item, RESULT_EMPHASIS_RE, {bold: true});
      out.push(item); items++;
    }
    if(droppedBlank) ctx.changes.push({type: 'blank-removed', before: `${droppedBlank} boş satır`, after: 'sonuç listesi kesintisiz'});
    ctx.stats.resultItems += items;
    // 4. closing paragraph with today's date on the same line.
    let cb;
    if(closing >= 0){ cb = cloneBlock(closingBlock); }
    else {
      cb = {...cloneBlock(b), runs: textRuns(SCHEMA.defaultClosing, b)};
      ctx.changes.push({type: 'closing-added', before: '(kapanış yok)', after: SCHEMA.defaultClosing});
    }
    let after = closing >= 0 ? closing + 1 : itemsEnd;
    // Separate date line(s) directly after the closing move into the closing.
    while(after < seq.length){
      const t = textOf(seq[after]);
      if(!t){ if(after + 1 < seq.length && DATE_ONLY_RE.test(textOf(seq[after + 1]))){ after++; continue; } break; }
      if(DATE_ONLY_RE.test(t)){ ctx.dateLines.push(t); after++; continue; }
      break;
    }
    out.push(closingParagraph(cb, ctx));
    // 5. Tail (signature, notes) after the closing stays as source paragraphs.
    for(let k = after; k < seq.length; k++){ const c = seq[k].block; c.zone = 'result-tail'; out.push(c); }
    return zoneEnd - 1;
  }
  function closingParagraph(block, ctx){
    const cb = cloneBlock(block);
    delete cb.list; delete cb.numId; delete cb.ilvl;
    cb.role = 'result-closing';
    cb.alignment = 'justify'; cb.left = 0; cb.first = 0; cb.right = 0; cb.above = 0; cb.below = 0;
    cb.line = ctx.opts.lineSpacing; cb.tabStops = [];
    setAllRuns(cb, {bold: false, underline: false});
    if(ctx.opts.dateMode === 'keep'){ ctx.stats.closing = clean(flatten(cb)); return cb; }
    const full = flatten(cb);
    const old = TRAILING_DATE_RE.exec(full);
    if(old) cb.runs = trimRuns(sliceRuns(cb.runs, 0, old.index));
    else cb.runs = trimRuns(cb.runs);
    const today = todayTR(ctx.opts.now, ctx.opts.timeZone);
    const tailStyle = {...(cb.runs.at(-1) || originRun(block))};
    cb.runs.push(plainRun(` ${today}`, {...tailStyle, bold: false, italic: false, underline: false}));
    const before = clean(old ? old[0] : ctx.dateLines.join(' ')) || '(tarih yok)';
    ctx.changes.push({type: 'date', before, after: today});
    ctx.stats.date = today;
    ctx.stats.closing = clean(flatten(cb));
    return cb;
  }
  function attachmentsSection(blocks, i, field, end, ctx, out){
    const b = blocks[i];
    out.push(...fieldRows(stripColon(field.label), [], b, 'major-heading', ctx, {fieldKind: 'attachments'}));
    const seq = [];
    if(field.value){
      // "EKLER: 1- Karar 2- Çek" → separate entries.
      const value = flatten(b).slice(field.valueOffset);
      const parts = value.split(/\s+(?=(?:EK\s*[-–]?\s*)?\d{1,3}\s*[.)\-–]\s)/iu).map(clean).filter(Boolean);
      for(const p of parts) seq.push({...cloneBlock(b), runs: textRuns(p, b)});
    }
    let k = i + 1;
    for(; k < end; k++){
      const c = blocks[k], t = clean(flatten(c));
      if(c.kind !== 'paragraph' || c.source === 'table'){ seq.push(c); continue; }
      if(!t){ seq.push(null); continue; }
      if(isSignatureLike(t) && !LIST_PREFIX_RE.test(t)) break;
      if(t.length > 400 || isSectionLine(t)) break;
      seq.push(c);
    }
    let n = 0;
    for(const c of seq){
      if(c === null) continue; // blank line inside the attachment list
      if(c.kind !== 'paragraph' || c.source === 'table'){ out.push(c); continue; }
      out.push(makeListItem(c, SCHEMA.lists.attachments, 'attachment-item', ctx, SCHEMA.kunyeLine)); n++;
    }
    ctx.stats.attachments += n;
    for(; k < end; k++){ const c = blocks[k]; c.zone = 'attach-tail'; out.push(c); }
    return end - 1;
  }

  /* ------------------------------ roles ------------------------------ */
  const PRESET = new Set(['metadata', 'topic', 'case-number', 'field-label-line', 'major-heading', 'section-field', 'result-heading', 'result-item', 'result-closing', 'attachment-item', 'explanation-body']);
  function roleFor(block, index, z){
    if(block.kind !== 'paragraph') return 'other';
    if(PRESET.has(block.role)) return block.role;
    const text = clean(flatten(block));
    const styleHint = upper(block.sourceStyleName || '');
    if(isCourtHeading(text, index)) return 'court-heading';
    if(isPetitionTitle(text, index) || (/(?:^|\s)(?:TITLE|BAŞLIK|BASLIK)(?:\s|$)/u.test(styleHint) && (z.expl < 0 || index < z.expl) && index < 12)) return 'petition-title';
    if(block.zone === 'expl' && (isInternalHeading(text) || /(?:HEADING|BAŞLIK|BASLIK)\s*[1-9]?/u.test(styleHint))) return 'section-heading';
    if((block.zone === 'result-tail' || block.zone === 'attach-tail') && index <= z.lastClosing + 7 + z.attachmentsLen && isSignatureLike(text)) return 'signature';
    if(block.zone === 'expl') return text ? 'explanation-body' : 'body';
    return 'body';
  }
  function applyRole(block, role, ctx){
    const b = cloneBlock(block); b.role = role;
    const line = ctx.opts.lineSpacing;
    if(role === 'court-heading'){
      b.alignment = 'center'; b.first = 0; b.left = 0; b.right = 0; b.above = 0; b.below = 0; b.line = 1;
      setAllRuns(b, {bold: true, underline: false, size: SCHEMA.courtSize});
    } else if(role === 'petition-title'){
      b.alignment = 'center'; b.first = 0; b.left = 0; b.right = 0; b.above = 0; b.below = 6; b.line = 1;
      setAllRuns(b, {bold: true, underline: false, size: SCHEMA.titleSize});
    } else if(role === 'section-heading'){
      b.alignment = 'left'; b.first = 0; b.left = 0; b.line = line; b.tabStops = [];
      b.above = 0.15 * PT_PER_CM; b.below = 0.15 * PT_PER_CM;
      setAllRuns(b, {bold: true, underline: true, size: SCHEMA.bodySize});
    } else if(role === 'explanation-body'){
      b.line = line;
      setAllRuns(b, {size: SCHEMA.bodySize});
    } else if(role === 'signature'){
      b.alignment = 'right'; b.first = 0; b.left = 0; b.right = 0; b.above = 0; b.below = 0; b.line = 1;
      const t = flatten(b), cased = nameCaseTail(t, ctx.changes);
      if(cased !== t) b.runs = [plainRun(cased, originRun(b))];
      setAllRuns(b, {bold: true, size: SCHEMA.bodySize});
    } else if(role === 'body'){
      setAllRuns(b, {size: SCHEMA.bodySize});
    } else if(['result-item', 'attachment-item', 'result-closing'].includes(role)){
      setAllRuns(b, {size: SCHEMA.bodySize});
    }
    if(ctx.opts.font) setAllRuns(b, {font: ctx.opts.font});
    // Citation typography is a secondary, run-level concern; never on labels.
    const isLabel = r => r.underline === true && r.bold === true && ['metadata', 'topic', 'case-number', 'section-field', 'result-heading', 'major-heading', 'field-label-line'].includes(role);
    styleRegex(b, LAW_RE, {italic: true}, {skipRuns: isLabel});
    styleRegex(b, CASE_RE, {bold: true, italic: true}, {skipRuns: isLabel});
    delete b.zone;
    return b;
  }

  /* ------------------------------ manual overrides ------------------------------ */
  // The user can correct a detection mistake in the preview ("this is not a
  // signature", "this is a body paragraph"). Overrides only change layout and
  // emphasis of that paragraph, never its text. Keys are text-based so they
  // survive re-rendering when an unrelated setting changes.
  const OVERRIDES = Object.freeze({
    'signature': 'İmza (sağa, kalın)',
    'body': 'Gövde (iki yana, 1,25 cm girinti)',
    'plain': 'Düz paragraf (sola, girintisiz)',
    'heading': 'Ara başlık (kalın, altı çizili)',
    'center': 'Ortalı başlık (kalın)'
  });
  function blockKeys(blocks){
    const seen = new Map();
    return blocks.map(b => {
      if(b.kind !== 'paragraph') return null;
      const t = clean(flatten(b)).slice(0, 80);
      const n = (seen.get(t) || 0) + 1; seen.set(t, n);
      return `${n}|${t}`;
    });
  }
  function applyOverride(block, kind, ctx = {opts: {lineSpacing: SCHEMA.bodyLine}}){
    const b = cloneBlock(block);
    delete b.list; b.tabStops = [];
    const line = ctx.opts?.lineSpacing ?? SCHEMA.bodyLine;
    const strip = () => { if(b.listMarker){ b.runs = trimRuns(sliceRuns(b.runs, b.listMarker.length + 1)); delete b.listMarker; } };
    if(kind === 'signature'){ strip(); Object.assign(b, {alignment: 'right', left: 0, first: 0, right: 0, above: 0, below: 0, line: 1}); setAllRuns(b, {bold: true, underline: false}); }
    else if(kind === 'body'){ strip(); const R = NORMAL_RULES(); Object.assign(b, {alignment: 'justify', left: 0, right: 0, first: (R.explanationFirstCm ?? 1.25) * PT_PER_CM, above: (R.explanationParagraphCm ?? .15) * PT_PER_CM, below: (R.explanationParagraphCm ?? .15) * PT_PER_CM, line}); setAllRuns(b, {bold: false, underline: false}); }
    else if(kind === 'plain'){ strip(); Object.assign(b, {alignment: 'left', left: 0, first: 0, right: 0, above: 0, below: 0, line}); setAllRuns(b, {bold: false, underline: false}); }
    else if(kind === 'heading'){ strip(); Object.assign(b, {alignment: 'left', left: 0, first: 0, right: 0, above: .15 * PT_PER_CM, below: .15 * PT_PER_CM, line}); setAllRuns(b, {bold: true, underline: true}); }
    else if(kind === 'center'){ strip(); Object.assign(b, {alignment: 'center', left: 0, first: 0, right: 0, above: 0, below: 0, line: 1}); setAllRuns(b, {bold: true, underline: false}); }
    else return block;
    b.role = `override-${kind}`;
    return b;
  }
  function applyOverrides(blocks, overrides, opts = {}){
    const map = typeof overrides?.get === 'function' && typeof overrides.size === 'number' ? overrides : new Map(Object.entries(overrides || {}));
    if(!map.size) return {blocks, applied: 0};
    const keys = blockKeys(blocks); let applied = 0;
    const out = blocks.map((b, i) => { const k = keys[i] && map.get(keys[i]); if(!k || !OVERRIDES[k]) return b; applied++; return applyOverride(b, k, {opts}); });
    return {blocks: out, applied};
  }

  /* ------------------------------ integrity report ------------------------------ */
  function tokens(blocks){
    const map = new Map();
    for(const b of blocks || []){
      for(const t of flatten(b).toLocaleLowerCase('tr-TR').match(/[\p{L}\p{N}]+/gu) || []){
        if(/^\d{1,2}$/u.test(t) || t.length < 2) continue;
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return map;
  }
  function integrity(before, after){
    const a = tokens(before), b = tokens(after), removed = [], added = [];
    for(const [t, n] of a){ const m = b.get(t) || 0; if(m < n) removed.push(n - m > 1 ? `${t} ×${n - m}` : t); }
    for(const [t, n] of b){ const m = a.get(t) || 0; if(n > m) added.push(n - m > 1 ? `${t} ×${n - m}` : t); }
    return {removed, added};
  }

  /* ------------------------------ entry point ------------------------------ */
  function apply(input, options = {}){
    if(!Array.isArray(input)) throw new Error('Tipografi profili için paragraf dizisi bekleniyor.');
    const {enabled = true} = options;
    if(!enabled) return {blocks: input.map(cloneBlock), statistics: {enabled: false, roles: {}, metadataMerged: 0, changes: []}};
    const opts = {
      lineSpacing: Number.isFinite(options.lineSpacing) ? options.lineSpacing : (NORMAL_RULES().explanationLine ?? SCHEMA.bodyLine),
      dateMode: options.dateMode === 'keep' ? 'keep' : 'today',
      now: options.now ?? new Date(), timeZone: options.timeZone || SCHEMA.timeZone,
      markUets: options.markUets !== false, colonTabCm: options.colonTabCm,
      listMode: options.listMode === 'auto' ? 'auto' : 'text', splitRequests: !!options.splitRequests,
      font: options.font === null ? null : (options.font || SCHEMA.font)
    };
    const registry = parseUetsRegistry(options.uetsRegistry);
    // Own attorney profile first; explicit registry entries may override it.
    const own = options.ownAttorney === null ? null : (options.ownAttorney || SCHEMA.ownAttorney);
    const uets = new Map();
    if(own?.name && UETS_NUMBER_RE.test(own.uets || '')) uets.set(personKey(own.name), own.uets);
    for(const [k, v] of registry.map) uets.set(k, v);
    const ctx = {opts, uets, changes: [], dateLines: [], listCounters: {}, stats: {merged: 0, paired: 0, resultItems: 0, attachments: 0, splittable: 0}};
    const blocks = input.map(cloneBlock);
    const auto = globalThis.WordToUDFNormalize?.detection?.(blocks) || {start: -1, end: -1};
    const given = options.selection && Number.isInteger(options.selection.start);
    const sel = given ? options.selection : auto;
    let explStart = sel.start >= 0 && sel.start < blocks.length ? sel.start : -1;
    if(explStart < 0 && !given) explStart = blocks.findIndex(b => lineField(flatten(b))?.section?.kind === 'explanations');
    const firstSection = sectionStartIndex(blocks, 0, blocks.length);
    const limit = explStart >= 0 ? Math.min(explStart, firstSection) : Math.min(firstSection, blocks.length);
    const out = reflowKunye(blocks, limit, ctx);
    let zone = 'post';
    for(let i = limit; i < blocks.length; i++){
      const b = blocks[i];
      if(b.kind !== 'paragraph' || b.source === 'table'){ if(zone === 'expl') b.zone = 'expl'; out.push(b); continue; }
      const text = flatten(b);
      if(i === explStart){
        const f = lineField(text) || {label: stripColon(text.split(/[:：]/u)[0]) || 'AÇIKLAMALAR', value: '', valueOffset: text.length, section: {kind: 'explanations'}};
        if(f.section?.kind === 'explanations' || globalThis.WordToUDFNormalize?.isStart?.(b)){
          const label = f.section?.kind === 'explanations' ? f.label : stripColon(text);
          explanationHeading(b, {...f, label}, ctx, out);
        } else out.push(b);
        zone = 'expl'; continue;
      }
      const field = lineField(text);
      if(zone === 'expl'){
        const ends = sel.end >= 0 && explStart === sel.start ? i >= sel.end : !!field?.section && field.section.kind !== 'explanations';
        if(!ends){ b.zone = 'expl'; out.push(b); continue; }
        zone = 'post';
      }
      if(field?.section){
        const kind = field.section.kind;
        const end = explStart > i ? explStart : blocks.length;
        if(kind === 'result'){ i = resultSection(blocks, i, field, end, ctx, out); continue; }
        if(kind === 'attachments'){ i = attachmentsSection(blocks, i, field, end, ctx, out); continue; }
        if(kind === 'explanations'){ explanationHeading(b, field, ctx, out); zone = 'expl'; continue; }
        i = inlineSection(blocks, i, field, end, ctx, out); continue;
      }
      out.push(b);
    }
    const lastClosing = out.findIndex(b => b.role === 'result-closing');
    const z = {expl: out.findIndex(b => b.role === 'major-heading' && b.fieldKind === 'explanations'), lastClosing: lastClosing < 0 ? -99 : lastClosing,
      attachmentsLen: out.filter(b => b.role === 'attachment-item' || (b.role === 'major-heading' && b.fieldKind === 'attachments')).length};
    const roles = {};
    const result = out.map((b, i) => { const role = roleFor(b, i, z); roles[role] = (roles[role] || 0) + 1; return applyRole(b, role, ctx); });
    const check = integrity(input, result);
    const seen = new Set();
    const changes = ctx.changes.filter(c => { const k = `${c.type}|${c.before}|${c.after}`; if(seen.has(k)) return false; seen.add(k); return true; });
    return {blocks: result, statistics: {enabled: true, roles, metadataMerged: ctx.stats.merged, caseNumberPairs: ctx.stats.paired,
      resultItems: ctx.stats.resultItems, splittableRequests: ctx.opts.splitRequests ? 0 : ctx.stats.splittable, attachments: ctx.stats.attachments, date: ctx.stats.date, closing: ctx.stats.closing,
      colonTabPt: colonTabPt(opts), lineSpacing: opts.lineSpacing, changes, integrity: check,
      uetsRegistryErrors: registry.errors, zones: {expl: explStart, end: sel.end}}};
  }

  globalThis.WordToUDFLegalTypography = {apply, flatten, clean, upper, isCourtHeading, isPetitionTitle, isInternalHeading,
    parseField: lineField, nameCase, todayTR, parseUetsRegistry, personKey, requestCuts, OVERRIDES, blockKeys, applyOverride, applyOverrides, labelWidthPt, integrity, SCHEMA};
})();
