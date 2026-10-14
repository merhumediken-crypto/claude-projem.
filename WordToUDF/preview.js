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
    for(const run of block.runs){
      const parts = run.text.split('\t');
      for(let i = 0; i < parts.length; i++){
        const span = document.createElement('span');
        span.textContent = parts[i];
        if(run.font) span.style.fontFamily = run.font;
        if(Number.isFinite(run.size)) span.style.fontSize = `${run.size}pt`;
        if(run.color) span.style.color = `#${run.color}`;
        if(run.bold !== undefined) span.style.fontWeight = run.bold ? '700' : '400';
        if(run.italic !== undefined) span.style.fontStyle = run.italic ? 'italic' : 'normal';
        const deco = []; if(run.underline) deco.push('underline'); if(run.strike) deco.push('line-through');
        if(run.underline === false || run.strike === false || deco.length) span.style.textDecoration = deco.length ? deco.join(' ') : 'none';
        if(parts[i]) p.append(span);
        if(i < parts.length - 1){
          const tab = document.createElement('span');
          tab.className = 'tab-stop' + (run.underline ? ' underlined' : '');
          tab.textContent = '\t';
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
  // Render blocks into the paper element; options: {margins, landscape, font, size}.
  function render(paper, blocks, {margins, landscape, font = 'Times New Roman', size = 12} = {}){
    paper.replaceChildren();
    paper.style.width = landscape ? '1123px' : '794px';
    paper.style.minHeight = landscape ? '794px' : '1123px';
    for(const side of ['top', 'right', 'bottom', 'left']) paper.style[`padding${side[0].toUpperCase() + side.slice(1)}`] = `${(margins?.[side] ?? 42.52) * 96 / 72}px`;
    paper.style.fontFamily = font; paper.style.fontSize = `${size}pt`;
    const frag = document.createDocumentFragment(), listState = new Map();
    blocks.forEach((block, i) => {
      if(block.kind === 'page-break'){ const line = document.createElement('div'); line.className = 'page-break'; line.setAttribute('aria-label', 'Sayfa sonu'); frag.append(line); }
      else { const p = makeParagraph(block, listState); p.dataset.index = String(i); frag.append(p); }
    });
    paper.append(frag);
    positionTabs(paper);
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
  globalThis.WordToUDFPreview = {render, fit, makeParagraph, positionTabs, listMarker};
})();
