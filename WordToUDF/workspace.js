(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const P=WordToUDFPipeline, S=WordToUDFSettings, L=WordToUDFLegalTypography;
  const state={file:null,source:null,result:null,selection:{start:'auto',end:'auto'},profile:'legal',loadSerial:0,settings:S.load(),fit:true};
  const fileInput=$('fileInput'),drop=$('dropZone'),status=$('status');
  const download=$('download'),downloadDocx=$('downloadDocx'),reportDownload=$('reportDownload'),review=$('review'),profileSelect=$('typographyProfile');
  function message(text,kind='') {status.textContent=text;status.className=`status ${kind}`;}
  function setReady(){
    const blocked=!state.source||!state.result||(state.source.warnings.length>0&&!review.checked);
    download.disabled=blocked;downloadDocx.disabled=blocked;
    reportDownload.disabled=!state.source||!state.result;
  }
  const safeName=s=>P.safeName(s);
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
      listMode:$('listMode').value,lineSpacing:Number($('lineSpacing').value),dateToday:$('dateToday').checked,markUets:$('markUets').checked,splitRequests:$('splitRequests').checked});
  }
  function writeForm(s){
    $('ownName').value=s.ownAttorney.name;$('ownUets').value=s.ownAttorney.uets;
    $('otherAttorney').checked=s.otherEnabled;$('otherBox').hidden=!s.otherEnabled;
    $('otherList').replaceChildren();for(const o of s.others)addOtherRow(o);
    $('listMode').value=s.listMode;$('lineSpacing').value=String(s.lineSpacing);$('dateToday').checked=s.dateToday;$('markUets').checked=s.markUets;$('splitRequests').checked=s.splitRequests;
    syncSpec();
  }
  function settingsChanged(){state.settings=readForm();S.save(state.settings);syncSpec();render();}
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
    const warningCount=source.warnings.length;
    $('colorNote').textContent='Doğrudan RGB ve çözümlenebilen Word tema renkleri aktarılır. Hukuk dilekçesi profilinde yazı tipi Times New Roman 12 pt\'dir.';
    if(!warningCount){const item=document.createElement('li');item.className='ok';item.textContent='Temel biçimlendirmeler için tespit edilen ek kayıp yok.';list.append(item);}
    for(const warning of source.warnings){const item=document.createElement('li');item.textContent=`${warning.message}${warning.count>1?` (${warning.count} bölüm)`:''}`;list.append(item);}
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
  const LEVEL_TEXT={error:'Hata',warn:'Uyarı',info:'Bilgi'};
  function showChecks(checks){
    const list=$('checkList');list.replaceChildren();
    $('checksPanel').hidden=!state.result;
    const counts={error:0,warn:0,info:0};
    for(const c of checks){
      counts[c.level]++;
      const li=document.createElement('li');li.className=`check-${c.level}`;li.dataset.code=c.code;
      const tag=document.createElement('strong');tag.textContent=`${LEVEL_TEXT[c.level]}: `;li.append(tag,document.createTextNode(c.message));
      if(c.code==='request-split'&&!$('splitRequests').checked){
        const btn=document.createElement('button');btn.type='button';btn.className='secondary inline-btn';btn.textContent='Maddelere ayır';
        btn.addEventListener('click',()=>{$('splitRequests').checked=true;settingsChanged();});li.append(' ',btn);
      }
      list.append(li);
    }
    $('checkStats').textContent=`${counts.error} hata · ${counts.warn} uyarı`;
    $('checkStats').className='pill'+(counts.error?' pill-error':counts.warn?' pill-warn':' pill-ok');
  }

  /* ------------------------------ preview ------------------------------ */
  function fitPaper(){
    const scale=WordToUDFPreview.fit($('previewViewport'),$('paperScale'),$('paper'),state.fit);
    $('zoomToggle').setAttribute('aria-pressed',String(state.fit));
    $('zoomToggle').textContent=state.fit?`Sığdır · %${Math.round(scale*100)}`:'Gerçek boyut';
  }
  function render(){
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
    WordToUDFPreview.render($('paper'),t.blocks,{margins:norm.margins,landscape:source.options.landscape,font:legal?P.LEGAL_FONT:source.options.font,size:legal?P.LEGAL_SIZE:source.options.size});
    fitPaper();
    editor.decorate();
    const ty=t.typography;
    const typeInfo=ty?.enabled?` · ${ty.metadataMerged||0} künye satırı birleştirildi · ${ty.resultItems||0} talep ve ${ty.attachments||0} ek numaralı listede · hukuk tipografisi etkin`:' · Word biçimi profili';
    $('sectionInfo').textContent=norm.selection.start<0?'AÇIKLAMALAR başlığı bulunamadı; gerekirse başlangıç başlığını seçin.':`${norm.bodyCount} gövde paragrafı ve ${norm.headingCount||0} ara başlık açıklamalar düzeninde işlendi${typeInfo}.`;
    $('previewCount').textContent=`${source.statistics.paragraphs} paragraf · A4 ${source.options.landscape?'yatay':'dikey'}`;
    setReady();
  }
  // Paragraph editor (editor-ui.js): tap a paragraph in the preview.
  const editor=WordToUDFEditorUI.attach({paper:$('paper'),toolbar:$('previewTools'),getBlocks:()=>state.result?.blocks,
    onChange:render,onMessage:m=>message(m,'success'),enabled:()=>!!state.result});

  /* ------------------------------ files ------------------------------ */
  async function handleFile(file){
    if(!file)return;
    if(!/\.docx$/iu.test(file.name)){message('Yalnız .docx uzantılı Word belgeleri desteklenmektedir.','error');return;}
    if(file.size<100||file.size>24*1024*1024){message('Dosya boş, hasarlı veya 24 MB sınırını aşıyor.','error');return;}
    const serial=++state.loadSerial;
    state.file=null;state.source=null;state.result=null;state.selection={start:'auto',end:'auto'};editor.reset();
    $('sectionPanel').hidden=true;$('reportPanel').hidden=true;$('checksPanel').hidden=true;$('paper').replaceChildren();
    review.checked=false;setReady();message('Belge yerel olarak okunuyor…');
    try{
      const source=await WordToUDFDocx.readDocx(await file.arrayBuffer());
      if(serial!==state.loadSerial)return;
      state.file=file;state.source=source;
      fillSelect('startSection',source.blocks,'auto');fillSelect('endSection',source.blocks,'auto');
      $('sectionPanel').hidden=false;$('reportPanel').hidden=false;
      $('fileStats').textContent=`${source.statistics.paragraphs} paragraf · ${source.statistics.tables} tablo`;
      showWarnings(source);render();
      message(`${file.name} okundu. Önizlemeyi, dilekçe denetimini ve varsa dönüşüm uyarılarını kontrol edin.`,'success');
    }catch(err){
      if(serial!==state.loadSerial)return;
      $('paper').replaceChildren();state.source=null;setReady();
      message(`DOCX açılamadı: ${err.message}`,'error');
    }
  }
  fileInput.addEventListener('change',e=>handleFile(e.target.files?.[0]));
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
    downloadBlob(new TextEncoder().encode(S.exportJson(readForm())),'wordtoudf-ayarlar.json','application/json');
    message('Ayarlar dışa aktarıldı. Dosyayı diğer cihazda "Ayarları içe aktar" ile açın.','success');
  });
  $('importSettings').addEventListener('change',async e=>{
    const f=e.target.files?.[0];if(!f)return;
    try{
      if(f.size>256*1024)throw new Error('Ayar dosyası çok büyük.');
      state.settings=S.importJson(await f.text());S.save(state.settings);writeForm(state.settings);render();
      message('Ayarlar içe aktarıldı.','success');
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
    const parts=[`Kaynak: ${state.file.name}`,'WORD → UDF DÖNÜŞÜM RAPORU','',`Paragraf sayısı: ${source.statistics.paragraphs}`,`Düz metne çevrilen tablo sayısı: ${source.statistics.tables}`,`Tipografi profili: ${state.profile==='legal'?'Hukuk dilekçesi':'Word biçimini koru'}`,`Birleştirilen künye satırı: ${norm?.typography?.metadataMerged||0}`];
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
    parts.push(...(source.warnings.length?source.warnings.map(w=>`- ${w.message} (${w.count})`):['- Tespit edilen ek biçim kaybı yok.']));
    parts.push('','UDF üzerinde UYAP Doküman Editörü ile son kontrol yapılmalıdır; UYAP kabulü bu eklenti tarafından test edilmemiştir.','Belge imzasızdır: görünen imza metni kriptografik e-imza değildir, UYAP\'ta yeniden imzalanmalıdır.');
    return parts.join('\n');
  }
  reportDownload.addEventListener('click',()=>{
    if(!state.source||!state.result)return;
    downloadBlob(new TextEncoder().encode(reportText()),safeName(state.file.name)+'-donusum-raporu.txt','text/plain;charset=utf-8');
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
      const fileName=state.file.name;
      const res=await P.toUdf(state.result.blocks,outputOptions());
      downloadBlob(res.bytes,safeName(fileName)+'.udf','application/octet-stream');
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
      const bytes=await WordToUDFDocxWriter.create({options:{margins:o.margins,landscape:o.landscape,font:o.font,size:o.size},blocks:state.result.blocks,headers:[],footers:[]});
      downloadBlob(bytes,safeName(state.file.name)+'-duzenlenmis.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      message('Düzenlenmiş Word belgesi indirildi (UDF ile aynı düzen).','success');
    }catch(err){message(`Word oluşturulamadı: ${err.message}`,'error');}
    finally{setReady();}
  });

  // Offline web-app mode (outside the Chrome extension): cache the app files.
  if('serviceWorker' in navigator&&/^https?:$/u.test(location.protocol))navigator.serviceWorker.register('sw.js').catch(()=>{});
  setReady();
})();
