(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const P=WordToUDFPipeline, S=WordToUDFSettings, L=WordToUDFLegalTypography, Lib=WordToUDFLibrary;
  const state={file:null,source:null,result:null,selection:{start:'auto',end:'auto'},profile:'legal',loadSerial:0,settings:S.load(),fit:true};
  const fileInput=$('fileInput'),drop=$('dropZone'),status=$('status');
  const download=$('download'),downloadDocx=$('downloadDocx'),reportDownload=$('reportDownload'),review=$('review'),profileSelect=$('typographyProfile');
  function message(text,kind='') {status.textContent=text;status.className=`status ${kind}`;}
  // Warnings that can lose content need "inceledim"; minor ones are information.
  const blocking=source=>(source?.warnings||[]).filter(w=>!w.minor);
  function setReady(){
    const blocked=!state.source||!state.result||(blocking(state.source).length>0&&!review.checked);
    download.disabled=blocked;downloadDocx.disabled=blocked;$('printPdf').disabled=blocked;
    reportDownload.disabled=!state.source||!state.result;
    // Phone: quick actions at the bottom once a document is loaded.
    $('mobileBar').hidden=!state.source;$('mbDownload').disabled=blocked;
    $('overrideHint').hidden=!state.result;
    $('saveCaseFromDoc').disabled=$('saveTplFromDoc').disabled=!state.result;
  }
  // The empty-state card shipped in the HTML comes back whenever no document is loaded.
  const emptyPaper=$('paper').firstElementChild?.cloneNode(true);
  function clearPaper(){$('paper').replaceChildren(...(emptyPaper?[emptyPaper.cloneNode(true)]:[]));$('paper').style.minHeight='';$('pageNote').hidden=true;$('chgLegend').hidden=true;}
  const safeName=s=>P.safeName(s);
  // Download name from the user's pattern (settings: fileName).
  function outBase(){
    const blocks=state.result?.blocks||[];
    const info=blocks.length?Lib.caseFromBlocks(blocks,state.settings.ownAttorney?.name)||{}:{};
    const title=blocks.find(b=>b.role==='petition-title');
    return P.fileName(state.settings.fileName,{date:L.todayTR(),client:info.client,caseNo:info.caseNo,type:title?WordToUDFNormalize.flatten(title).trim():'Dilekçe',source:safeName(state.file?.name||'Dilekce')});
  }
  function showFileName(){$('fileNamePreview').textContent=state.result?`→ ${outBase()}.udf`:'';}
  function downloadBlob(bytes,name,mime){
    const blob=new Blob([bytes],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }

  /* ------------------------------ settings ------------------------------ */
  function otherRows(){return [...$('otherList').querySelectorAll('.other-row')].map(row=>({name:row.querySelector('.o-name').value,uets:row.querySelector('.o-uets').value}));}
  // The form is the source of truth while the page is open; every change is
  // saved (sanitised) and triggers a re-render.
  function readForm(){
    return S.sanitize({...state.settings,ownAttorney:{name:$('ownName').value,uets:$('ownUets').value},otherEnabled:$('otherAttorney').checked,others:otherRows(),
      listMode:$('listMode').value,lineSpacing:Number($('lineSpacing').value),dateToday:$('dateToday').checked,markUets:$('markUets').checked,splitRequests:$('splitRequests').checked,
      fileName:$('fileNamePattern').value,experimental:$('experimental').checked});
  }
  function writeForm(s){
    $('ownName').value=s.ownAttorney.name;$('ownUets').value=s.ownAttorney.uets;
    $('otherAttorney').checked=s.otherEnabled;$('otherBox').hidden=!s.otherEnabled;
    $('otherList').replaceChildren();for(const o of s.others)addOtherRow(o);
    $('listMode').value=s.listMode;$('lineSpacing').value=String(s.lineSpacing);$('dateToday').checked=s.dateToday;$('markUets').checked=s.markUets;$('splitRequests').checked=s.splitRequests;
    $('fileNamePattern').value=s.fileName;$('experimental').checked=s.experimental;$('experimentBox').hidden=!s.experimental;
    syncSpec();
  }
  // Vekil/imza settings feed the pasted-petition skeleton too.
  function settingsChanged(){state.settings=readForm();S.save(state.settings);syncSpec();if(state.paste)holdPosition(()=>buildFromPaste(false));else render();}
  function addOtherRow(data={}){
    const row=document.createElement('div');row.className='other-row';
    const name=document.createElement('input');name.type='text';name.className='o-name';name.placeholder='Av. Ad SOYAD';name.value=data.name||'';name.spellcheck=false;name.setAttribute('aria-label','Başka vekil adı');
    const uets=document.createElement('input');uets.type='text';uets.className='o-uets';uets.placeholder='UETS (boş bırakılabilir)';uets.value=data.uets||'';uets.inputMode='numeric';uets.spellcheck=false;uets.setAttribute('aria-label','Başka vekil UETS');
    const del=document.createElement('button');del.type='button';del.textContent='Sil';del.setAttribute('aria-label','Bu vekili sil');
    del.addEventListener('click',()=>{row.remove();settingsChanged();});
    for(const el of [name,uets])el.addEventListener('change',settingsChanged);
    row.append(name,uets,del);$('otherList').append(row);return row;
  }
  function syncSpec(){$('specLine').textContent=`${$('lineSpacing').value==='1'?'1,0':'1,5'} · iki yana yaslı`;}

  /* ------------------------------ panels ------------------------------ */
  function labelFor(b,i){
    const value=WordToUDFNormalize.flatten(b).replace(/\s+/g,' ').trim();
    return `${i+1}. ${value.slice(0,75)}${value.length>75?'…':''}`;
  }
  function fillSelect(id,blocks,current){
    const sel=$(id);sel.replaceChildren();
    sel.add(new Option('Otomatik tanıma','auto'));
    sel.add(new Option('Seçme / bölüm uygulanmasın','none'));
    for(let i=0;i<blocks.length;i++)if(blocks[i].kind==='paragraph')sel.add(new Option(labelFor(blocks[i],i),String(i)));
    sel.value=current;
  }
  function showWarnings(source){
    const list=$('warningList');list.replaceChildren();
    const warningCount=blocking(source).length;
    $('colorNote').textContent='Doğrudan RGB ve çözümlenebilen Word tema renkleri aktarılır. Hukuk dilekçesi profilinde yazı tipi Times New Roman 12 pt\'dir.';
    if(!warningCount){const item=document.createElement('li');item.className='ok';item.textContent='Temel biçimlendirmeler için tespit edilen ek kayıp yok.';list.append(item);}
    // Content-affecting warnings first, then the informational ones.
    for(const warning of [...blocking(source),...source.warnings.filter(w=>w.minor)]){
      const item=document.createElement('li');if(warning.minor)item.className='minor';
      item.textContent=`${warning.minor?'Bilgi: ':''}${warning.message}${warning.count>1?` (${warning.count} bölüm)`:''}`;list.append(item);
    }
    $('reviewLabel').hidden=!warningCount;
    review.checked=false;
    setReady();
  }
  const CHANGE_LABELS={label:'Etiket kısaltıldı','case-number':'Dosya/karar no tek etikette',surname:'Soyadı büyük harf','name-ambiguous':'Ad/soyad belirsiz','uets-profile':'UETS kayıtlı vekilden','attorney-fuse':'Vekil adres/UETS satırı birleşti','label-split':'Uzun etiket iki satıra bölündü','explanations-split':'AÇIKLAMALAR metni yeni paragrafta','section-inline':'Bölüm değeri başlık satırında','result-intro':'SONUÇ girişi','closing-split':'Kapanış listeden ayrıldı','closing-added':'Kapanış cümlesi eklendi','manual-number':'Metindeki numara listeye çevrildi',date:'Kapanış tarihi','blank-removed':'Boş satır kaldırıldı','request-split':'Talepler maddelere ayrıldı'};
  function changeText(c){return `${CHANGE_LABELS[c.type]||c.type}: ${c.before} → ${c.after}`;}
  function showChanges(stats){
    const list=$('changeList');list.replaceChildren();
    $('changesBlock').hidden=!stats?.enabled&&!(stats?.edits||[]).length;
    if(!stats?.enabled){for(const e of stats?.edits||[]){const li=document.createElement('li');li.className='manual';li.textContent=`Elle düzenleme: “${e.excerpt}” → ${e.summary}`;list.append(li);}return;}
    const changes=stats.changes||[];
    if(!changes.length){const li=document.createElement('li');li.className='ok';li.textContent='Metinde hukuk profiline bağlı değişiklik yapılmadı.';list.append(li);}
    for(const c of changes.slice(0,80)){const li=document.createElement('li');li.textContent=changeText(c);list.append(li);}
    if(changes.length>80){const li=document.createElement('li');li.textContent=`… ve ${changes.length-80} değişiklik daha (raporda tamamı).`;list.append(li);}
    for(const e of stats.edits||[]){const li=document.createElement('li');li.className='manual';li.textContent=`Elle düzenleme: “${e.excerpt}” → ${e.summary}`;list.append(li);}
    const bad=S.invalidUets(state.settings);
    $('uetsInfo').textContent=bad.length?`Geçersiz UETS (${bad.join(', ')}) yok sayıldı. Biçim: 12345-12345-12345`:'';
  }
  const LEVEL_TEXT={error:'Hata',warn:'Uyarı',info:'Bilgi',suggest:'Öneri'};
  function showChecks(checks){
    const list=$('checkList');list.replaceChildren();
    $('checksPanel').hidden=!state.result;
    const counts={error:0,warn:0,info:0,suggest:0};
    for(const c of checks){
      counts[c.level]++;
      const li=document.createElement('li');li.className=`check-${c.level}`;li.dataset.code=c.code;
      const tag=document.createElement('strong');tag.textContent=`${LEVEL_TEXT[c.level]}: `;li.append(tag,document.createTextNode(c.message));
      if(c.code==='request-split'&&!$('splitRequests').checked){
        const btn=document.createElement('button');btn.type='button';btn.className='secondary inline-btn';btn.textContent='Maddelere ayır';
        btn.addEventListener('click',()=>{$('splitRequests').checked=true;settingsChanged();});li.append(' ',btn);
      }
      if(c.fix){
        // Format suggestion: one press fixes it everywhere (undoable).
        const btn=document.createElement('button');btn.type='button';btn.className='secondary inline-btn';btn.textContent='Düzelt';
        btn.addEventListener('click',()=>holdPosition(()=>editor.applyFix(c.fix)));li.append(' ',btn);
      }
      list.append(li);
    }
    $('checkStats').textContent=`${counts.error} hata · ${counts.warn} uyarı${counts.suggest?` · ${counts.suggest} öneri`:''}`;
    $('checkStats').className='pill'+(counts.error?' pill-error':counts.warn?' pill-warn':' pill-ok');
  }

  /* ------------------------------ preview ------------------------------ */
  function fitPaper(){
    const scale=WordToUDFPreview.fit($('previewViewport'),$('paperScale'),$('paper'),state.fit);
    $('zoomToggle').setAttribute('aria-pressed',String(state.fit));
    $('zoomToggle').textContent=state.fit?`Sığdır · %${Math.round(scale*100)}`:'Gerçek boyut';
  }
  // A re-render rebuilds the report and check lists, which sit above most
  // settings; without this the control the user just changed slides away
  // (the browser loses its scroll anchor when those lists are replaced).
  // The control is the one that fired the change (focus can lag behind on
  // some mobile pickers), otherwise the focused one.
  let lastControl=null;
  for(const type of ['change','click'])document.addEventListener(type,e=>{lastControl={n:e.target,t:performance.now()};},true);
  function holdPosition(fn){
    const pick=n=>n&&n.nodeType===1&&n!==document.body&&n.closest('.layout')&&!n.closest('#paper')?n:null;
    const own=(lastControl&&performance.now()-lastControl.t<1500?pick(lastControl.n):null)||pick(document.activeElement);
    const anchors=own?[own,own.closest('.panel')].filter(Boolean).map(n=>({n,y:n.getBoundingClientRect().top})):[];
    try{return fn();}
    finally{
      const hit=anchors.find(x=>x.n.isConnected&&x.n.getClientRects().length);
      if(hit){const dy=hit.n.getBoundingClientRect().top-hit.y;if(Math.abs(dy)>1)window.scrollBy(0,dy);}
    }
  }
  function render(){holdPosition(renderNow);}
  function renderNow(){
    if(!state.source)return;
    const source=state.source;
    state.result=null;
    let t;
    try{t=P.typeset(source.blocks,{profile:state.profile,selection:state.selection,settings:state.settings,now:new Date(),edits:editor.edits,sourceMargins:source.options.margins});}
    catch(err){message(`Dönüştürme hazırlanamadı: ${err.message}`,'error');setReady();return;}
    const norm=t.norm;
    state.result={...norm,blocks:t.blocks,typography:t.typography,checks:t.checks};
    $('sectionPanel').hidden=state.profile==='faithful';
    $('legalOptions').hidden=state.profile==='faithful';
    showChanges(t.typography);showChecks(t.checks);
    const n=t.typography.splittableRequests||0;
    $('splitHint').textContent=n>1&&!$('splitRequests').checked?`(bu belgede ${n} talep tek maddede)`:'';
    const legal=state.profile==='legal';
    const pg=WordToUDFPreview.render($('paper'),t.blocks,{margins:norm.margins,landscape:source.options.landscape,font:legal?P.LEGAL_FONT:source.options.font,size:legal?P.LEGAL_SIZE:source.options.size});
    state.pages=pg.pages;
    showPageNote(pg);
    // "Değişiklikleri göster": words the rules added or changed, per-paragraph notes.
    $('changesToggle').hidden=!legal;$('chgLegend').hidden=!(legal&&state.showChanges);
    if(legal&&state.showChanges)WordToUDFPreview.markChanges($('paper'),source.blocks,(t.typography.changes||[]).map(c=>({after:String(c.after||'').trim(),text:changeText(c)})));
    fitPaper();
    editor.decorate();
    const ty=t.typography;
    const typeInfo=ty?.enabled?` · ${ty.metadataMerged||0} künye satırı birleştirildi · ${ty.resultItems||0} talep ve ${ty.attachments||0} ek numaralı listede · hukuk tipografisi etkin`:' · Word biçimi profili';
    $('sectionInfo').textContent=norm.selection.start<0?'AÇIKLAMALAR başlığı bulunamadı; gerekirse başlangıç başlığını seçin.':`${norm.bodyCount} gövde paragrafı ve ${norm.headingCount||0} ara başlık açıklamalar düzeninde işlendi${typeInfo}.`;
    $('previewCount').textContent=`${source.statistics.paragraphs} paragraf · ≈ ${pg.pages} sayfa · A4 ${source.options.landscape?'yatay':'dikey'}`;
    showFileName();
    setReady();
  }
  function showPageNote(pg){
    $('pageNote').hidden=!pg.signatureAlone;
    $('pageNote').textContent=pg.signatureAlone?`Uyarı (yaklaşık): imza bloğu ${pg.pages}. sayfaya tek başına düşüyor. Bir paragrafı kısaltmayı ya da boşlukları azaltmayı düşünün; UYAP'ta kontrol edin.`:'';
  }
  $('changesToggle').addEventListener('click',()=>{
    state.showChanges=!state.showChanges;$('changesToggle').setAttribute('aria-pressed',String(state.showChanges));$('changesToggle').classList.toggle('on',state.showChanges);
    render();
  });
  // Paragraph editor (editor-ui.js): tap a paragraph in the preview.
  const editor=WordToUDFEditorUI.attach({paper:$('paper'),toolbar:$('previewTools'),getBlocks:()=>state.result?.blocks,
    onChange:render,onMessage:m=>message(m,'success'),enabled:()=>!!state.result,extraStyles:()=>state.settings.experimental?['highlight']:[]});

  /* ------------------------------ files ------------------------------ */
  async function handleFile(file){
    if(!file)return;
    if(!/\.docx$/iu.test(file.name)){message('Yalnız .docx uzantılı Word belgeleri desteklenmektedir.','error');return;}
    if(file.size<100||file.size>24*1024*1024){message('Dosya boş, hasarlı veya 24 MB sınırını aşıyor.','error');return;}
    const serial=++state.loadSerial;
    state.file=null;state.source=null;state.result=null;state.selection={start:'auto',end:'auto'};editor.reset();
    state.paste=null;state.pasteInfo=null;$('completePanel').hidden=true;
    $('sectionPanel').hidden=true;$('reportPanel').hidden=true;$('checksPanel').hidden=true;clearPaper();
    review.checked=false;setReady();message('Belge yerel olarak okunuyor…');
    try{
      const source=await WordToUDFDocx.readDocx(await file.arrayBuffer());
      if(serial!==state.loadSerial)return;
      state.file=file;state.source=source;setTab('word');
      fillSelect('startSection',source.blocks,'auto');fillSelect('endSection',source.blocks,'auto');
      $('sectionPanel').hidden=false;$('reportPanel').hidden=false;
      $('fileStats').textContent=`${source.statistics.paragraphs} paragraf · ${source.statistics.tables} tablo`;
      showWarnings(source);render();
      message(`${file.name} okundu. Önizlemeyi, dilekçe denetimini ve varsa dönüşüm uyarılarını kontrol edin.`,'success');
    }catch(err){
      if(serial!==state.loadSerial)return;
      clearPaper();state.source=null;setReady();
      message(`DOCX açılamadı: ${err.message}`,'error');
    }
  }
  fileInput.addEventListener('change',e=>handleFile(e.target.files?.[0]));

  /* ------------------------------ paste (no Word file needed) ------------------------------ */
  // The clipboard's formatted (text/html) and plain versions are both read;
  // paste.js recognises the source and rebuilds the petition skeleton.
  const PASTE_PARTS=[['court','Mahkeme başlığı'],['caseNo','Dosya no'],['client','Müvekkil (taraf) satırı'],['attorney','Vekil satırı'],['other','Karşı taraf satırı'],['topic','KONU'],['explanations','AÇIKLAMALAR'],['result','SONUÇ VE İSTEM'],['signature','İmza bloğu']];
  const pasteFill=()=>({court:$('pc_court').value,caseNo:$('pc_caseNo').value,role:$('pc_role').value,client:$('pc_client').value,otherRole:$('pc_otherRole').value,
    other:$('pc_other').value,topic:$('pc_topic').value,addHeadings:$('pc_headings').checked,addSignature:$('pc_signature').checked});
  function pasteName(){
    const who=$('pc_client').value.trim();
    return `${who?`${who} `:''}Dilekce ${L.todayTR()}.docx`;
  }
  function buildFromPaste(fresh){
    if(!state.paste)return;
    let parsed;
    try{parsed=state.paste.parsed||(state.paste.parsed=WordToUDFPaste.parse(state.paste));}
    catch(err){message(`Yapıştırılan metin okunamadı: ${err.message}`,'error');return;}
    const asm=WordToUDFPaste.assemble(parsed.blocks,pasteFill(),state.settings);
    const a=asm.analysis.has;
    const present={court:a.court,caseNo:a.caseNo,client:a.parties>0,attorney:a.attorney,other:a.parties>1,topic:a.topic,explanations:a.explanations,result:a.result,signature:a.signature};
    // Only the missing parts get an input.
    // A lower-case court line is fixed automatically, so it needs no input.
    const hide={...present,court:a.court||asm.analysis.courtCandidate>=0};
    for(const el of document.querySelectorAll('#completeFields .cf'))el.hidden=!!hide[el.dataset.part];
    const list=$('partList');list.replaceChildren();
    for(const [k,label] of PASTE_PARTS){
      const added=asm.addedKeys.includes(k);
      const li=document.createElement('li');li.className=present[k]?'ok':added?'added':'missing';
      const hint=k==='attorney'&&!present[k]&&!added&&state.settings.ownAttorney?.name?' — müvekkil yazılınca ayarlardaki vekille eklenir':'';
      li.textContent=`${present[k]?'✓':added?'+':'✗'} ${label}${present[k]?'':added?' — eklendi':hint||' — yok'}`;list.append(li);
    }
    $('pasteSource').hidden=false;$('pasteSource').textContent=`Kaynak: ${parsed.sourceLabel}`;
    const notes=$('pasteNotes');notes.replaceChildren();
    for(const n of [`${parsed.sourceLabel} kaynağından ${parsed.paragraphs} paragraf okundu.`,...parsed.notes,...(asm.added.length?[`Eklenen: ${asm.added.join(', ')}.`]:[])]){const li=document.createElement('li');li.textContent=n;notes.append(li);}
    state.pasteInfo={source:parsed.sourceLabel,notes:parsed.notes,added:asm.added};
    // Adding künye rows shifts paragraph positions: a manually chosen
    // AÇIKLAMALAR start/end would then point at the wrong paragraph.
    const shifted=!fresh&&state.source&&state.source.blocks.length!==asm.blocks.length;
    if(shifted&&(state.selection.start!=='auto'||state.selection.end!=='auto')){state.selection={start:'auto',end:'auto'};message('Paragraf sırası değiştiği için AÇIKLAMALAR sınırları yeniden otomatik algılanıyor.');}
    const text=asm.blocks.map(b=>WordToUDFNormalize.flatten(b));
    state.source={blocks:asm.blocks,warnings:[],statistics:{paragraphs:asm.blocks.filter(b=>b.kind==='paragraph').length,tables:0,characters:text.join('').length,pages:0},
      options:{margins:{},landscape:false,font:P.LEGAL_FONT,size:P.LEGAL_SIZE}};
    state.file={name:pasteName()};
    if(fresh){state.selection={start:'auto',end:'auto'};editor.reset();++state.loadSerial;}
    fillSelect('startSection',state.source.blocks,state.selection.start);fillSelect('endSection',state.source.blocks,state.selection.end);
    $('completePanel').hidden=false;$('sectionPanel').hidden=false;$('reportPanel').hidden=false;
    $('fileStats').textContent=`${state.source.statistics.paragraphs} paragraf · yapıştırılan metin`;
    showWarnings(state.source);render();
    if(fresh)message(`Metin ${parsed.sourceLabel} kaynağından okundu ve dilekçe kuruldu. Eksik parçaları soldaki listeden tamamlayabilir, önizlemede paragrafa dokunarak düzeltebilirsiniz.`,'success');
  }
  /* Source tabs: "Word dosyası" | "Metni yapıştır" (WAI-ARIA tabs). */
  const TABS={word:['tabWord','wordPanel'],paste:['tabPaste','pastePanel']};
  function setTab(name,focus=false){
    for(const [key,[tab,panel]] of Object.entries(TABS)){
      const on=key===name;
      $(tab).setAttribute('aria-selected',String(on));$(tab).tabIndex=on?0:-1;$(panel).hidden=!on;
      if(on&&focus)$(tab).focus();
    }
  }
  $('tabWord').addEventListener('click',()=>setTab('word'));
  $('tabPaste').addEventListener('click',()=>{setTab('paste');$('pasteBox').focus({preventScroll:true});});
  for(const id of ['tabWord','tabPaste'])$(id).addEventListener('keydown',e=>{
    if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();setTab(id==='tabWord'?'paste':'word',true);}
  });
  function handlePaste(e){
    const html=e.clipboardData?.getData('text/html')||'',text=e.clipboardData?.getData('text/plain')||'';
    if(!html&&!text)return false;
    e.preventDefault();
    setTab('paste');
    state.paste={html,text,typed:false};
    buildFromPaste(true);
    // Show the readable text in the box (formatted-only clipboards included).
    $('pasteBox').value=text||state.paste?.parsed?.blocks.map(b=>WordToUDFNormalize.flatten(b)).join('\n')||'';
    return true;
  }
  $('pasteBox').addEventListener('paste',handlePaste);
  // Ctrl+V anywhere on the page (outside form fields) pastes a petition too.
  document.addEventListener('paste',e=>{
    const t=e.target;
    if(t===$('pasteBox')||t?.closest?.('input,textarea,select,[contenteditable="true"],.edit-sheet'))return;
    handlePaste(e);
  });
  $('pasteBox').addEventListener('input',()=>{$('pasteBuild').classList.add('pending');});
  $('pasteBuild').addEventListener('click',()=>{
    const text=$('pasteBox').value;
    if(!text.trim()){message('Önce kutuya metin yapıştırın veya yazın.','error');return;}
    // Edited or typed text: only the plain version is used.
    state.paste={html:'',text,typed:true};$('pasteBuild').classList.remove('pending');
    buildFromPaste(true);
  });
  $('pasteClear').addEventListener('click',()=>{
    $('pasteBox').value='';state.paste=null;state.pasteInfo=null;$('pasteNotes').replaceChildren();$('pasteSource').hidden=true;$('completePanel').hidden=true;
    if(state.file&&!(state.file instanceof Blob)){state.file=null;state.source=null;state.result=null;editor.reset();clearPaper();$('checksPanel').hidden=true;$('reportPanel').hidden=true;$('sectionPanel').hidden=true;setReady();}
    message('Yapıştırma alanı temizlendi.');
  });
  for(const id of ['pc_court','pc_caseNo','pc_client','pc_otherRole','pc_other','pc_topic'])$(id).addEventListener('change',()=>holdPosition(()=>buildFromPaste(false)));
  for(const id of ['pc_role','pc_headings','pc_signature'])$(id).addEventListener('change',()=>{
    if(id==='pc_role'){const o=WordToUDFTemplates.OPPOSITE[$('pc_role').value];if(o)$('pc_otherRole').value=o;}
    holdPosition(()=>buildFromPaste(false));
  });
  for(const name of ['dragover','dragenter'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag');});
  for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag');});
  drop.addEventListener('drop',e=>{
    const files=[...(e.dataTransfer?.files||[])];
    if(files.length>1)runBatch(files);else if(files.length)handleFile(files[0]);
  });
  async function runBatch(files){
    if(!files.length)return;
    if(files.length>100){message('Toplu dönüşümde en fazla 100 dosya seçilebilir.','error');return;}
    message(`${files.length} dosya dönüştürülüyor…`);
    try{
      const res=await P.batch(files,{settings:state.settings,profile:state.profile,now:new Date(),onProgress:(i,n,name)=>message(`${i}/${n} · ${name} dönüştürülüyor…`)});
      downloadBlob(res.bytes,`UDF-toplu-${L.todayTR().replace(/\./g,'-')}.zip`,'application/zip');
      const failed=res.total-res.converted;
      message(`Toplu dönüşüm bitti: ${res.converted}/${res.total} dosya UDF'ye çevrildi${failed?`, ${failed} dosya hatalı (ZIP içindeki raporda)`:''}.`,failed?'error':'success');
    }catch(err){message(`Toplu dönüşüm başarısız: ${err.message}`,'error');}
    finally{$('batchInput').value='';}
  }
  $('batchInput').addEventListener('change',e=>runBatch([...(e.target.files||[])]));

  /* ------------------------------ settings events ------------------------------ */
  review.addEventListener('change',setReady);
  writeForm(state.settings);
  for(const id of ['lineSpacing','dateToday','markUets','listMode','splitRequests','ownName','ownUets'])$(id).addEventListener('change',settingsChanged);
  $('otherAttorney').addEventListener('change',()=>{
    $('otherBox').hidden=!$('otherAttorney').checked;
    if($('otherAttorney').checked&&!$('otherList').children.length)addOtherRow().querySelector('.o-name').focus();
    settingsChanged();
  });
  $('addAttorney').addEventListener('click',()=>{addOtherRow().querySelector('.o-name').focus();settingsChanged();});
  $('exportSettings').addEventListener('click',()=>{
    // The settings file also carries the case cards and the user's templates.
    const data=JSON.parse(S.exportJson(readForm()));data.library=Lib.exportData();
    downloadBlob(new TextEncoder().encode(JSON.stringify(data,null,2)),'wordtoudf-ayarlar.json','application/json');
    message(`Ayarlar dışa aktarıldı (${data.library.cases.length} dosya kartı, ${data.library.templates.length} şablon dahil). Dosyayı diğer cihazda "İçe aktar" ile açın.`,'success');
  });
  $('importSettings').addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      if(f.size>256*1024)throw new Error('Ayar dosyası çok büyük.');
      const text=await f.text();
      state.settings=S.importJson(text);S.save(state.settings);writeForm(state.settings);render();
      const lib=Lib.importData(JSON.parse(text).library);refreshLibrary();
      message(`Ayarlar içe aktarıldı${lib.cases||lib.templates?` (${lib.cases} dosya kartı, ${lib.templates} şablon eklendi/güncellendi)`:''}.`,'success');
    }catch(err){message(err.message,'error');}
    finally{e.target.value='';}
  });
  profileSelect.addEventListener('change',e=>{state.profile=e.target.value==='faithful'?'faithful':'legal';editor.close();render();});
  $('startSection').addEventListener('change',e=>{state.selection.start=e.target.value;render();});
  $('endSection').addEventListener('change',e=>{state.selection.end=e.target.value;render();});
  $('zoomToggle').addEventListener('click',()=>{state.fit=!state.fit;fitPaper();});
  let resizeTimer=0;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(fitPaper,120);});

  /* ------------------------------ downloads ------------------------------ */
  function reportText(){
    const source=state.source,norm=state.result;
    const parts=[`Kaynak: ${state.pasteInfo?`yapıştırılan metin (${state.pasteInfo.source})`:state.file.name}`,'WORD → UDF DÖNÜŞÜM RAPORU',...(state.pasteInfo?['Yapıştırma notları:',...state.pasteInfo.notes.map(n=>`- ${n}`),`- Dilekçeye eklenen parçalar: ${state.pasteInfo.added.join(', ')||'yok'}`]:[]),'',`Paragraf sayısı: ${source.statistics.paragraphs}`,`Düz metne çevrilen tablo sayısı: ${source.statistics.tables}`,`Tipografi profili: ${state.profile==='legal'?'Hukuk dilekçesi':'Word biçimini koru'}`,`Birleştirilen künye satırı: ${norm?.typography?.metadataMerged||0}`];
    if(state.profile==='legal'){
      const t=norm.typography||{},ls=String(t.lineSpacing??1.5).replace('.',',');
      const auto=state.settings.listMode==='auto';
      parts.push('Sayfa kenar boşlukları: 1,5 cm',`Açıklamalar gövdesi: ${norm.bodyCount} paragraf`,`Açıklamalar ara başlığı: ${norm.headingCount||0}`,'AÇIKLAMALAR gövdesi paragraf önce/sonra: 0,15 cm / 0,15 cm',`AÇIKLAMALAR: 1,25 cm ilk satır, ${ls} satır aralığı, iki yana yaslama`,
        `Ortak iki nokta sekme durağı: ${(t.colonTabPt||0).toFixed(2)} pt (${((t.colonTabPt||0)*2.54/72).toFixed(2)} cm); etiket, sekme ve iki nokta kesintisiz altı çizili, değer normal`,
        `SONUÇ talepleri: ${t.resultItems||0} madde, ${auto?'gerçek otomatik liste (ListId 1)':'metin numarası + sekme'}`,`EKLER: ${t.attachments||0} madde, ${auto?'ayrı otomatik liste (ListId 2)':'ayrı numaralı liste'}`,`Yazı karakteri: ${P.LEGAL_FONT} ${P.LEGAL_SIZE} pt`,
        `Kapanış: ${t.closing||'—'}`,`Kapanış tarihi: ${t.date||'kaynaktaki gibi bırakıldı'}`,`Elle düzenlenen paragraf: ${t.overrides||0}`);
      parts.push('','Dilekçe denetimi:');
      parts.push(...(norm.checks||[]).map(c=>`- ${LEVEL_TEXT[c.level]}: ${c.message}`));
      parts.push('','Hukuk profilinin yaptığı metin değişiklikleri:');
      parts.push(...((t.changes||[]).length?t.changes.map(c=>`- ${changeText(c)}`):['- Yok']));
      const integ=t.integrity||{removed:[],added:[]};
      parts.push('','Metin bütünlüğü denetimi (sözcük karşılaştırması; yukarıdaki değişikliklerle açıklanmalıdır):',`- Kaynakta olup çıktıda azalan sözcükler: ${integ.removed.join(', ')||'yok'}`,`- Çıktıya eklenen sözcükler: ${integ.added.join(', ')||'yok'}`);
    }
    else parts.push('Sayfa kenar boşlukları: Word kaynağı (varsa)','Paragraf hizalama, girinti, satır aralığı ve önce/sonra boşlukları: Word kaynağından korunur.');
    const manual=norm?.typography?.edits||[];
    parts.push('','Elle yapılan paragraf düzenlemeleri:',...(manual.length?manual.map(e=>`- “${e.excerpt}” → ${e.summary}`):['- Yok']));
    parts.push('','Dönüşüm uyarıları:');
    parts.push(...(source.warnings.length?source.warnings.map(w=>`- ${w.minor?'(bilgi) ':''}${w.message} (${w.count})`):['- Tespit edilen ek biçim kaybı yok.']));
    parts.push('','UDF üzerinde UYAP Doküman Editörü ile son kontrol yapılmalıdır; UYAP kabulü bu eklenti tarafından test edilmemiştir.','Belge imzasızdır: görünen imza metni kriptografik e-imza değildir, UYAP\'ta yeniden imzalanmalıdır.');
    return parts.join('\n');
  }
  reportDownload.addEventListener('click',()=>{
    if(!state.source||!state.result)return;
    downloadBlob(new TextEncoder().encode(reportText()),outBase()+'-donusum-raporu.txt','text/plain;charset=utf-8');
  });
  function outputOptions(){
    const legal=state.profile==='legal';
    return {margins:state.result.margins,landscape:state.source.options.landscape,font:legal?P.LEGAL_FONT:state.source.options.font,size:legal?P.LEGAL_SIZE:state.source.options.size};
  }
  download.addEventListener('click',async()=>{
    if(!state.source||!state.result||download.disabled)return;
    // Re-render so the closing date is the date of generation, not of preview.
    if(state.profile==='legal')render();
    if(!state.result)return;
    download.disabled=true;message('UDF oluşturuluyor ve içeriği doğrulanıyor…');
    try{
      const res=await P.toUdf(state.result.blocks,outputOptions());
      downloadBlob(res.bytes,outBase()+'.udf','application/octet-stream');
      const errors=(state.result.checks||[]).filter(c=>c.level==='error').length;
      message(`UDF hazır: ${res.paragraphs} paragraf, ${res.lists} otomatik liste maddesi, ${res.breaks} sayfa sonu.${errors?` Dilekçe denetiminde ${errors} hata var; göndermeden önce bakın.`:''} İndirilen dosyayı UYAP'ta denetleyin.`,errors?'error':'success');
    }catch(err){message(`Dönüştürme başarısız: ${err.message}`,'error');}
    finally{setReady();}
  });
  downloadDocx.addEventListener('click',async()=>{
    if(!state.source||!state.result||downloadDocx.disabled)return;
    if(state.profile==='legal')render();
    if(!state.result)return;
    downloadDocx.disabled=true;message('Düzenlenmiş Word belgesi oluşturuluyor…');
    try{
      const o=outputOptions();
      P.assertHasText(state.result.blocks);
      const bytes=await WordToUDFDocxWriter.create({options:{margins:o.margins,landscape:o.landscape,font:o.font,size:o.size},blocks:state.result.blocks,headers:[],footers:[]});
      downloadBlob(bytes,outBase()+'-duzenlenmis.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      message('Düzenlenmiş Word belgesi indirildi (UDF ile aynı düzen).','success');
    }catch(err){message(`Word oluşturulamadı: ${err.message}`,'error');}
    finally{setReady();}
  });

  /* ------------------------------ library (case cards, own templates) ------------------------------ */
  const pastePicker=Lib.picker($('pasteCasePicker'),{
    read:()=>({court:$('pc_court').value,caseNo:$('pc_caseNo').value,role:$('pc_role').value,client:$('pc_client').value,otherRole:$('pc_otherRole').value,other:$('pc_other').value}),
    apply:c=>{
      $('pc_court').value=c.court;$('pc_caseNo').value=c.caseNo;$('pc_client').value=c.client;$('pc_other').value=c.other;
      if([...$('pc_role').options].some(o=>o.value===c.role))$('pc_role').value=c.role;
      if(c.otherRole)$('pc_otherRole').value=c.otherRole;
      holdPosition(()=>buildFromPaste(false));
    },
    onMessage:(m,kind)=>message(m,kind||'success')});
  function refreshLibrary(){
    pastePicker.refresh();
    const c=Lib.cases().length,t=Lib.templates().length;
    $('libraryStats').textContent=`Bu tarayıcıda ${c} dosya kartı ve ${t} kendi şablonunuz var.`;
  }
  $('saveCaseFromDoc').addEventListener('click',()=>{
    if(!state.result)return;
    try{const card=Lib.saveCase(Lib.caseFromBlocks(state.result.blocks,state.settings.ownAttorney?.name)||{});refreshLibrary();message(`Dosya kartı kaydedildi: ${Lib.caseLabel(card)}`,'success');}
    catch(err){message(err.message,'error');}
  });
  $('saveTplFromDoc').addEventListener('click',()=>{
    if(!state.result)return;
    const title=$('docTplName').value.trim();
    if(!title){message('Şablona bir ad verin.','error');$('docTplName').focus();return;}
    const info=Lib.caseFromBlocks(state.result.blocks,state.settings.ownAttorney?.name)||{};
    const parts=Lib.partsFromBlocks(state.result.blocks);
    try{
      const tpl=Lib.saveTemplate({title,role:info.role,otherRole:info.otherRole,...Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,Lib.generalize(v,info)]))});
      $('docTplName').value='';refreshLibrary();
      message(`“${tpl.title}” şablon olarak kaydedildi; Şablonlar sayfasında “Kendi şablonlarım” altında.`,'success');
    }catch(err){message(err.message,'error');}
  });
  refreshLibrary();

  // PDF: the browser's print dialog with only the petition on A4 pages.
  $('printPdf').addEventListener('click',()=>{
    if(!state.source||!state.result||$('printPdf').disabled)return;
    if(state.profile==='legal')render();
    if(!state.result)return;
    try{
      message('Yazdırma penceresinde hedef olarak “PDF olarak kaydet”i seçin; “Üstbilgi ve altbilgi” kutusunu kapatın.','success');
      WordToUDFPrint.printBlocks(state.result.blocks,{...outputOptions(),title:outBase()});
    }catch(err){message(`PDF hazırlanamadı: ${err.message}`,'error');}
  });
  $('fileNamePattern').addEventListener('input',()=>{state.settings.fileName=$('fileNamePattern').value;S.save(state.settings);showFileName();});
  // Experimental UDF features (opt-in): text highlight.
  $('experimental').addEventListener('change',()=>{$('experimentBox').hidden=!$('experimental').checked;settingsChanged();editor.close();});
  $('experimentSample').addEventListener('click',async()=>{
    const run=(text,extra={})=>({text,font:P.LEGAL_FONT,size:P.LEGAL_SIZE,...extra});
    const para=(runs,extra={})=>({kind:'paragraph',runs,alignment:'left',left:0,first:0,right:0,above:0,below:6,line:1.15,...extra});
    const blocks=[para([run('WORDTOUDF DENEYSEL ÖZELLİK DENEMESİ',{bold:true,size:14})],{alignment:'center'}),
      para([run('Bu dosya yalnız UYAP Doküman Editörü\'nde görünümü denemek içindir; dilekçe değildir.')]),
      para([run('Aşağıdaki satırda '),run('bu sözcükler sarı vurgulu',{highlight:true}),run(' görünmelidir.')]),
      para([run('Vurgu ile birlikte '),run('kalın ve vurgulu',{highlight:true,bold:true}),run(' ve '),run('italik ve vurgulu',{highlight:true,italic:true}),run(' sözcükler.')]),
      para([run('Vurgu görünüyor ve dosya hatasız açılıyorsa bu özelliği kullanabilirsiniz; görünmüyorsa deneysel seçeneği kapatın.')])];
    try{const res=await P.toUdf(blocks,{});downloadBlob(res.bytes,'WordToUDF-deneme-vurgu.udf','application/octet-stream');message('Deneme UDF\'si indirildi; UYAP Doküman Editörü\'nde açıp sarı vurgunun göründüğünü kontrol edin.','success');}
    catch(err){message(`Deneme UDF\'si oluşturulamadı: ${err.message}`,'error');}
  });

  $('mbDownload').addEventListener('click',()=>download.click());
  $('mbPreview').addEventListener('click',()=>$('previewSection').scrollIntoView({behavior:'smooth',block:'start'}));

  // Offline web-app mode (outside the Chrome extension): cache the app files.
  if('serviceWorker' in navigator&&/^https?:$/u.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
  setReady();
})();
