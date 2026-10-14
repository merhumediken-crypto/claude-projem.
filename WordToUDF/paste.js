/* Paste → petition (v1.6.0).
 *
 * The user copies a petition from anywhere and pastes it; no Word file is
 * needed. This module
 *   1. recognises WHERE the text was copied from (Word, Google Docs,
 *      LibreOffice, UYAP/Java editor, PDF, AI/Markdown, web page, WhatsApp,
 *      e-mail, plain text),
 *   2. turns the clipboard into the same paragraph/run model as docx.js —
 *      keeping bold/italic/underline/alignment from HTML, and repairing what
 *      each source breaks (PDF hard line breaks and page numbers, Markdown
 *      marks, chat/e-mail prefixes, Word list numbers and tab spans),
 *   3. analyses which petition parts exist and, with the user's answers for
 *      the missing ones, rebuilds the petition skeleton (court, künye, KONU,
 *      AÇIKLAMALAR, SONUÇ VE İSTEM, signature) before the normal pipeline.
 * Nothing is invented: missing facts come only from the form or settings.
 * Pasted HTML is parsed into an inert document and only read, never inserted.
 */
(() => {
  'use strict';
  const MAX_HTML = 4 * 1024 * 1024, MAX_TEXT = 2 * 1024 * 1024, MAX_PARAS = 12000;
  const FONT = 'Times New Roman';
  const clean = s => String(s ?? '').replace(/\s+/gu, ' ').trim();
  const flatten = b => (b?.runs || []).map(r => r.text || '').join('');
  const LT = () => globalThis.WordToUDFLegalTypography;
  const RULES = () => globalThis.WordToUDFLegalRules;

  const SOURCES = Object.freeze({
    word: 'Microsoft Word', gdocs: 'Google Dokümanlar', libre: 'LibreOffice / OpenOffice', uyap: 'UYAP Doküman Editörü (Java)',
    pdf: 'PDF', ai: 'Yapay zekâ / Markdown metni', web: 'Web sayfası', whatsapp: 'WhatsApp', mail: 'E-posta', plain: 'Düz metin'
  });

  /* ------------------------------ source detection ------------------------------ */
  const WA_RE = /^\[?\d{1,2}[./]\d{1,2}[./]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?\]?\s*(?:-\s*)?[^:\n]{1,40}:\s/u;
  const MAIL_HEADER_RE = /^(?:Kimden|Gönderen|From|Kime|To|Bilgi|Cc|Konu|Subject|Tarih|Date|Gönderildi|Sent)\s*:/iu;
  const MD_LINE_RE = /^(?:#{1,6}\s+\S|\s*[-*+]\s+\S|\s*\|.*\|\s*$|```)/u;
  const MD_INLINE_RE = /\*\*[^*\n]+\*\*|__[^_\n]+__/u;
  const SENTENCE_END_RE = /[.:;!?…)"”’»]$/u;
  const LOWER_START_RE = /^[a-zçğıöşüâîû(]/u;

  function hardWrapScore(lines){
    let joins = 0, long = 0, hyphens = 0;
    for(let i = 0; i + 1 < lines.length; i++){
      const a = lines[i].trim(), b = lines[i + 1].trim();
      if(a.length < 30 || !b) continue;
      long++;
      if(!SENTENCE_END_RE.test(a) && LOWER_START_RE.test(b)) joins++;
      if(/\p{Ll}-$/u.test(a) && LOWER_START_RE.test(b)) hyphens++;
    }
    return {joins, long, hyphens, ratio: long ? joins / long : 0};
  }
  function detect({html = '', text = ''} = {}){
    const h = String(html || ''), t = String(text || '');
    if(h && /<[a-z]/iu.test(h)){
      if(/urn:schemas-microsoft-com:office:word|mso-[a-z]|class="?Mso/iu.test(h)) return 'word';
      if(/docs-internal-guid/iu.test(h)) return 'gdocs';
      if(/content="?LibreOffice|OpenOffice/iu.test(h)) return 'libre';
      if(/<p style="margin-top: 0"/u.test(h)) return 'uyap';
      if(/class="[^"]*\b(?:markdown|prose)\b|data-message-author-role/iu.test(h)) return 'ai';
      return 'web';
    }
    const lines = t.replace(/\r\n?/gu, '\n').split('\n');
    const nonEmpty = lines.filter(l => l.trim());
    if(nonEmpty.filter(l => WA_RE.test(l)).length >= 2) return 'whatsapp';
    if(nonEmpty.filter(l => /^\s*>/u.test(l)).length >= 2 || nonEmpty.slice(0, 8).filter(l => MAIL_HEADER_RE.test(l)).length >= 2) return 'mail';
    if(nonEmpty.filter(l => MD_LINE_RE.test(l)).length >= 2 || nonEmpty.filter(l => MD_INLINE_RE.test(l)).length >= 2) return 'ai';
    const w = hardWrapScore(lines);
    if((w.joins >= 3 && w.ratio >= 0.3) || w.hyphens >= 2) return 'pdf';
    return 'plain';
  }

  /* ------------------------------ text → blocks ------------------------------ */
  const para = (runs, extra = {}) => ({kind: 'paragraph', runs: runs.map(r => ({font: FONT, size: 12, ...r})), ...extra});
  const textPara = text => para(text ? [{text}] : []);
  const PAGE_NO_RE = /^\s*(?:(?:sayfa|page|s\.)\s*)?\d{1,3}\s*(?:(?:\/|of|-)\s*\d{1,3})?\s*$|^\s*-\s*\d{1,3}\s*-\s*$/iu;
  const LABEL_LINE_RE = /^[A-ZÇĞİÖŞÜÂÎÛ][A-ZÇĞİÖŞÜÂÎÛ .]{1,45}(?:\t|\s)*[:：]/u;
  const LIST_START_RE = /^\s*(?:\d{1,3}\s*[.)-]|[a-zçğıöşü]\)|[-•*])\s/u;
  const isCaps = s => { const l = [...s].filter(c => /\p{L}/u.test(c)); return l.length >= 3 && l.every(c => c === c.toLocaleUpperCase('tr-TR')); };

  // "**Kalın** ve *italik*" → runs. Only used for AI/Markdown text.
  function markdownRuns(line){
    const runs = [], re = /(\*\*|__)(.+?)\1|(?<![*\w])\*(?!\s)([^*\n]+?)\*(?!\w)|(?<![\w_])_(?!\s)([^_\n]+?)_(?![\w])/gu;
    let last = 0, m;
    while((m = re.exec(line))){
      if(m.index > last) runs.push({text: line.slice(last, m.index)});
      if(m[2] !== undefined) runs.push({text: m[2], bold: true});
      else runs.push({text: m[3] ?? m[4], italic: true});
      last = m.index + m[0].length;
    }
    if(last < line.length) runs.push({text: line.slice(last)});
    return runs.filter(r => r.text);
  }

  function textToBlocks(text, source = 'plain'){
    const notes = [];
    let t = String(text || '');
    if(t.length > MAX_TEXT) throw new Error('Yapıştırılan metin 2 MB sınırını aşıyor.');
    t = t.replace(/\r\n?/gu, '\n').replace(/[​-‍⁠﻿]/gu, '').replace(/ /gu, ' ');
    let lines = t.split('\n');

    if(source === 'whatsapp'){
      let n = 0; lines = lines.map(l => { const m = WA_RE.exec(l); if(m){ n++; return l.slice(m[0].length); } return l; });
      if(n) notes.push(`${n} WhatsApp satırındaki tarih/saat ve gönderen öneki kaldırıldı.`);
    }
    if(source === 'mail'){
      let head = 0;
      while(head < lines.length && MAIL_HEADER_RE.test(lines[head])) head++;
      if(head >= 2){ lines = lines.slice(head); notes.push(`${head} e-posta başlık satırı (Kimden/Kime/Konu…) çıkarıldı.`); }
      let q = 0; lines = lines.map(l => { if(/^\s*>/u.test(l)){ q++; return l.replace(/^(?:\s*>)+\s?/u, ''); } return l; });
      if(q) notes.push(`${q} alıntı satırındaki ">" işareti kaldırıldı.`);
    }
    if(source === 'pdf'){
      const before = lines.length;
      lines = lines.filter(l => !PAGE_NO_RE.test(l));
      if(before !== lines.length) notes.push(`${before - lines.length} sayfa numarası satırı çıkarıldı.`);
      // Re-join lines the PDF broke inside a sentence.
      const out = []; let joined = 0, dehyph = 0;
      for(const raw of lines){
        const line = raw.replace(/[ \t]+$/u, '');
        const prev = out.length ? out[out.length - 1] : null;
        const cur = line.trim();
        if(prev && prev.trim() && cur && !SENTENCE_END_RE.test(prev.trim()) && !isCaps(prev.trim()) && !LABEL_LINE_RE.test(cur) && !LIST_START_RE.test(cur)
          && (LOWER_START_RE.test(cur) || /\p{Ll}-$/u.test(prev.trim()) || /,$/u.test(prev.trim()))){
          if(/\p{Ll}-$/u.test(prev.trim()) && LOWER_START_RE.test(cur)){ out[out.length - 1] = prev.trim().slice(0, -1) + cur; dehyph++; }
          else out[out.length - 1] = `${prev.trim()} ${cur}`;
          joined++;
          continue;
        }
        out.push(line);
      }
      lines = out;
      if(joined) notes.push(`PDF'nin cümle ortasında kırdığı ${joined} satır birleştirildi${dehyph ? ` (${dehyph} heceleme tiresi kaldırıldı)` : ''}.`);
    }

    const blocks = [];
    let mdMarks = 0, fence = false;
    for(const raw of lines){
      let line = raw.replace(/[ ]{2,}(?=\S)/gu, m => m.length >= 4 ? '\t' : ' ').replace(/[ \t]+$/u, '');
      if(source === 'ai'){
        if(/^\s*```/u.test(line)){ fence = !fence; mdMarks++; continue; }
        if(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/u.test(line)){ mdMarks++; continue; } // table rule
        const h = /^\s*#{1,6}\s+(.*)$/u.exec(line);
        if(h){ mdMarks++; blocks.push(para([{text: h[1].replace(/\*\*|__/gu, ''), bold: true}])); continue; }
        if(/^\s*\|.*\|\s*$/u.test(line)){ mdMarks++; line = line.trim().replace(/^\||\|$/gu, '').split('|').map(clean).join('\t'); }
        line = line.replace(/^\s*[*+]\s+/u, '- ');
        if(/^\s*>\s?/u.test(line)){ mdMarks++; line = line.replace(/^\s*>\s?/u, ''); }
        const runs = markdownRuns(line);
        if(runs.some(r => r.bold || r.italic)) mdMarks++;
        blocks.push(para(runs.length ? runs : []));
        continue;
      }
      blocks.push(textPara(line.trim() ? line.replace(/^\s+/u, '') : ''));
    }
    if(mdMarks) notes.push(`Markdown işaretleri (**, #, tablo çizgileri) temizlendi; kalın ve başlıklar korundu.`);
    return {blocks: collapseBlanks(blocks), notes};
  }

  // Blank lines in copied text only separate paragraphs; the petition
  // standard sets all spacing itself, so empty paragraphs are dropped.
  function collapseBlanks(blocks){
    const out = blocks.filter(b => clean(flatten(b)));
    if(out.length > MAX_PARAS) throw new Error(`Yapıştırılan metin ${out.length} paragraf; 12.000 paragraf sınırı aşıldı.`);
    return out;
  }

  /* ------------------------------ HTML → blocks ------------------------------ */
  const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TR', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'UL', 'OL', 'TABLE', 'TBODY', 'THEAD', 'TFOOT', 'DD', 'DT', 'DL', 'ADDRESS', 'CENTER', 'FIGURE', 'MAIN', 'NAV', 'ASIDE']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'LINK', 'TITLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'CANVAS', 'VIDEO', 'AUDIO']);
  const ALIGN = {left: 'left', start: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify'};
  function styleOf(el, inherited){
    const s = {...inherited};
    const tag = el.tagName;
    if(tag === 'B' || tag === 'STRONG' || /^H[1-6]$/u.test(tag) || tag === 'TH') s.bold = true;
    if(tag === 'I' || tag === 'EM' || tag === 'CITE') s.italic = true;
    if(tag === 'U' || tag === 'INS') s.underline = true;
    if(tag === 'S' || tag === 'STRIKE' || tag === 'DEL') s.strike = true;
    const css = el.getAttribute('style') || '';
    const get = name => { const m = new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*([^;]+)`, 'iu').exec(css); return m ? m[1].trim().toLowerCase() : null; };
    const fw = get('font-weight');
    if(fw) s.bold = /bold|bolder|[6-9]00/u.test(fw) ? true : /normal|lighter|[1-5]00/u.test(fw) ? false : s.bold;
    const fs = get('font-style'); if(fs) s.italic = /italic|oblique/u.test(fs);
    const td = get('text-decoration') || get('text-decoration-line');
    if(td){ if(/underline/u.test(td)) s.underline = true; else if(/none/u.test(td)) s.underline = false; if(/line-through/u.test(td)) s.strike = true; }
    const size = get('font-size');
    if(size){ const m = /^([\d.]+)\s*(pt|px)$/u.exec(size); if(m){ const pt = m[2] === 'px' ? Number(m[1]) * 0.75 : Number(m[1]); if(pt >= 6 && pt <= 72) s.size = Math.round(pt * 2) / 2; } }
    return s;
  }
  function alignOf(el, inherited){
    const css = el.getAttribute?.('style') || '';
    const m = /(?:^|;)\s*text-align\s*:\s*([a-z-]+)/iu.exec(css);
    const a = (m ? m[1] : el.getAttribute?.('align') || '').toLowerCase();
    return ALIGN[a] || (el.tagName === 'CENTER' ? 'center' : inherited);
  }

  function htmlToBlocks(html){
    if(typeof DOMParser === 'undefined') throw new Error('HTML ayrıştırıcı yok.');
    if(String(html).length > MAX_HTML) throw new Error('Yapıştırılan biçimli içerik 4 MB sınırını aşıyor.');
    // DOMParser builds an inert document: scripts do not run, nothing loads.
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    const notes = [], blocks = [];
    let cur = null, images = 0, tables = 0;
    const open = align => { if(!cur) cur = {runs: [], align}; };
    const flush = () => {
      if(!cur) return;
      const runs = [];
      for(const r of cur.runs){
        const last = runs[runs.length - 1];
        if(last && ['bold', 'italic', 'underline', 'strike', 'size'].every(k => last[k] === r[k])) last.text += r.text;
        else runs.push({...r});
      }
      // Trim outer white space (not tabs inside), collapse spaces.
      for(const r of runs) r.text = r.text.replace(/[  ]+/gu, ' ');
      if(runs.length){ runs[0].text = runs[0].text.replace(/^[ ]+/u, ''); runs[runs.length - 1].text = runs[runs.length - 1].text.replace(/[ \t]+$/u, ''); }
      const kept = runs.filter(r => r.text);
      blocks.push(kept.length ? para(kept.map(r => ({text: r.text, bold: !!r.bold, italic: !!r.italic, underline: !!r.underline, ...(r.strike ? {strike: true} : {}), ...(r.size ? {size: r.size} : {})})), cur.align ? {alignment: cur.align} : {}) : {kind: 'paragraph', runs: []});
      cur = null;
    };
    const text = (s, style, align, pre) => {
      if(!s) return;
      let v = pre ? s : s.replace(/[\r\n\f]+/gu, ' ').replace(/[  ]{2,}/gu, ' ');
      if(pre && v.includes('\n')){
        const parts = v.split(/\r?\n/u);
        parts.forEach((p, i) => { open(align); if(p) cur.runs.push({...style, text: p}); if(i < parts.length - 1) flush(); });
        return;
      }
      open(align); cur.runs.push({...style, text: v});
    };
    const walk = (node, style, align, pre, listCtx) => {
      for(const child of node.childNodes){
        if(child.nodeType === 3){ text(child.nodeValue, style, align, pre); continue; }
        if(child.nodeType !== 1) continue;
        const tag = child.tagName.toUpperCase();
        if(SKIP.has(tag)) continue;
        if(tag === 'IMG'){ images++; continue; }
        if(tag === 'BR'){ flush(); continue; }
        const css = child.getAttribute('style') || '';
        if(/mso-tab-count/iu.test(css)){ open(align); cur.runs.push({...style, text: '\t'}); continue; }
        if(/mso-list\s*:\s*ignore/iu.test(css)){ const n = clean(child.textContent); if(n){ open(align); cur.runs.push({...style, text: `${n} `}); } continue; }
        const st = styleOf(child, style);
        if(tag === 'TD' || tag === 'TH'){ walk(child, st, align, pre, listCtx); open(align); cur.runs.push({...st, text: '\t'}); continue; }
        if(BLOCK.has(tag)){
          flush();
          const al = alignOf(child, align);
          if(tag === 'TABLE') tables++;
          if(tag === 'OL' || tag === 'UL'){ walk(child, st, al, pre, {ordered: tag === 'OL', n: Number(child.getAttribute('start')) || 1}); flush(); continue; }
          if(tag === 'LI' && listCtx){ open(al); cur.runs.push({...st, bold: false, italic: false, underline: false, text: listCtx.ordered ? `${listCtx.n++}. ` : '- '}); }
          if(tag === 'TR'){
            walk(child, st, al, pre, listCtx);
            if(cur){ const last = cur.runs[cur.runs.length - 1]; if(last?.text === '\t') cur.runs.pop(); }
            flush(); continue;
          }
          walk(child, st, al, pre || tag === 'PRE', listCtx);
          flush();
          continue;
        }
        walk(child, st, alignOf(child, align), pre, listCtx);
      }
    };
    walk(doc.body || doc.documentElement, {}, undefined, false, null);
    flush();
    if(images) notes.push(`${images} görsel aktarılmadı (UDF'ye yalnız metin alınır).`);
    if(tables) notes.push(`${tables} tablo satırlarına çevrildi; hücreler sekmeyle ayrıldı.`);
    return {blocks: collapseBlanks(blocks), notes};
  }

  /* ------------------------------ entry ------------------------------ */
  function parse({html = '', text = ''} = {}){
    const source = detect({html, text});
    let res = null;
    if(html && ['word', 'gdocs', 'libre', 'uyap', 'web', 'ai'].includes(source) && /<[a-z]/iu.test(html)){
      try{ res = htmlToBlocks(html); }catch(err){ res = null; }
      // Some apps put only a wrapper in text/html; fall back to the plain text.
      if(res && !res.blocks.some(b => clean(flatten(b)))) res = null;
      // AI chats rendered as HTML may still carry raw Markdown marks.
      if(res && source === 'ai' && res.blocks.some(b => MD_INLINE_RE.test(flatten(b)))){
        const t = textToBlocks(res.blocks.map(flatten).join('\n'), 'ai'); res = {blocks: t.blocks, notes: [...res.notes, ...t.notes]};
      }
    }
    if(!res){
      const plainSource = ['word', 'gdocs', 'libre', 'uyap', 'web'].includes(source) ? detect({text}) : source;
      res = textToBlocks(text, plainSource === 'plain' && source !== 'plain' ? 'plain' : plainSource);
    }
    if(!res.blocks.some(b => clean(flatten(b)))) throw new Error('Yapıştırılan içerikte metin bulunamadı.');
    const paragraphs = res.blocks.filter(b => clean(flatten(b))).length;
    return {source, sourceLabel: SOURCES[source], blocks: res.blocks, notes: res.notes, paragraphs, characters: res.blocks.reduce((n, b) => n + flatten(b).length, 0)};
  }

  /* ------------------------------ analysis ------------------------------ */
  // Which petition parts does the pasted text already contain?
  function analyze(blocks){
    const L = LT(), R = RULES();
    const texts = blocks.map(b => clean(flatten(b)));
    const has = {court: false, caseNo: false, parties: 0, attorney: false, topic: false, explanations: false, result: false, signature: false};
    let courtIdx = -1, lastField = -1, firstSection = -1, courtCandidate = -1;
    texts.forEach((t, i) => {
      if(!t) return;
      if(courtIdx < 0 && i < 10 && L.isCourtHeading(t, i)){ courtIdx = i; has.court = true; return; }
      if(courtIdx < 0 && courtCandidate < 0 && i < 4 && t.length <= 150 && R.COURT_RE.test(t.toLocaleUpperCase('tr-TR').replace(/\s+/gu, ' ').trim())) courtCandidate = i;
      const f = L.parseField(t);
      if(f?.section){
        if(firstSection < 0) firstSection = i;
        if(f.section.kind === 'explanations') has.explanations = true;
        if(f.section.kind === 'result') has.result = true;
        return;
      }
      if(f?.rule && firstSection < 0){
        lastField = i;
        const k = f.rule.kind;
        if(k === 'case') has.caseNo = true;
        else if(k === 'party') has.parties++;
        else if(k === 'attorney') has.attorney = true;
        else if(k === 'topic') has.topic = true;
      }
    });
    const nonEmpty = texts.map((t, i) => t ? i : -1).filter(i => i >= 0);
    const tail = nonEmpty.slice(-4);
    has.signature = tail.some(i => /^(?:Av\.|Avukat)\s+\S/u.test(texts[i]) || /\b(?:Vekili|Vekilleri|Müdafii)$/u.test(texts[i]));
    // First body paragraph: after the court / title / künye, not a field.
    const startAt = Math.max(courtIdx, courtCandidate, lastField) + 1;
    let firstBody = -1;
    for(let i = startAt; i < texts.length; i++){
      const t = texts[i];
      if(!t) continue;
      if(L.parseField(t) || L.isPetitionTitle(t, i)) { if(L.parseField(t)?.section) break; continue; }
      firstBody = i; break;
    }
    // Last closing sentence ("… talep ederim.") → start of SONUÇ VE İSTEM.
    let closingIdx = -1;
    for(let i = nonEmpty.length - 1; i >= 0; i--){
      const t = texts[nonEmpty[i]].replace(/\s*\d{1,2}[./]\d{1,2}[./]\d{4}\s*$/u, '');
      if(R.CLOSING_TAIL_RE.test(t)){ closingIdx = nonEmpty[i]; break; }
    }
    let resultStart = closingIdx;
    if(closingIdx > 0){
      for(let j = nonEmpty.indexOf(closingIdx) - 1; j >= 0; j--){
        const t = texts[nonEmpty[j]];
        if(LIST_START_RE.test(t) || /^(?:yukarıda|yukarıdaki|açıklanan|arz ve izah|izah edilen|belirtilen)\b/iu.test(t)) resultStart = nonEmpty[j];
        else break;
      }
    }
    return {has, courtIdx, courtCandidate, lastField, firstSection, firstBody, closingIdx, resultStart};
  }

  /* ------------------------------ assemble ------------------------------ */
  // fill: {court, caseNo, role, client, otherRole, other, topic, addHeadings, addSignature}
  function assemble(blocks, fill = {}, settings){
    const T = globalThis.WordToUDFTemplates, S = globalThis.WordToUDFSettings;
    const a = analyze(blocks), added = [], keys = new Set();
    const out = blocks.map(b => ({...b, runs: (b.runs || []).map(r => ({...r}))}));
    const ins = (at, text, what, key) => { out.splice(at, 0, textPara(text)); added.push(what); keys.add(key); };
    const s = S ? S.sanitize(settings) : {ownAttorney: {name: ''}};
    const role = T?.ROLES?.includes(fill.role) ? fill.role : 'DAVALI';
    const otherRole = clean(fill.otherRole).toLocaleUpperCase('tr-TR') || T?.OPPOSITE?.[role] || 'KARŞI TARAF';
    // Work from the end so earlier indexes stay valid.
    if(!a.has.signature && fill.addSignature !== false && s.ownAttorney?.name){
      const lines = S.signatureLines(s, {sifat: T.roleWord(role), muvekkil: clean(fill.client), avukat: s.ownAttorney.name});
      for(const l of lines) out.push(textPara(l));
      if(lines.length){ added.push('imza bloğu'); keys.add('signature'); }
    }
    if(fill.addHeadings !== false){
      if(!a.has.result && a.resultStart > 0 && a.resultStart > a.firstBody) ins(a.resultStart, 'SONUÇ VE İSTEM', 'SONUÇ VE İSTEM başlığı', 'result');
      if(!a.has.explanations && a.firstBody >= 0 && (a.firstSection < 0 || a.firstBody < a.firstSection)) ins(a.firstBody, 'AÇIKLAMALAR', 'AÇIKLAMALAR başlığı', 'explanations');
    }
    const kunye = [];
    if(!a.has.caseNo && clean(fill.caseNo)) kunye.push([`DOSYA NO: ${T ? T.caseNumber(fill.caseNo) : clean(fill.caseNo)}`, 'dosya no', 'caseNo']);
    if(a.has.parties === 0 && clean(fill.client)) kunye.push([`${role}: ${clean(fill.client)}`, `${role.toLocaleLowerCase('tr-TR')} satırı`, 'client']);
    if(!a.has.attorney && s.ownAttorney?.name && (a.has.parties > 0 || clean(fill.client))) kunye.push([`VEKİLİ: ${s.ownAttorney.name}`, 'vekil satırı', 'attorney']);
    if(a.has.parties < 2 && clean(fill.other)) kunye.push([`${otherRole}: ${clean(fill.other)}`, `${otherRole.toLocaleLowerCase('tr-TR')} satırı`, 'other']);
    if(!a.has.topic && clean(fill.topic)) kunye.push([`KONU: ${clean(fill.topic)}`, 'KONU', 'topic']);
    if(kunye.length){
      const at = a.lastField >= 0 ? a.lastField + 1 : Math.max(a.courtIdx, a.courtCandidate) + 1;
      out.splice(at, 0, ...kunye.map(([t]) => textPara(t)));
      added.push(...kunye.map(([, w]) => w)); for(const [, , k] of kunye) keys.add(k);
    }
    if(!a.has.court){
      if(a.courtCandidate >= 0){
        // "Şanlıurfa 8. Asliye Hukuk Mahkemesine" typed in lower case.
        const t = clean(flatten(out[a.courtCandidate])).toLocaleUpperCase('tr-TR');
        out[a.courtCandidate] = textPara(t);
        added.push('mahkeme başlığı büyük harfe çevrildi'); keys.add('court');
      } else if(clean(fill.court)){
        out.unshift(textPara(T ? T.courtHeading(fill.court) : clean(fill.court).toLocaleUpperCase('tr-TR')));
        added.push('mahkeme başlığı'); keys.add('court');
      }
    }
    return {blocks: out, added, addedKeys: [...keys], analysis: a};
  }

  globalThis.WordToUDFPaste = {SOURCES, detect, parse, textToBlocks, htmlToBlocks, analyze, assemble, hardWrapScore};
})();
