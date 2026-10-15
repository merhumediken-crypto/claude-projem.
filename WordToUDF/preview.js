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
  // Times New Roman is not installed on most phones: the bundled Tinos (same
  // metrics, workspace.css) keeps the line breaks and tab stops of UYAP.
  const family = f => /^\s*(?:"?times new roman"?|times)\s*$/iu.test(f || '') ? '"Times New Roman", Tinos, Times, serif' : f;
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
        if(run.font) span.style.fontFamily = family(run.font);
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
    paper.style.fontFamily = family(font); paper.style.fontSize = `${size}pt`;
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
  // A web font that arrives after the first render changes text widths only:
  // the tab stops and page guides are measured again on the same paragraphs,
  // so a text selection, the edit panel and the marks stay as they are.
  function relayout(paper, {margins, landscape, guides = true} = {}){
    positionTabs(paper);
    return guides ? paginate(paper, {margins, landscape}) : {pages: 0, signatureAlone: false};
  }
  // Scale the paper to the viewport width, or to a fixed zoom (0.3–2) when
  // fitting is off. The wrapper gets the scaled size so the page scrolls
  // normally. crop (phones): fit the text column instead of the whole sheet —
  // the empty page margins are cut off, so the text is about 15 % larger and
  // the line breaks stay exactly those of the A4 page.
  const KEEP = 14; // px of margin left visible on each side when cropping
  function fit(viewport, wrapper, paper, enabled = true, zoom = 1, {crop = false} = {}){
    paper.style.transform = ''; wrapper.style.height = ''; wrapper.style.width = '';
    wrapper.classList.remove('cropped'); paper.classList.remove('cropped'); paper.style.removeProperty('--crop-r');
    // "Gerçek boyut" must scroll sideways on a phone; "Sığdır" never needs to.
    viewport.classList.toggle('fit', !!enabled);
    const w = paper.offsetWidth;
    if(!(w > 0)) return 1;
    let scale, shift = 0, shown = w;
    if(enabled){
      const style = getComputedStyle(viewport);
      const avail = viewport.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
      const ps = getComputedStyle(paper), pl = parseFloat(ps.paddingLeft) || 0, pr = parseFloat(ps.paddingRight) || 0;
      // Cropping only pays off when the whole sheet would be shrunk.
      if(crop && avail > 0 && avail < w && pl > KEEP && pr > KEEP){
        shown = w - (pl - KEEP) - (pr - KEEP);
        scale = Math.min(1, avail / shown); shift = (pl - KEEP) * scale;
        wrapper.classList.add('cropped'); paper.classList.add('cropped');
        paper.style.setProperty('--crop-r', `${pr - KEEP}px`);
      } else scale = avail > 0 ? Math.min(1, avail / w) : 1;
    } else scale = Number.isFinite(zoom) ? Math.min(2, Math.max(.3, zoom)) : 1;
    if(scale !== 1 || shift){
      paper.style.transform = `${shift ? `translateX(${-shift}px) ` : ''}scale(${scale})`; paper.style.transformOrigin = 'top left';
      wrapper.style.width = `${shown * scale}px`; wrapper.style.height = `${paper.offsetHeight * scale}px`;
    }
    return scale;
  }
  globalThis.WordToUDFPreview = {render, relayout, fit, makeParagraph, positionTabs, listMarker, paginate, markChanges};
})();
