/* A4 preview of the block model, shared by the converter and template pages.
 * The paper is always rendered light (real paper colours, also when the
 * phone/browser is in dark mode) and can be scaled to the screen width.
 */
(() => {
  'use strict';
  const alpha = n => { let out = ''; n = Math.max(1, Math.trunc(n)); while(n){ n--; out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26); } return out; };
  function listMarker(list, listState){
    if(!list) return null;
    const key = `${list.kind}:${list.id}`, level = Math.max(0, Math.min(8, list.level || 0));
    let counters = listState.get(key); if(!counters){ counters = []; listState.set(key, counters); }
    counters.length = Math.min(counters.length, level + 1);
    counters[level] = (counters[level] || 0) + 1;
    if(list.kind === 'bullet') return '•';
    return `${list.format === 'lowerLetter' ? alpha(counters[level]) : counters[level]}${list.suffix === ')' ? ')' : '.'}`;
  }
  function makeParagraph(block, listState = new Map()){
    const p = document.createElement('div'); p.className = 'paragraph' + (block.source === 'table' ? ' table-row' : ''); if(block.role) p.dataset.role = block.role;
    p.style.textAlign = block.alignment === 'justify' ? 'justify' : (block.alignment || 'left');
    if(block.tabStops?.length) p.dataset.tabStops = JSON.stringify(block.tabStops);
    p.style.marginTop = `${Math.max(0, block.above || 0) / .75}px`;
    p.style.marginBottom = `${Math.max(0, block.below || 0) / .75}px`;
    if(Number.isFinite(block.first)) p.style.textIndent = `${block.first / .75}px`;
    if(Number.isFinite(block.left)) p.style.paddingLeft = `${Math.max(0, block.left) / .75}px`;
    if(Number.isFinite(block.right)) p.style.paddingRight = `${Math.max(0, block.right) / .75}px`;
    if(Number.isFinite(block.line)) p.style.lineHeight = String(block.line);
    const marker = listMarker(block.list, listState);
    if(marker !== null){
      // Real list number (not document text): drawn in the hanging column.
      const m = document.createElement('span'); m.className = 'list-marker'; m.textContent = marker; m.setAttribute('aria-hidden', 'true');
      m.style.width = `${Math.max(0, -(block.first || 0)) / .75}px`; p.append(m); p.dataset.list = `${block.list.id}`;
    }
    // data-o: offset of each piece in the paragraph's flattened text, so a
    // selection in the preview maps back to exact characters (editor-ui.js).
    let off = 0;
    for(const run of block.runs){
      const parts = run.text.split('\t');
      for(let i = 0; i < parts.length; i++){
        const span = document.createElement('span');
        span.textContent = parts[i];
        span.dataset.o = String(off); off += parts[i].length;
        if(run.font) span.style.fontFamily = run.font;
        if(Number.isFinite(run.size)) span.style.fontSize = `${run.size}pt`;
        if(run.color) span.style.color = `#${run.color}`;
        if(run.highlight === true) span.style.backgroundColor = '#fff176';
        if(run.bold !== undefined) span.style.fontWeight = run.bold ? '700' : '400';
        if(run.italic !== undefined) span.style.fontStyle = run.italic ? 'italic' : 'normal';
        const deco = []; if(run.underline) deco.push('underline'); if(run.strike) deco.push('line-through');
        if(run.underline === false || run.strike === false || deco.length) span.style.textDecoration = deco.length ? deco.join(' ') : 'none';
        if(parts[i]) p.append(span);
        if(i < parts.length - 1){
          const tab = document.createElement('span');
          tab.className = 'tab-stop' + (run.underline ? ' underlined' : '');
          tab.textContent = '\t';
          tab.dataset.o = String(off); off += 1;
          if(run.color) tab.style.color = `#${run.color}`;
          p.append(tab);
        }
      }
    }
    return p;
  }
  function positionTabs(paper){
    for(const p of paper.querySelectorAll('.paragraph[data-tab-stops]')){
      const tabs = JSON.parse(p.dataset.tabStops || '[]');
      // Tab positions are measured from the paragraph box (page margin), as in
      // Word, so a hanging list number "1.<TAB>" lands on the indent. Widths
      // are computed in unscaled CSS pixels (the paper may be transformed).
      const scale = p.getBoundingClientRect().width / (p.offsetWidth || 1) || 1;
      const rowLeft = p.getBoundingClientRect().left;
      for(const tab of p.querySelectorAll('.tab-stop')){
        const x = (tab.getBoundingClientRect().left - rowLeft) / scale;
        const target = tabs.find(t => t.pos * (96 / 72) > x + 1);
        const width = target ? target.pos * (96 / 72) - x : 24;
        tab.style.width = `${Math.max(4, Math.min(2500, width))}px`;
        tab.textContent = '';
      }
    }
  }
  // Approximate A4 pages (v1.10): dashed guides where a page would end, the
  // page count, and whether the signature block starts a page on its own.
  // Chrome's text layout is not UYAP's, so everything here is "≈".
  const NOT_CONTENT = new Set(['signature', 'edit-signature', 'attachment-item', 'inserted-blank']);
  function paginate(paper, {margins, landscape} = {}){
    for(const g of paper.querySelectorAll('.page-guide')) g.remove();
    const pageH = landscape ? 794 : 1123;
    const top = (margins?.top ?? 42.52) * 96 / 72, bottom = (margins?.bottom ?? 42.52) * 96 / 72;
    const contentH = pageH - top - bottom;
    if(contentH < 100) return {pages: 1, signatureAlone: false};
    let pageStart = top, page = 1;
    const spans = [], guides = [];
    for(const el of [...paper.children]){
      if(el.classList.contains('page-break')){ page++; pageStart = el.offsetTop + el.offsetHeight; guides.push({y: el.offsetTop + el.offsetHeight / 2, page, hard: true}); continue; }
      const y0 = el.offsetTop, y1 = y0 + el.offsetHeight, first = y0 >= pageStart + contentH ? page + 1 : page;
      while(y1 > pageStart + contentH + 1){ pageStart += contentH; page++; guides.push({y: pageStart, page}); }
      spans.push({el, first, last: page});
    }
    for(const g of guides){
      const d = document.createElement('div'); d.className = 'page-guide' + (g.hard ? ' hard' : ''); d.dataset.label = `≈ ${g.page}. sayfa`; d.setAttribute('aria-hidden', 'true');
      d.style.top = `${g.y}px`; paper.append(d);
    }
    paper.style.minHeight = `${Math.max(pageH, pageStart + contentH + bottom)}px`;
    // Signature alone: its first page holds no petition text of its own.
    const sig = spans.filter(x => NOT_CONTENT.has(x.el.dataset.role) && /signature/u.test(x.el.dataset.role));
    const sigPage = sig.length ? Math.min(...sig.map(x => x.first)) : 0;
    const content = x => x.el.textContent.trim() && !NOT_CONTENT.has(x.el.dataset.role) && !/^EKLER\b/u.test(x.el.textContent.trim());
    const signatureAlone = sigPage > 1 && !spans.some(x => content(x) && x.last >= sigPage);
    return {pages: page, signatureAlone};
  }

  // "Değişiklikleri göster" (v1.10): words of the output that are not in the
  // source (same spelling) are marked; paragraphs the automatic rules changed
  // carry the list of changes as a tooltip. Works on the rendered DOM only.
  const TOKEN_RE = /\d{1,2}\.\d{1,2}\.\d{4}|[\p{L}\p{N}]+/gu;
  function markChanges(paper, sourceBlocks, notes = []){
    const pool = new Map();
    for(const b of sourceBlocks || []) for(const t of (b.runs || []).map(r => r.text || '').join('').match(TOKEN_RE) || []) pool.set(t, (pool.get(t) || 0) + 1);
    let marked = 0;
    for(const p of paper.querySelectorAll('.paragraph')){
      const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT, {acceptNode: n => n.parentElement.closest('.list-marker') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT});
      const nodes = []; let n; while((n = walk.nextNode())) nodes.push(n);
      for(const node of nodes){
        const text = node.data, hits = [];
        for(const m of text.matchAll(TOKEN_RE)){
          if(/^\d{1,2}$/u.test(m[0])) continue;                 // list numbers, day numbers
          const c = pool.get(m[0]) || 0; if(c > 0) pool.set(m[0], c - 1); else hits.push(m);
        }
        if(!hits.length) continue;
        const frag = document.createDocumentFragment(); let at = 0;
        for(const m of hits){
          if(m.index > at) frag.append(text.slice(at, m.index));
          const mk = document.createElement('mark'); mk.className = 'chg'; mk.textContent = m[0]; frag.append(mk); at = m.index + m[0].length; marked++;
        }
        if(at < text.length) frag.append(text.slice(at));
        node.replaceWith(frag);
      }
      // Tooltips: the recorded changes whose new text is in this paragraph.
      const own = notes.filter(x => x.after && x.after.length >= 3 && p.textContent.includes(x.after)).map(x => x.text);
      if(own.length){ p.classList.add('has-chg'); p.title = own.slice(0, 8).join('\n'); }
    }
    return marked;
  }

  // Render blocks into the paper element; options: {margins, landscape, font, size, guides}.
  // Returns the page estimate: {pages, signatureAlone}.
  function render(paper, blocks, {margins, landscape, font = 'Times New Roman', size = 12, guides = true} = {}){
    paper.replaceChildren();
    paper.style.width = landscape ? '1123px' : '794px';
    paper.style.minHeight = landscape ? '794px' : '1123px';
    for(const side of ['top', 'right', 'bottom', 'left']) paper.style[`padding${side[0].toUpperCase() + side.slice(1)}`] = `${(margins?.[side] ?? 42.52) * 96 / 72}px`;
    paper.style.fontFamily = font; paper.style.fontSize = `${size}pt`;
    const frag = document.createDocumentFragment(), listState = new Map();
    blocks.forEach((block, i) => {
      if(block.kind === 'page-break'){ const line = document.createElement('div'); line.className = 'page-break' + (block.inserted ? ' inserted' : ''); line.setAttribute('aria-label', 'Sayfa sonu'); frag.append(line); }
      else {
        const p = makeParagraph(block, listState); p.dataset.index = String(i);
        if(block.editKey) p.dataset.key = block.editKey;
        if(block.edited) p.classList.add('edited');
        if(block.added) p.classList.add('added');
        if(block.inserted) p.classList.add('inserted');
        frag.append(p);
      }
    });
    paper.append(frag);
    positionTabs(paper);
    return guides ? paginate(paper, {margins, landscape}) : {pages: 0, signatureAlone: false};
  }
  // Scale the paper to the viewport width (phones). The wrapper gets the
  // scaled height so the page scrolls normally.
  function fit(viewport, wrapper, paper, enabled = true){
    paper.style.transform = ''; wrapper.style.height = ''; wrapper.style.width = '';
    // "Gerçek boyut" must scroll sideways on a phone; "Sığdır" never needs to.
    viewport.classList.toggle('fit', !!enabled);
    if(!enabled) return 1;
    const style = getComputedStyle(viewport);
    const avail = viewport.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
    const w = paper.offsetWidth;
    const scale = w > 0 && avail > 0 ? Math.min(1, avail / w) : 1;
    if(scale < 1){
      paper.style.transform = `scale(${scale})`; paper.style.transformOrigin = 'top left';
      wrapper.style.width = `${w * scale}px`; wrapper.style.height = `${paper.offsetHeight * scale}px`;
    }
    return scale;
  }
  globalThis.WordToUDFPreview = {render, fit, makeParagraph, positionTabs, listMarker, paginate, markChanges};
})();
