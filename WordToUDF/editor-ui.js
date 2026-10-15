/* Paragraph editor UI shared by the converter and the template page.
 *
 *  - Tap a paragraph → edit panel (bottom sheet on phones, side panel on
 *    desktop). Ctrl/Shift-click or "Çoklu seçim" selects several paragraphs.
 *  - Select words or a sentence in the preview → a small format bar
 *    (bold / italic / underline / strike, plain, whole sentence, everywhere).
 *    Ctrl+B / Ctrl+I / Ctrl+U work on that selection. In the panel the
 *    paragraph's sentences are buttons (phones), and a word selected in the
 *    panel's text box can be formatted too.
 *  - Every change is applied immediately to the preview, can be undone
 *    ("Geri al", Ctrl+Z) and redone ("Yinele", Ctrl+Y / Ctrl+Shift+Z) and is
 *    listed in the report.
 *  - All user text is written with textContent / value, never as HTML.
 */
(() => {
  'use strict';
  const E = () => globalThis.WordToUDFEdits;
  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for(const [k, v] of Object.entries(props)){
      if(k === 'class') n.className = v;
      else if(k === 'text') n.textContent = v;
      else if(k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if(k === 'dataset') Object.assign(n.dataset, v);
      else if(v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...kids.filter(x => x !== null && x !== undefined && x !== false));
    return n;
  };
  const fmt = n => String(n).replace('.', ',');
  const clip = (s, n = 40) => { const t = String(s).replace(/\s+/gu, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
  const newId = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');
  // What the automatic rules decided, shown on the "Otomatik" chip.
  const DETECTED = {'court-heading': 'mahkeme başlığı', 'petition-title': 'dilekçe başlığı', metadata: 'künye satırı', topic: 'künye satırı', 'case-number': 'künye satırı',
    'field-label-line': 'künye satırı', 'major-heading': 'bölüm başlığı', 'section-field': 'bölüm satırı', 'result-heading': 'SONUÇ başlığı', 'section-heading': 'ara başlık',
    'explanation-body': 'gövde paragrafı', body: 'düz paragraf', 'result-item': 'talep maddesi', 'attachment-item': 'ek maddesi', 'result-closing': 'kapanış cümlesi', signature: 'imza satırı'};
  const detected = role => DETECTED[role] || (String(role).startsWith('edit-') ? E().ROLES[role.slice(5)]?.toLocaleLowerCase('tr-TR') : '');
  // Format buttons: [style, label on the button, accessible name, shortcut letter]
  const STYLE_BTNS = [['bold', 'K', 'Kalın', 'B'], ['italic', 'İ', 'İtalik', 'I'], ['underline', 'A', 'Altı çizili', 'U'], ['strike', 'S', 'Üstü çizili', ''], ['highlight', 'V', 'Vurgu (deneysel)', '']];
  // Styles shown only when the page enables them (experimental UDF features).
  const OPTIONAL = new Set(['highlight']);

  function attach({paper, toolbar, getBlocks, onChange, onMessage = () => {}, enabled = () => true, extraStyles = () => []}){
    const shown = k => !OPTIONAL.has(k) || extraStyles().includes(k);
    const edits = new Map();          // key → edit object ('*doc' → whole-document rules)
    const history = [], future = [];  // snapshots for undo / redo
    const selected = new Set();       // keys
    const DOC = E().DOC_KEY;
    let multi = false, sheet = null, sentSel = new Set(), sentFor = null, addOpen = false;
    // Text typed in the panel but not applied yet survives the panel's rebuilds.
    let textDraft = null; // {key, base, value}

    /* ---------- toolbar ---------- */
    const multiBtn = el('button', {type: 'button', class: 'secondary tool-btn', 'aria-pressed': 'false', text: 'Çoklu seçim', title: 'Birden çok paragrafı seçip birlikte düzenleyin (masaüstünde Ctrl/Shift + tıklama da olur)'});
    const undoBtn = el('button', {type: 'button', class: 'secondary tool-btn', text: 'Geri al', disabled: true, title: 'Son düzenlemeyi geri al (Ctrl+Z)'});
    const redoBtn = el('button', {type: 'button', class: 'secondary tool-btn', text: 'Yinele', disabled: true, title: 'Geri alınan düzenlemeyi yeniden uygula (Ctrl+Y)'});
    const resetBtn = el('button', {type: 'button', class: 'secondary tool-btn', text: 'Düzenlemeleri sıfırla', disabled: true});
    const findBtn = el('button', {type: 'button', class: 'secondary tool-btn', 'aria-pressed': 'false', 'aria-expanded': 'false', text: 'Bul / değiştir', title: 'Belgede ara; hepsini değiştir ya da kalın / italik / altı çizili yap (Ctrl+F)'});
    const bar = el('div', {class: 'select-bar', hidden: true},
      el('span', {class: 'select-count'}),
      el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Seçilenleri düzenle', onclick: () => openSheet()}),
      el('button', {type: 'button', class: 'secondary tool-btn', text: 'Seçimi temizle', onclick: () => { selected.clear(); decorate(); }}));
    toolbar.prepend(multiBtn, undoBtn, redoBtn, findBtn, resetBtn);
    toolbar.after(bar);
    const findBox = buildFindBox();
    bar.after(findBox);
    multiBtn.addEventListener('click', () => {
      multi = !multi; multiBtn.setAttribute('aria-pressed', String(multi)); multiBtn.classList.toggle('on', multi);
      if(!multi) selected.clear();
      decorate();
      onMessage(multi ? 'Çoklu seçim açık: düzenlemek istediğiniz paragraflara dokunun, sonra "Seçilenleri düzenle".' : 'Çoklu seçim kapandı.');
    });
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    resetBtn.addEventListener('click', () => {
      if(!edits.size) return;
      snapshot(); edits.clear(); selected.clear(); closeSheet(); changed('Bütün elle düzenlemeler kaldırıldı. Geri almak için "Geri al".');
    });

    const dump = () => JSON.stringify([...edits]);
    const load = s => { edits.clear(); for(const [k, v] of JSON.parse(s)) edits.set(k, v); };
    function snapshot(){ history.push(dump()); if(history.length > 100) history.shift(); future.length = 0; }
    function undo(){
      if(!history.length) return;
      future.push(dump()); load(history.pop());
      changed('Son düzenleme geri alındı.');
      refreshSheet();
    }
    function redo(){
      if(!future.length) return;
      history.push(dump()); load(future.pop());
      changed('Düzenleme yeniden uygulandı.');
      refreshSheet();
    }
    function changed(msg){
      onChange();
      decorate();
      if(msg) onMessage(msg);
    }
    function decorate(){
      // Nothing to edit yet: keep the toolbar out of the way.
      const on = enabled();
      for(const b of [multiBtn, undoBtn, redoBtn, findBtn, resetBtn]) b.hidden = !on;
      if(!on && !findBox.hidden) toggleFind(false);
      if(!findBox.hidden) updateFind();
      undoBtn.disabled = !history.length;
      redoBtn.disabled = !future.length;
      resetBtn.disabled = !edits.size;
      resetBtn.textContent = edits.size ? `Düzenlemeleri sıfırla (${edits.size})` : 'Düzenlemeleri sıfırla';
      for(const p of paper.querySelectorAll('.paragraph[data-key]')){
        p.classList.toggle('selected', selected.has(p.dataset.key));
        // Keyboard: Tab reaches each paragraph, Enter / Space opens its panel.
        if(on){ p.tabIndex = 0; p.setAttribute('aria-keyshortcuts', 'Enter'); } else { p.removeAttribute('tabindex'); p.removeAttribute('aria-keyshortcuts'); }
      }
      bar.hidden = !on || !(multi || selected.size > 1);
      bar.querySelector('.select-count').textContent = selected.size ? `${selected.size} paragraf seçili` : 'Paragraf seçin';
      bar.querySelector('.primary-btn').disabled = !selected.size;
      if(!on) hidePop();
    }

    /* ---------- edits ---------- */
    const keys = () => [...selected];
    function blockFor(key){ return (getBlocks() || []).find(b => b.editKey === key); }
    function update(patch, msg){
      if(!selected.size) return;
      snapshot();
      for(const k of keys()){
        const next = E().sanitize({...(edits.get(k) || {}), ...patch});
        for(const [f, v] of Object.entries(patch)) if(v === null) delete next[f];
        if(Object.keys(next).length) edits.set(k, next); else edits.delete(k);
      }
      changed(msg);
      // A removed paragraph cannot stay selected.
      for(const k of keys()) if(!blockFor(k)) selected.delete(k);
      if(!selected.size){ closeSheet(); return; }
      refreshSheet();
    }

    /* ---------- word / sentence marks ---------- */
    const styleName = (patch) => E().describeStyle(patch);
    // Format [start, end) of the paragraph body; style k toggles, or a full patch.
    function addMark(key, start, end, k, {all = false, patch} = {}){
      const b = blockFor(key); if(!b) return false;
      const body = E().bodyText(b);
      while(start < end && /\s/u.test(body[start])) start++;
      while(end > start && /\s/u.test(body[end - 1])) end--;
      const text = body.slice(start, end);
      if(!text.trim()){ onMessage('Önce biçimlendirilecek sözcüğü ya da cümleyi seçin.'); return false; }
      const p = patch || {[k]: !E().rangeHas(b, start, end, k)};
      snapshot();
      if(all){
        const d = E().sanitizeDoc(edits.get(DOC));
        // A selection on word boundaries formats that word only, never the
        // same letters inside other words ("Ali" not in "talimat").
        const W = /[\p{L}\p{N}]/u;
        const ww = !W.test(body[start - 1] || '') && !W.test(body[end] || '') && W.test(text[0]) && W.test(text.at(-1));
        const prev = (d.marks || []).find(m => m.text === text && !!m.wholeWord === ww && !m.caseSensitive);
        const marks = (d.marks || []).filter(m => m !== prev);
        marks.push({...(prev || {}), text, ...(ww ? {wholeWord: true} : {}), ...p});
        edits.set(DOC, E().sanitizeDoc({...d, marks}));
        changed(`Belgedeki her “${clip(text)}” ${styleName(p)} yapıldı.`);
      } else {
        const e = edits.get(key) || {};
        const prev = (e.marks || []).find(m => m.text === text && m.at === start);
        const marks = (e.marks || []).filter(m => m !== prev);
        marks.push({...(prev || {}), text, at: start, ...p});
        edits.set(key, E().sanitize({...e, marks}));
        changed(`“${clip(text)}” ${styleName(p)} yapıldı.`);
      }
      return true;
    }
    function removeMark(key, index){
      const e = edits.get(key); if(!e?.marks?.[index]) return;
      snapshot();
      const marks = e.marks.filter((_, i) => i !== index);
      const next = E().sanitize({...e, marks});
      if(!marks.length) delete next.marks;
      if(Object.keys(next).length) edits.set(key, next); else edits.delete(key);
      changed('Biçim kaldırıldı.');
      refreshSheet();
    }

    // Preview selection ↔ paragraph offsets (spans carry data-o, see preview.js).
    function offsetIn(p, node, offset){
      const spans = [...p.querySelectorAll('[data-o]')];
      const r = document.createRange();
      for(const sp of spans){
        r.setStart(sp, 0); r.setEnd(sp, 0);
        if(r.comparePoint(node, offset) < 0) return +sp.dataset.o;
        if(sp === node || sp.contains(node)){
          if(sp.classList.contains('tab-stop')) return +sp.dataset.o + (offset > 0 ? 1 : 0);
          const q = document.createRange(); q.setStart(sp, 0); q.setEnd(node, offset);
          return +sp.dataset.o + q.toString().length;
        }
      }
      const last = spans.at(-1);
      return last ? +last.dataset.o + (last.classList.contains('tab-stop') ? 1 : last.textContent.length) : 0;
    }
    function domPoint(p, flat){
      for(const sp of p.querySelectorAll('[data-o]')){
        const o = +sp.dataset.o;
        if(sp.classList.contains('tab-stop')){
          if(flat === o) return {node: sp.parentNode, offset: [...sp.parentNode.childNodes].indexOf(sp)};
          continue;
        }
        const len = sp.textContent.length;
        if(flat >= o && flat <= o + len){
          const walk = document.createTreeWalker(sp, NodeFilter.SHOW_TEXT);
          let left = flat - o, t;
          while((t = walk.nextNode())){ if(left <= t.length) return {node: t, offset: left}; left -= t.length; }
          return {node: sp, offset: sp.childNodes.length};
        }
      }
      return {node: p, offset: p.childNodes.length};
    }
    function readSelection(){
      const sel = window.getSelection?.();
      if(!sel || sel.isCollapsed || !sel.rangeCount) return null;
      const range = sel.getRangeAt(0);
      const para = n => (n.nodeType === 1 ? n : n.parentElement)?.closest?.('.paragraph[data-key]');
      const p = para(range.startContainer);
      if(!p || !paper.contains(p)) return null;
      const key = p.dataset.key, b = blockFor(key); if(!b) return null;
      const base = E().markerLength(b), body = E().bodyText(b);
      let start = Math.max(0, offsetIn(p, range.startContainer, range.startOffset) - base);
      let end;
      if(p === para(range.endContainer)) end = Math.min(body.length, offsetIn(p, range.endContainer, range.endOffset) - base);
      else{
        // A triple click selects the paragraph up to the start of the next one: clamp to this paragraph's end.
        const r2 = document.createRange(); r2.selectNodeContents(p); r2.collapse(false);
        const tail = document.createRange(); tail.setStart(r2.endContainer, r2.endOffset); tail.setEnd(range.endContainer, range.endOffset);
        if(tail.toString().replace(/\s/gu, '')) return null;
        end = body.length;
      }
      while(start < end && /\s/u.test(body[start])) start++;
      while(end > start && /\s/u.test(body[end - 1])) end--;
      return end > start ? {key, start, end, text: body.slice(start, end)} : null;
    }
    function selectRange(key, start, end){
      const p = paper.querySelector(`.paragraph[data-key="${CSS.escape(key)}"]`), b = blockFor(key);
      if(!p || !b) return;
      const base = E().markerLength(b), a = domPoint(p, base + start), z = domPoint(p, base + end);
      const r = document.createRange(); r.setStart(a.node, a.offset); r.setEnd(z.node, z.offset);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }

    // The format bar for a preview selection.
    // lastSel: on phones a tap on the bar can clear the text selection just
    // before the click arrives; the last valid selection is used for a moment.
    let popSel = null, popAll = false, lastSel = null;
    const current = () => popSel || (lastSel && performance.now() - lastSel.t < 1500 ? lastSel.s : null);
    const pop = el('div', {class: 'mark-pop', role: 'toolbar', 'aria-label': 'Seçili metnin biçimi', hidden: true});
    const allBtn = el('button', {type: 'button', class: 'mp-btn mp-scope', 'aria-pressed': 'false', text: 'Tüm belgede', title: 'Açıkken biçim, bu metnin belgedeki her geçişine uygulanır'});
    pop.append(...STYLE_BTNS.map(([k, label, name, key]) => el('button', {type: 'button', class: `mp-btn mp-${k}`, text: label, 'aria-label': name, title: key ? `${name} (Ctrl+${key})` : name, 'data-style': k})),
      el('button', {type: 'button', class: 'mp-btn mp-plain', text: 'Düz', title: 'Kalın, italik, altı ve üstü çizgiyi kaldır', 'data-style': 'plain'}),
      el('span', {class: 'mp-sep', 'aria-hidden': 'true'}),
      el('button', {type: 'button', class: 'mp-btn mp-sentence', text: 'Cümle', title: 'Seçimi cümlenin tamamına genişlet', 'data-act': 'sentence'}),
      allBtn);
    document.body.append(pop);
    // Keep the text selection while a bar button is pressed.
    pop.addEventListener('mousedown', ev => ev.preventDefault());
    pop.addEventListener('click', ev => {
      const btn = ev.target.closest('button'); if(!btn || !current()) return;
      popSel = current();
      if(btn === allBtn){ popAll = !popAll; allBtn.setAttribute('aria-pressed', String(popAll)); allBtn.classList.toggle('on', popAll); if(!readSelection()) selectRange(popSel.key, popSel.start, popSel.end); return; }
      if(btn.dataset.act === 'sentence'){ expandToSentence(); return; }
      applyToSelection(btn.dataset.style);
    });
    function applyToSelection(style){
      const s = popSel; if(!s) return;
      const patch = style === 'plain' ? Object.fromEntries(E().MARK_STYLES.map(k => [k, false])) : undefined;
      if(addMark(s.key, s.start, s.end, style, {all: popAll, patch})){
        // Same words stay selected for the next style.
        const b = blockFor(s.key), body = b ? E().bodyText(b) : '';
        if(body.slice(s.start, s.end) === s.text){ selectRange(s.key, s.start, s.end); showPop(); }
        else hidePop();
        if(sheet) refreshSheet();
      }
    }
    function expandToSentence(){
      const s = popSel; if(!s) return;
      const b = blockFor(s.key); if(!b) return;
      const list = E().sentences(E().bodyText(b)).filter(x => x.end > s.start && x.start < s.end);
      if(!list.length) return;
      selectRange(s.key, list[0].start, list.at(-1).end);
      showPop();
    }
    function showPop(){
      const s = readSelection();
      if(!s || !enabled()){
        // Keep the bar a moment so a tap on it still reaches its button.
        if(s === null && lastSel && performance.now() - lastSel.t < 400 && enabled()){ clearTimeout(popTimer); popTimer = setTimeout(showPop, 450); return; }
        hidePop(); return;
      }
      popSel = s; lastSel = {s, t: performance.now()};
      const b = blockFor(s.key);
      for(const [k] of STYLE_BTNS){ const on = E().rangeHas(b, s.start, s.end, k); const btn = pop.querySelector(`.mp-${k}`); btn.hidden = !shown(k); btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', String(on)); }
      pop.hidden = false;
      const docked = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
      pop.classList.toggle('docked', docked);
      if(docked){ pop.style.left = ''; pop.style.top = ''; return; }
      const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
      const w = pop.offsetWidth, h = pop.offsetHeight;
      const top = rect.top - h - 10 < 64 ? rect.bottom + 10 : rect.top - h - 10;
      pop.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, rect.left + rect.width / 2 - w / 2))}px`;
      pop.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, top))}px`;
    }
    function hidePop(){ pop.hidden = true; popSel = null; lastSel = null; popAll = false; allBtn.setAttribute('aria-pressed', 'false'); allBtn.classList.remove('on'); }
    let popTimer = 0;
    document.addEventListener('selectionchange', () => { clearTimeout(popTimer); popTimer = setTimeout(showPop, 120); });
    window.addEventListener('scroll', () => { if(!pop.hidden && !pop.classList.contains('docked')) showPop(); }, {passive: true});

    /* ---------- find / replace (whole document) ---------- */
    function buildFindBox(){
      const box = el('div', {class: 'find-box', role: 'search', 'aria-label': 'Bul ve değiştir', hidden: true});
      // Lengths match what a stored rule keeps (edits.sanitizeDoc).
      const q = el('input', {type: 'search', class: 'find-in', placeholder: 'Bul', 'aria-label': 'Aranacak metin', autocomplete: 'off', spellcheck: 'false', maxlength: '500'});
      const to = el('input', {type: 'text', class: 'find-to', placeholder: 'Yerine (isteğe bağlı)', 'aria-label': 'Yerine yazılacak metin', autocomplete: 'off', spellcheck: 'false', maxlength: '2000'});
      const cs = el('input', {type: 'checkbox', class: 'find-case'}), ww = el('input', {type: 'checkbox', class: 'find-word'});
      const count = el('span', {class: 'find-count', 'aria-live': 'polite'});
      const rules = el('ul', {class: 'rule-list', 'aria-label': 'Belge geneli kurallar'});
      box.append(
        el('div', {class: 'find-row'}, q, to),
        el('div', {class: 'find-row find-opts'}, el('label', {class: 'check small'}, cs, el('span', {text: 'Büyük/küçük harf duyarlı'})), el('label', {class: 'check small'}, ww, el('span', {text: 'Tam sözcük'})), count),
        el('div', {class: 'find-row'},
          el('button', {type: 'button', class: 'tool-btn primary-btn find-replace', text: 'Tümünü değiştir', onclick: replaceAll}),
          ...[['bold', 'Hepsi kalın'], ['italic', 'Hepsi italik'], ['underline', 'Hepsinin altı çizili']].map(([k, label]) => el('button', {type: 'button', class: `secondary tool-btn find-${k}`, text: label, onclick: () => markAll(k)})),
          el('button', {type: 'button', class: 'secondary tool-btn find-close', text: 'Kapat', onclick: () => toggleFind(false)})),
        el('p', {class: 'note small', text: 'Arama Türkçe harfleri doğru eşleştirir (İ/i, I/ı). Değiştirme ve biçim, belgenin tamamına uygulanır ve tek adımda geri alınır.'}),
        rules);
      for(const n of [q, to, cs, ww]) n.addEventListener('input', updateFind);
      q.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); (to.value ? replaceAll : () => {})(); } });
      return box;
    }
    const fq = () => findBox.querySelector('.find-in').value;
    const fopts = () => ({caseSensitive: findBox.querySelector('.find-case').checked, wholeWord: findBox.querySelector('.find-word').checked});
    function toggleFind(open = findBox.hidden){
      findBox.hidden = !open; findBtn.setAttribute('aria-pressed', String(open)); findBtn.setAttribute('aria-expanded', String(open)); findBtn.classList.toggle('on', open);
      if(open){ updateFind(); findBox.querySelector('.find-in').focus({preventScroll: true}); }
      else globalThis.CSS?.highlights?.delete('wtu-find');
    }
    findBtn.addEventListener('click', () => toggleFind());
    // Every match in the current (edited) document: [{block, index, start, end}] in body offsets.
    function findAll(){
      const needle = fq(); if(!needle) return [];
      const out = [];
      (getBlocks() || []).forEach((b, index) => {
        if(b.kind !== 'paragraph') return;
        for(const m of E().findMatches(E().bodyText(b), needle, fopts())) out.push({block: b, index, ...m});
      });
      return out;
    }
    function updateFind(){
      const hits = findAll();
      const paras = new Set(hits.map(h => h.index)).size;
      findBox.querySelector('.find-count').textContent = fq() ? (hits.length ? `${hits.length} eşleşme · ${paras} paragraf` : 'Eşleşme yok') : '';
      for(const b of findBox.querySelectorAll('.find-row button:not(.find-close)')) b.disabled = !hits.length;
      // Highlight in the preview (CSS Custom Highlight API; ignored where missing).
      if(globalThis.CSS?.highlights && globalThis.Highlight){
        const ranges = [];
        for(const h of hits.slice(0, 2000)){
          const p = paper.querySelector(`.paragraph[data-index="${h.index}"]`); if(!p) continue;
          const base = E().markerLength(h.block), a = domPoint(p, base + h.start), z = domPoint(p, base + h.end);
          const r = new Range(); r.setStart(a.node, a.offset); r.setEnd(z.node, z.offset); ranges.push(r);
        }
        CSS.highlights.set('wtu-find', new Highlight(...ranges));
      }
      // Active document-wide rules, each removable.
      const doc = E().sanitizeDoc(edits.get(DOC)), list = findBox.querySelector('.rule-list');
      const row = (text, remove) => el('li', {}, el('span', {text}), el('button', {type: 'button', class: 'icon-btn small', 'aria-label': `Kaldır: ${text}`, text: '×', onclick: remove}));
      list.replaceChildren(
        ...(doc.replace || []).map((r, i) => row(`“${clip(r.from, 30)}” → “${clip(r.to, 30)}”`, () => dropRule('replace', i))),
        ...(doc.marks || []).map((m, i) => row(`her “${clip(m.text, 30)}”: ${E().describeStyle(m)}`, () => dropRule('marks', i))),
        ...(doc.cleanups || []).map((id, i) => row(E().CLEANUPS[id].label, () => dropRule('cleanups', i))));
      list.hidden = !list.children.length;
    }
    function setDoc(next, msg, snap = true){
      if(snap) snapshot();
      const d = E().sanitizeDoc(next);
      if(Object.keys(d).length) edits.set(DOC, d); else edits.delete(DOC);
      changed(msg);
      refreshSheet();
    }
    function dropRule(kind, i){
      const d = E().sanitizeDoc(edits.get(DOC));
      const rule = d[kind]?.[i];
      d[kind] = (d[kind] || []).filter((_, j) => j !== i);
      // "Tümünü değiştir" also rewrote the user's own typed / added paragraphs:
      // removing the rule puts their text back too (when it can be found).
      let mine = 0;
      snapshot(); // one undo step for the rule and the user's text together
      if(kind === 'replace' && rule?.to){
        for(const [k, e] of [...edits]){
          if(k === DOC) continue;
          const back = t => { const n = String(t).split(rule.to).length - 1; mine += n; return n ? String(t).split(rule.to).join(rule.from) : t; };
          const ne = {...e};
          if(typeof e.text === 'string') ne.text = back(e.text);
          if(e.addAfter) ne.addAfter = e.addAfter.map(it => ({...it, text: back(it.text)}));
          edits.set(k, E().sanitize(ne));
        }
      }
      setDoc(d, kind === 'cleanups' && rule ? `Düzeltme geri alındı: ${E().CLEANUPS[rule]?.label || rule}.` : kind === 'replace' && rule && !rule.to ? 'Kural kaldırıldı. Kendi yazdığınız paragraflardaki silme geri getirilemez; gerekirse "Geri al"ı kullanın.' : `Kural kaldırıldı${mine ? ` (kendi yazdığınız metinlerde ${mine} yerde de geri alındı)` : ''}.`, false);
    }
    // One string → all matches replaced (used for the user's own typed text).
    function replaceIn(text, from, to, opts){
      let out = String(text);
      for(const m of E().findMatches(out, from, opts).reverse()) out = out.slice(0, m.start) + to + out.slice(m.end);
      return out;
    }
    function replaceAll(){
      const from = fq(), to = findBox.querySelector('.find-to').value.replace(/\s*\n\s*/gu, ' '), opts = fopts();
      const n = findAll().length;
      if(!from || !n){ onMessage('Değiştirilecek eşleşme yok.'); return; }
      if(to === from){ onMessage('Aranan ve yerine yazılacak metin aynı.'); return; }
      const d = E().sanitizeDoc(edits.get(DOC));
      // Rule for the converted text; the user's own typed paragraphs are updated once.
      d.replace = [...(d.replace || []), {from, to, ...opts}];
      snapshot();
      for(const [k, e] of [...edits]){
        if(k === DOC) continue;
        const ne = {...e};
        if(typeof e.text === 'string') ne.text = replaceIn(e.text, from, to, opts);
        if(e.addAfter) ne.addAfter = e.addAfter.map(it => ({...it, text: replaceIn(it.text, from, to, opts)}));
        edits.set(k, E().sanitize(ne));
      }
      const dd = E().sanitizeDoc(d);
      edits.set(DOC, dd);
      changed(`“${clip(from, 30)}” → “${clip(to, 30)}”: ${n} yerde değiştirildi. Geri almak için "Geri al".`);
      refreshSheet();
    }
    function markAll(k){
      const hits = findAll(); if(!hits.length) return;
      const on = !hits.every(h => E().rangeHas(h.block, h.start, h.end, k));
      const d = E().sanitizeDoc(edits.get(DOC));
      const text = fq(), o = fopts();
      const prev = (d.marks || []).find(m => m.text === text && !!m.caseSensitive === o.caseSensitive && !!m.wholeWord === o.wholeWord);
      d.marks = [...(d.marks || []).filter(m => m !== prev), {...(prev || {}), text, ...o, [k]: on}];
      setDoc(d, `Her “${clip(text, 30)}” ${E().describeStyle({[k]: on})} yapıldı (${hits.length} yerde).`);
    }
    // Suggestions from checks.js ("Düzelt"): a document-wide cleanup.
    function applyFix(fix){
      if(!fix?.cleanup || !E().CLEANUPS[fix.cleanup]) return;
      const d = E().sanitizeDoc(edits.get(DOC));
      if((d.cleanups || []).includes(fix.cleanup)) return;
      d.cleanups = [...(d.cleanups || []), fix.cleanup];
      setDoc(d, `Düzeltildi: ${E().CLEANUPS[fix.cleanup].label}. Geri almak için "Geri al".`);
    }

    /* ---------- sheet ---------- */
    function closeSheet(){
      const back = sheet && sheet.contains(document.activeElement) ? keys()[0] : null;
      sheet?.remove(); sheet = null; addOpen = false; textDraft = null; document.body.classList.remove('sheet-open');
      if(!multi){ selected.clear(); decorate(); }
      // Keyboard users continue from the paragraph they edited.
      if(back) paper.querySelector(`.paragraph[data-key="${CSS.escape(back)}"]`)?.focus({preventScroll: true});
    }
    // Every control carries a stable data-ctl so focus survives a rebuild.
    function chip(label, active, onclick, extra = {}){ return el('button', {type: 'button', class: 'chip' + (active ? ' on' : ''), 'aria-pressed': String(!!active), text: label, onclick, 'data-ctl': label, ...extra}); }
    function select(label, values, current, unit, onchange){
      const s = el('select', {class: 'mini-select', 'aria-label': label, 'data-ctl': `sel-${label}`});
      s.add(new Option('Otomatik', ''));
      for(const v of values) s.add(new Option(`${fmt(v)}${unit}`, String(v)));
      s.value = current === undefined ? '' : String(current);
      s.addEventListener('change', () => onchange(s.value === '' ? null : Number(s.value)));
      return el('label', {class: 'mini-field'}, el('span', {text: label}), s);
    }
    function section(title, ...kids){ return el('section', {class: 'sheet-sec'}, el('h3', {text: title}), ...kids); }

    function openSheet(){
      if(!selected.size || !enabled()) return;
      sheet?.remove();
      sheet = el('div', {class: 'edit-sheet', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Paragraf düzenle'});
      document.body.append(sheet);
      // Room below the page so the last paragraphs can scroll above a bottom sheet.
      document.body.classList.add('sheet-open');
      refreshSheet();
      sheet.querySelector('button, select, textarea')?.focus({preventScroll: true});
      reveal();
    }
    // Keep the edited paragraph visible next to / above the panel.
    function reveal(){
      const p = paper.querySelector(`.paragraph[data-key="${CSS.escape(keys()[0] || '')}"]`);
      if(!p || !sheet) return;
      // The bottom sheet slides in from below: its resting top is measured
      // without the animation (a transformed rect would say "off screen").
      const r = p.getBoundingClientRect(), bottomSheet = window.matchMedia('(max-width: 760px)').matches;
      const sr = {top: bottomSheet ? window.innerHeight - sheet.offsetHeight : sheet.getBoundingClientRect().top};
      if(bottomSheet){ // bottom sheet (phone)
        const hidden = q => q.bottom > sr.top - 8 || q.top < 8;
        if(!hidden(r)) return;
        // A zoomed or full-screen preview scrolls inside its own box: first there…
        const box = p.closest('.preview-viewport'), own = box && box.scrollHeight > box.clientHeight + 1 && getComputedStyle(box).overflowY !== 'hidden' ? box : null;
        if(own){
          const b = own.getBoundingClientRect(), top = Math.max(8, b.top + 8), bottom = Math.min(sr.top, b.bottom) - 8;
          own.scrollTop += r.top - Math.max(top, top + (bottom - top - r.height) / 2);
        }
        // …then the page moves whatever is still under the sheet (the box itself may start below it).
        const q = p.getBoundingClientRect();
        if(hidden(q)) window.scrollBy({top: q.top - Math.max(8, (sr.top - q.height) / 2), behavior: 'smooth'});
      } else if(r.top < 8 || r.bottom > window.innerHeight - 8) p.scrollIntoView({block: 'center', behavior: 'smooth'});
    }
    // Position of a paragraph among the visible editable paragraphs.
    function placeOf(key){
      const list = (getBlocks() || []).filter(b => b.kind === 'paragraph' && b.editKey);
      return {i: list.findIndex(b => b.editKey === key), n: list.length};
    }
    function move(key, step){
      const {i, n} = placeOf(key);
      if(i < 0) return;
      if((step < 0 && i === 0) || (step > 0 && i === n - 1)){ onMessage(step < 0 ? 'Paragraf zaten en üstte.' : 'Paragraf zaten en altta.'); return; }
      // Stored as "just above / below that paragraph" in the order made, so
      // later moves and deletions do not change where this one landed.
      const list = (getBlocks() || []).filter(b => b.kind === 'paragraph' && b.editKey);
      const target = list[i + step]?.editKey; if(!target) return;
      const seq = Math.max(0, ...[...edits.values()].map(e => e?.move?.seq || 0)) + 1;
      selected.clear(); selected.add(key);
      update({move: step < 0 ? {before: target, seq} : {after: target, seq}}, step < 0 ? 'Paragraf bir sıra yukarı taşındı.' : 'Paragraf bir sıra aşağı taşındı.');
      reveal();
    }
    function addParagraph(key, text, role){
      const t = text.trim(); if(!t) return;
      const parent = E().parentOf(key) ?? key;
      const id = newId();
      const pe = edits.get(parent) || {};
      const items = [...(pe.addAfter || [])];
      const at = parent === key ? 0 : items.findIndex(x => E().childKey(parent, x.id) === key) + 1;
      items.splice(Math.max(0, at), 0, {id, text: t, ...(role ? {role} : {})});
      snapshot();
      edits.set(parent, E().sanitize({...pe, addAfter: items}));
      addOpen = false;
      changed('Yeni paragraf eklendi; biçimini bu panelden ayarlayabilirsiniz.');
      const ck = E().childKey(parent, id);
      if(blockFor(ck)){ selected.clear(); selected.add(ck); decorate(); }
      refreshSheet();
      reveal();
    }

    function refreshSheet(){
      if(!sheet) return;
      const ks = keys().filter(k => blockFor(k));
      if(!ks.length){ closeSheet(); return; }
      // The panel is rebuilt after every change: keep its own scroll position
      // and the focused control, otherwise it jumps back to "Paragraf türü".
      const keepScroll = sheet.querySelector('.sheet-body')?.scrollTop || 0;
      const active = document.activeElement;
      const ctlKey = n => n.getAttribute('data-ctl') || `txt:${n.textContent}`;
      const keepCtl = sheet.contains(active) && active !== sheet ? ctlKey(active) : null;
      const keepAdd = sheet.querySelector('.add-form textarea')?.value;
      const one = ks.length === 1, first = blockFor(ks[0]);
      const st = E().state(first), ed = edits.get(ks[0]) || {};
      const common = f => ks.every(k => (edits.get(k) || {})[f] === ed[f]) ? ed[f] : undefined;
      const allState = f => ks.every(k => E().state(blockFor(k))[f]);
      if(sentFor !== ks.join('\n')){ sentSel = new Set(); sentFor = ks.join('\n'); }
      sheet.replaceChildren();
      const added = one && !!E().parentOf(ks[0]);
      const title = one ? `“${clip(st.text, 60)}”` : `${ks.length} paragraf seçili`;
      sheet.append(el('header', {class: 'sheet-head'}, el('span', {class: 'sheet-handle', 'aria-hidden': 'true'}), el('div', {}, el('strong', {text: added ? 'Eklenen paragraf' : 'Paragrafı düzenle'}), el('small', {text: title})),
        el('button', {type: 'button', class: 'icon-btn', 'aria-label': 'Kapat', text: '×', onclick: closeSheet})));
      const body = el('div', {class: 'sheet-body'});
      // Type
      const role = common('role');
      body.append(section('Paragraf türü',
        el('div', {class: 'chips'}, chip(!role && one && detected(first.role) ? `Otomatik · ${detected(first.role)}` : 'Otomatik', !role, () => update({role: null}, 'Paragraf türü otomatik algılamaya bırakıldı.'), {'data-ctl': 'role-auto'}),
          ...Object.entries(E().ROLES).map(([v, l]) => chip(l, role === v, () => update({role: v}, `Paragraf türü: ${l}.`), {'data-ctl': `role-${v}`})))));
      // Alignment
      const align = common('align') ?? (one ? st.align : undefined);
      body.append(section('Hizalama', el('div', {class: 'segmented'}, ...Object.entries(E().ALIGN).map(([v, l]) => chip(l, align === v, () => update({align: v}))))));
      // Font (whole paragraph)
      const toggle = (f, label, cls) => { const on = allState(f); return chip(label, on, () => update({[f]: !on}), {class: `chip style-${cls}` + (on ? ' on' : ''), title: `Paragrafın tamamı: ${label.toLocaleLowerCase('tr-TR')}`}); };
      body.append(section('Yazı (paragrafın tamamı)', el('div', {class: 'row'}, toggle('bold', 'Kalın', 'b'), toggle('italic', 'İtalik', 'i'), toggle('underline', 'Altı çizili', 'u'),
        select('Punto', E().SIZES, common('size'), '', v => update({size: v})))));
      // Words and sentences (single paragraph)
      let ta = null;
      if(one){
        // The text as shown (tidy-ups included); an unapplied draft for the same paragraph is kept.
        ta = el('textarea', {class: 'sheet-text', rows: '4', 'aria-label': 'Paragraf metni', 'data-ctl': 'text'});
        const prevTa = textDraft?.key === ks[0] ? textDraft : null;
        ta.value = prevTa && prevTa.value !== prevTa.base ? prevTa.value : st.text;
        textDraft = {key: ks[0], base: st.text, value: ta.value};
        ta.addEventListener('input', () => { if(textDraft) textDraft.value = ta.value; });
        body.append(marksSection(ks[0], first, ed, () => ta));
      }
      // Indents and spacing
      body.append(section('Girinti ve aralık', el('div', {class: 'grid3'},
        select('İlk satır', E().INDENTS, common('first'), ' cm', v => update({first: v})),
        select('Sol girinti', E().INDENTS, common('left'), ' cm', v => update({left: v})),
        select('Sağ girinti', E().INDENTS, common('right'), ' cm', v => update({right: v})),
        select('Önce', E().SPACES, common('above'), ' pt', v => update({above: v})),
        select('Sonra', E().SPACES, common('below'), ' pt', v => update({below: v})),
        select('Satır aralığı', E().LINES, common('line'), '', v => update({line: v})))));
      // Text (single paragraph only)
      if(one){
        body.append(section('Metin',
          ta,
          el('p', {class: 'note small', text: 'Değiştirmediğiniz kısımların kalın/italik biçimi korunur; kanun ve karar atıfları yeniden biçimlenir. Bir sözcüğü bu kutuda seçip yukarıdaki K / İ / A / S düğmeleriyle de biçimleyebilirsiniz.'}),
          el('div', {class: 'row'}, el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Metni uygula', 'data-ctl': 'apply-text', onclick: () => { if(ta.value.trim()){ textDraft = null; update({text: ta.value.trim()}, 'Paragraf metni güncellendi.'); } }}),
            ed.text !== undefined ? el('button', {type: 'button', class: 'secondary tool-btn', text: 'Özgün metne dön', onclick: () => { textDraft = null; update({text: null}, 'Özgün metin geri yüklendi.'); }}) : null)));
      }
      // Actions
      const flag = (f, label, msg, extra = {}) => chip(label, !!common(f), () => update({[f]: !common(f) || null}, common(f) ? `${label}: kaldırıldı.` : msg), extra);
      const place = one ? placeOf(ks[0]) : null;
      body.append(section('İşlemler', el('div', {class: 'chips'},
        one ? chip('↑ Yukarı taşı', false, () => move(ks[0], -1), {disabled: place.i <= 0, 'data-ctl': 'move-up'}) : null,
        one ? chip('↓ Aşağı taşı', false, () => move(ks[0], 1), {disabled: place.i >= place.n - 1, 'data-ctl': 'move-down'}) : null,
        one ? chip('+ Altına yeni paragraf', addOpen, () => { addOpen = !addOpen; refreshSheet(); if(addOpen) sheet.querySelector('.add-form textarea')?.focus({preventScroll: true}); }, {'data-ctl': 'add-open'}) : null,
        flag('blankBefore', 'Önüne boş satır', 'Önüne boş satır eklendi.'),
        flag('blankAfter', 'Arkasına boş satır', 'Arkasına boş satır eklendi.'),
        flag('breakBefore', 'Önüne sayfa sonu', 'Önüne sayfa sonu eklendi.'),
        one && !added ? flag('mergeNext', 'Sonrakiyle birleştir', 'Sonraki paragrafla birleştirildi.') : null,
        chip(ks.length > 1 ? 'Seçilenleri sil' : 'Paragrafı sil', false, () => update({remove: true}, `${ks.length > 1 ? `${ks.length} paragraf` : 'Paragraf'} silindi. Geri almak için "Geri al".`), {class: 'chip danger'})),
        one && addOpen ? addForm(ks[0], first, keepAdd) : null));
      sheet.append(body);
      sheet.append(el('footer', {class: 'sheet-foot'},
        el('button', {type: 'button', class: 'secondary tool-btn', text: 'Sıfırla', title: one ? 'Bu paragrafın bütün düzenlemelerini kaldır' : 'Seçili paragrafların bütün düzenlemelerini kaldır', disabled: !ks.some(k => edits.has(k)),
          onclick: () => { snapshot(); for(const k of ks) edits.delete(k); changed('Seçili paragrafların düzenlemeleri kaldırıldı.'); refreshSheet(); }}),
        el('button', {type: 'button', class: 'secondary tool-btn', text: 'Geri al', disabled: !history.length, onclick: undo}),
        el('button', {type: 'button', class: 'secondary tool-btn', text: 'Yinele', disabled: !future.length, onclick: redo}),
        el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Tamam', onclick: closeSheet})));
      // Restore only after the footer is in: before that the body is taller and the old position would be clamped.
      body.scrollTop = keepScroll;
      if(keepCtl){
        const again = [...sheet.querySelectorAll('button, select, textarea')].find(n => ctlKey(n) === keepCtl);
        again?.focus({preventScroll: true});
      }
      decorate();
    }

    // "Kelime ve cümle biçimi": sentence buttons, K/İ/A/S, existing marks.
    function marksSection(key, b, ed, textBox){
      const body = E().bodyText(b), sents = E().sentences(body);
      let all = false;
      const scope = chip('Tüm belgede', false, () => { all = !all; scope.classList.toggle('on', all); scope.setAttribute('aria-pressed', String(all)); }, {'data-ctl': 'mark-scope', title: 'Açıkken biçim, seçili metnin belgedeki her geçişine uygulanır'});
      const ranges = () => {
        if(sentSel.size) return [...sentSel].sort((x, y) => x - y).map(i => sents[i]).filter(Boolean).map(s => [s.start, s.end]);
        const ta = textBox();
        if(ta && ta.selectionEnd > ta.selectionStart){
          if(ta.value !== body){ onMessage('Metin kutusunda uygulanmamış değişiklik var: önce "Metni uygula"ya basın.'); return null; }
          return [[ta.selectionStart, ta.selectionEnd]];
        }
        onMessage('Önce bir cümleye dokunun ya da metin kutusunda bir sözcüğü seçin.');
        return null;
      };
      const apply = k => {
        const list = ranges(); if(!list) return;
        const patch = k === 'plain' ? Object.fromEntries(E().MARK_STYLES.map(s => [s, false])) : {[k]: !list.every(([a, z]) => E().rangeHas(b, a, z, k))};
        // Several sentences: one undo step for all of them.
        const before = history.length;
        for(const [a, z] of list){ if(!addMark(key, a, z, k, {all, patch})) break; }
        while(history.length > before + 1){ history.splice(before + 1, 1); }
        refreshSheet();
      };
      const sentButtons = sents.map((s, i) => {
        const cls = ['sent-chip', ...E().MARK_STYLES.filter(k => E().rangeHas(b, s.start, s.end, k)).map(k => `has-${k}`), sentSel.has(i) ? 'on' : ''].filter(Boolean).join(' ');
        return el('button', {type: 'button', class: cls, 'aria-pressed': String(sentSel.has(i)), 'data-ctl': `sent-${i}`, text: s.text,
          onclick: () => { if(sentSel.has(i)) sentSel.delete(i); else sentSel.add(i); refreshSheet(); }});
      });
      const markRows = (ed.marks || []).map((m, i) => el('li', {}, el('span', {class: 'mark-text', text: `“${clip(m.text, 50)}”`}), el('span', {class: 'mark-style', text: E().describeStyle(m)}),
        el('button', {type: 'button', class: 'icon-btn small', 'aria-label': `“${clip(m.text, 30)}” biçimini kaldır`, text: '×', 'data-ctl': `mark-del-${i}`, onclick: () => removeMark(key, i)})));
      return section('Kelime ve cümle biçimi',
        el('p', {class: 'note small', text: sents.length > 1 ? 'Biçimlemek istediğiniz cümlelere dokunun, sonra K / İ / A / S. Sözcük için metin kutusunda seçin ya da önizlemede fareyle / parmakla seçin.' : 'Cümleye dokunun ya da metin kutusunda / önizlemede sözcüğü seçin, sonra K / İ / A / S.'}),
        sents.length ? el('div', {class: 'sent-list', role: 'group', 'aria-label': 'Cümleler'}, ...sentButtons) : null,
        el('div', {class: 'row mark-row'},
          ...STYLE_BTNS.filter(([k]) => shown(k)).map(([k, label, name, sc]) => {
            // Lit when every selected sentence already has the style (the button then removes it).
            const on = sentSel.size > 0 && [...sentSel].every(i => sents[i] && E().rangeHas(b, sents[i].start, sents[i].end, k));
            return el('button', {type: 'button', class: `chip mark-btn mark-${k}` + (on ? ' on' : ''), 'aria-pressed': String(on), text: label, 'aria-label': name, title: sc ? `${name} (Ctrl+${sc})` : name, 'data-ctl': `mark-${k}`, onclick: () => apply(k)});
          }),
          el('button', {type: 'button', class: 'chip mark-btn', text: 'Düz', title: 'Seçili kısımdaki kalın, italik, altı/üstü çizgiyi kaldır', 'data-ctl': 'mark-plain', onclick: () => apply('plain')}),
          scope,
          sentSel.size ? el('button', {type: 'button', class: 'chip', text: 'Seçimi bırak', 'data-ctl': 'sent-clear', onclick: () => { sentSel.clear(); refreshSheet(); }}) : null),
        markRows.length ? el('ul', {class: 'mark-list', 'aria-label': 'Bu paragraftaki elle biçimler'}, ...markRows) : null);
    }
    function addForm(key, b, keep){
      const ta = el('textarea', {rows: '3', 'aria-label': 'Yeni paragrafın metni', 'data-ctl': 'add-text', placeholder: 'Yeni paragrafın metni'});
      if(keep) ta.value = keep;
      const roleSel = el('select', {class: 'mini-select', 'aria-label': 'Yeni paragrafın türü', 'data-ctl': 'add-role'});
      roleSel.add(new Option('Üstteki gibi', ''));
      for(const [v, l] of Object.entries(E().ROLES)) roleSel.add(new Option(l, v));
      const r = String(b.role || '').replace(/^edit-/u, '');
      if(r === 'result-item' || r === 'attachment-item') roleSel.value = r;
      return el('div', {class: 'add-form'}, ta,
        el('div', {class: 'row'}, el('label', {class: 'mini-field'}, el('span', {text: 'Türü'}), roleSel),
          el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Ekle', 'data-ctl': 'add-do', onclick: () => addParagraph(key, ta.value, roleSel.value)}),
          el('button', {type: 'button', class: 'secondary tool-btn', text: 'Vazgeç', onclick: () => { addOpen = false; refreshSheet(); }})));
    }

    /* ---------- events ---------- */
    paper.addEventListener('click', ev => {
      if(!enabled()) return;
      // Finishing a text selection (also the 2nd / 3rd click of a double or
      // triple click) is not a paragraph tap.
      if(readSelection() || ev.detail > 1) return;
      const p = ev.target.closest('.paragraph[data-key]');
      if(!p) return;
      const key = p.dataset.key, additive = multi || ev.ctrlKey || ev.metaKey || ev.shiftKey;
      if(additive){
        if(selected.has(key)) selected.delete(key); else selected.add(key);
        decorate();
        if(sheet) refreshSheet();
        return;
      }
      selected.clear(); selected.add(key); decorate(); openSheet();
    });
    paper.addEventListener('keydown', ev => {
      if(!enabled() || (ev.key !== 'Enter' && ev.key !== ' ')) return;
      const p = ev.target.closest?.('.paragraph[data-key]'); if(!p || ev.target !== p) return;
      ev.preventDefault();
      const key = p.dataset.key;
      if(multi || ev.shiftKey){ if(selected.has(key)) selected.delete(key); else selected.add(key); decorate(); if(sheet) refreshSheet(); return; }
      selected.clear(); selected.add(key); decorate(); openSheet();
    });
    document.addEventListener('keydown', ev => {
      if(ev.key === 'Escape' && !pop.hidden){ hidePop(); window.getSelection()?.removeAllRanges(); return; }
      if(ev.key === 'Escape' && sheet){ closeSheet(); return; }
      if(ev.key === 'Escape' && !findBox.hidden && findBox.contains(document.activeElement)){ toggleFind(false); findBtn.focus(); return; }
      if(!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
      // Turkish Q keyboards give "ı" for the I key: Ctrl+I is italic there too.
      const k = ev.key.toLocaleLowerCase('en-US').replace('ı', 'i');
      const act = document.activeElement;
      if(k === 'f' && enabled() && !ev.shiftKey){ ev.preventDefault(); toggleFind(true); return; }
      // Ctrl+B / I / U: a selection in the preview, or in the panel's text box.
      const style = {b: 'bold', i: 'italic', u: 'underline'}[k];
      if(style && enabled()){
        const s = readSelection();
        if(s){ ev.preventDefault(); popSel = s; applyToSelection(style); return; }
        if(sheet && act?.classList?.contains('sheet-text') && act.selectionEnd > act.selectionStart && selected.size === 1){
          const key = keys()[0], b = blockFor(key);
          if(b && act.value === E().bodyText(b)){ ev.preventDefault(); const a = act.selectionStart, z = act.selectionEnd; addMark(key, a, z, style); refreshSheet(); const t = sheet?.querySelector('.sheet-text'); if(t){ t.focus({preventScroll: true}); t.setSelectionRange(a, z); } return; }
        }
      }
      // Text fields keep their own undo; a focused checkbox or button does not.
      const typing = !!act && (act.tagName === 'TEXTAREA' || act.isContentEditable || (act.tagName === 'INPUT' && /^(?:text|search|email|number|date|url|tel|password)$/u.test(act.type)));
      if(typing) return;
      if(k === 'z' && !ev.shiftKey && history.length){ ev.preventDefault(); undo(); }
      else if((k === 'y' || (k === 'z' && ev.shiftKey)) && future.length){ ev.preventDefault(); redo(); }
    });

    decorate();
    return {
      edits,
      get count(){ return edits.size; },
      decorate,
      reset(){ edits.clear(); history.length = 0; future.length = 0; selected.clear(); closeSheet(); hidePop(); decorate(); },
      applyFix,
      // Document-wide tidy-ups applied with "Düzelt" (shown as fixed checks, each undoable on its own).
      cleanups: () => [...(E().sanitizeDoc(edits.get(DOC)).cleanups || [])],
      cleanupLabel: id => E().CLEANUPS[id]?.label || id,
      dropCleanup(id){ const i = (E().sanitizeDoc(edits.get(DOC)).cleanups || []).indexOf(id); if(i >= 0) dropRule('cleanups', i); },
      openFind: () => toggleFind(true),
      close: closeSheet
    };
  }
  globalThis.WordToUDFEditorUI = {attach};
})();
