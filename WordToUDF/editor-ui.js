/* Paragraph editor UI shared by the converter and the template page.
 *
 *  - Tap a paragraph → edit panel (bottom sheet on phones, side panel on
 *    desktop). Ctrl/Shift-click or "Çoklu seçim" selects several paragraphs.
 *  - Every change is applied immediately to the preview, can be undone
 *    ("Geri al", Ctrl+Z) and is listed in the report.
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
  // What the automatic rules decided, shown on the "Otomatik" chip.
  const DETECTED = {'court-heading': 'mahkeme başlığı', 'petition-title': 'dilekçe başlığı', metadata: 'künye satırı', topic: 'künye satırı', 'case-number': 'künye satırı',
    'field-label-line': 'künye satırı', 'major-heading': 'bölüm başlığı', 'section-field': 'bölüm satırı', 'result-heading': 'SONUÇ başlığı', 'section-heading': 'ara başlık',
    'explanation-body': 'gövde paragrafı', body: 'düz paragraf', 'result-item': 'talep maddesi', 'attachment-item': 'ek maddesi', 'result-closing': 'kapanış cümlesi', signature: 'imza satırı'};

  function attach({paper, toolbar, getBlocks, onChange, onMessage = () => {}, enabled = () => true}){
    const edits = new Map();          // key → edit object
    const history = [];               // snapshots before each change
    const selected = new Set();       // keys
    let multi = false, sheet = null;

    /* ---------- toolbar ---------- */
    const multiBtn = el('button', {type: 'button', class: 'secondary tool-btn', 'aria-pressed': 'false', text: 'Çoklu seçim', title: 'Birden çok paragrafı seçip birlikte düzenleyin (masaüstünde Ctrl/Shift + tıklama da olur)'});
    const undoBtn = el('button', {type: 'button', class: 'secondary tool-btn', text: 'Geri al', disabled: true, title: 'Son düzenlemeyi geri al (Ctrl+Z)'});
    const resetBtn = el('button', {type: 'button', class: 'secondary tool-btn', text: 'Düzenlemeleri sıfırla', disabled: true});
    const bar = el('div', {class: 'select-bar', hidden: true},
      el('span', {class: 'select-count'}),
      el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Seçilenleri düzenle', onclick: () => openSheet()}),
      el('button', {type: 'button', class: 'secondary tool-btn', text: 'Seçimi temizle', onclick: () => { selected.clear(); decorate(); }}));
    toolbar.prepend(multiBtn, undoBtn, resetBtn);
    toolbar.after(bar);
    multiBtn.addEventListener('click', () => {
      multi = !multi; multiBtn.setAttribute('aria-pressed', String(multi)); multiBtn.classList.toggle('on', multi);
      if(!multi) selected.clear();
      decorate();
      onMessage(multi ? 'Çoklu seçim açık: düzenlemek istediğiniz paragraflara dokunun, sonra "Seçilenleri düzenle".' : 'Çoklu seçim kapandı.');
    });
    undoBtn.addEventListener('click', undo);
    resetBtn.addEventListener('click', () => {
      if(!edits.size) return;
      snapshot(); edits.clear(); selected.clear(); closeSheet(); changed('Bütün elle düzenlemeler kaldırıldı. Geri almak için "Geri al".');
    });

    function snapshot(){ history.push(JSON.stringify([...edits])); if(history.length > 100) history.shift(); }
    function undo(){
      if(!history.length) return;
      edits.clear(); for(const [k, v] of JSON.parse(history.pop())) edits.set(k, v);
      changed('Son düzenleme geri alındı.');
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
      for(const b of [multiBtn, undoBtn, resetBtn]) b.hidden = !on;
      undoBtn.disabled = !history.length;
      resetBtn.disabled = !edits.size;
      resetBtn.textContent = edits.size ? `Düzenlemeleri sıfırla (${edits.size})` : 'Düzenlemeleri sıfırla';
      for(const p of paper.querySelectorAll('.paragraph[data-key]')) p.classList.toggle('selected', selected.has(p.dataset.key));
      bar.hidden = !on || !(multi || selected.size > 1);
      bar.querySelector('.select-count').textContent = selected.size ? `${selected.size} paragraf seçili` : 'Paragraf seçin';
      bar.querySelector('.primary-btn').disabled = !selected.size;
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

    /* ---------- sheet ---------- */
    function closeSheet(){ sheet?.remove(); sheet = null; document.body.classList.remove('sheet-open'); if(!multi) { selected.clear(); decorate(); } }
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
      const r = p.getBoundingClientRect(), sr = sheet.getBoundingClientRect();
      if(sr.top > window.innerHeight / 3){ // bottom sheet (phone)
        if(r.bottom > sr.top - 8 || r.top < 8) window.scrollBy({top: r.top - Math.max(8, (sr.top - r.height) / 2), behavior: 'smooth'});
      } else if(r.top < 8 || r.bottom > window.innerHeight - 8) p.scrollIntoView({block: 'center', behavior: 'smooth'});
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
      const one = ks.length === 1, first = blockFor(ks[0]);
      const st = E().state(first), ed = edits.get(ks[0]) || {};
      const common = f => ks.every(k => (edits.get(k) || {})[f] === ed[f]) ? ed[f] : undefined;
      const allState = f => ks.every(k => E().state(blockFor(k))[f]);
      sheet.replaceChildren();
      const title = one ? `“${st.text.replace(/\s+/gu, ' ').trim().slice(0, 60)}${st.text.length > 60 ? '…' : ''}”` : `${ks.length} paragraf seçili`;
      sheet.append(el('header', {class: 'sheet-head'}, el('span', {class: 'sheet-handle', 'aria-hidden': 'true'}), el('div', {}, el('strong', {text: 'Paragrafı düzenle'}), el('small', {text: title})),
        el('button', {type: 'button', class: 'icon-btn', 'aria-label': 'Kapat', text: '×', onclick: closeSheet})));
      const body = el('div', {class: 'sheet-body'});
      // Type
      const role = common('role');
      body.append(section('Paragraf türü',
        el('div', {class: 'chips'}, chip(!role && one && DETECTED[first.role] ? `Otomatik · ${DETECTED[first.role]}` : 'Otomatik', !role, () => update({role: null}, 'Paragraf türü otomatik algılamaya bırakıldı.'), {'data-ctl': 'role-auto'}),
          ...Object.entries(E().ROLES).map(([v, l]) => chip(l, role === v, () => update({role: v}, `Paragraf türü: ${l}.`), {'data-ctl': `role-${v}`})))));
      // Alignment
      const align = common('align') ?? (one ? st.align : undefined);
      body.append(section('Hizalama', el('div', {class: 'segmented'}, ...Object.entries(E().ALIGN).map(([v, l]) => chip(l, align === v, () => update({align: v}))))));
      // Font
      const toggle = (f, label, cls) => { const on = allState(f); return chip(label, on, () => update({[f]: !on}), {class: `chip style-${cls}` + (on ? ' on' : ''), title: label}); };
      body.append(section('Yazı', el('div', {class: 'row'}, toggle('bold', 'Kalın', 'b'), toggle('italic', 'İtalik', 'i'), toggle('underline', 'Altı çizili', 'u'),
        select('Punto', E().SIZES, common('size'), '', v => update({size: v})))));
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
        const ta = el('textarea', {class: 'sheet-text', rows: '4', 'aria-label': 'Paragraf metni', 'data-ctl': 'text'}); ta.value = ed.text ?? st.text;
        body.append(section('Metin',
          ta,
          el('p', {class: 'note small', text: 'Metni değiştirirseniz paragrafın içindeki tek tek kalın/italik kısımlar sıfırlanır; kanun ve karar atıfları yeniden biçimlenir.'}),
          el('div', {class: 'row'}, el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Metni uygula', onclick: () => { if(ta.value.trim()) update({text: ta.value.trim()}, 'Paragraf metni güncellendi.'); }}),
            ed.text !== undefined ? el('button', {type: 'button', class: 'secondary tool-btn', text: 'Özgün metne dön', onclick: () => update({text: null}, 'Özgün metin geri yüklendi.')}) : null)));
      }
      // Actions
      const flag = (f, label, msg, extra = {}) => chip(label, !!common(f), () => update({[f]: !common(f) || null}, common(f) ? `${label}: kaldırıldı.` : msg), extra);
      body.append(section('İşlemler', el('div', {class: 'chips'},
        flag('blankBefore', 'Önüne boş satır', 'Önüne boş satır eklendi.'),
        flag('blankAfter', 'Arkasına boş satır', 'Arkasına boş satır eklendi.'),
        flag('breakBefore', 'Önüne sayfa sonu', 'Önüne sayfa sonu eklendi.'),
        one ? flag('mergeNext', 'Sonrakiyle birleştir', 'Sonraki paragrafla birleştirildi.') : null,
        chip(ks.length > 1 ? 'Seçilenleri sil' : 'Paragrafı sil', false, () => update({remove: true}, `${ks.length > 1 ? `${ks.length} paragraf` : 'Paragraf'} silindi. Geri almak için "Geri al".`), {class: 'chip danger'}))));
      sheet.append(body);
      sheet.append(el('footer', {class: 'sheet-foot'},
        el('button', {type: 'button', class: 'secondary tool-btn', text: 'Sıfırla', title: one ? 'Bu paragrafın bütün düzenlemelerini kaldır' : 'Seçili paragrafların bütün düzenlemelerini kaldır', disabled: !ks.some(k => edits.has(k)),
          onclick: () => { snapshot(); for(const k of ks) edits.delete(k); changed('Seçili paragrafların düzenlemeleri kaldırıldı.'); refreshSheet(); }}),
        el('button', {type: 'button', class: 'secondary tool-btn', text: 'Geri al', disabled: !history.length, onclick: undo}),
        el('button', {type: 'button', class: 'tool-btn primary-btn', text: 'Tamam', onclick: closeSheet})));
      // Restore only after the footer is in: before that the body is taller and the old position would be clamped.
      body.scrollTop = keepScroll;
      if(keepCtl){
        const again = [...sheet.querySelectorAll('button, select, textarea')].find(n => ctlKey(n) === keepCtl);
        again?.focus({preventScroll: true});
      }
      decorate();
    }

    /* ---------- events ---------- */
    paper.addEventListener('click', ev => {
      if(!enabled()) return;
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
    document.addEventListener('keydown', ev => {
      if(ev.key === 'Escape' && sheet){ closeSheet(); return; }
      const typing = /^(?:INPUT|TEXTAREA|SELECT)$/u.test(document.activeElement?.tagName || '');
      if(!typing && (ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z' && history.length){ ev.preventDefault(); undo(); }
    });
    decorate();

    decorate();
    return {
      edits,
      get count(){ return edits.size; },
      decorate,
      reset(){ edits.clear(); history.length = 0; selected.clear(); closeSheet(); decorate(); },
      close: closeSheet
    };
  }
  globalThis.WordToUDFEditorUI = {attach};
})();
