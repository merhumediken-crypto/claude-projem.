(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const state={file:null,source:null,result:null,selection:{start:'auto',end:'auto'},profile:'legal',loadSerial:0};
  const ATTORNEY_KEY='wordtoudf.attorneys.v2';
  const LEGAL_FONT='Times New Roman';
  const UETS_RE=/^\d{5}-\d{5}-\d{5}$/u;
  // Per-browser convenience only: the attorney/UETS list never leaves this
  // computer and the extension still has no Chrome permissions.
  const storage={get(){try{return JSON.parse(localStorage.getItem(ATTORNEY_KEY)||'null');}catch{return null;}},set(v){try{localStorage.setItem(ATTORNEY_KEY,JSON.stringify(v));return true;}catch{return false;}}};
  const OWN=WordToUDFLegalTypography.SCHEMA.ownAttorney;
  const normUets=v=>String(v||'').replace(/\s+/gu,'').trim();
  function otherRows(){return [...$('otherList').querySelectorAll('.other-row')].map(row=>({name:row.querySelector('.o-name').value.trim(),uets:normUets(row.querySelector('.o-uets').value)}));}
  function attorneyState(){return {own:{name:$('ownName').value.trim(),uets:normUets($('ownUets').value)},otherEnabled:$('otherAttorney').checked,others:otherRows()};}
  function saveAttorneys(){storage.set(attorneyState());}
  // Only rows with a name AND a well-formed UETS go to the registry: an empty
  // UETS means "leave it blank", never "(UETS)" or a guessed number.
  function settings(){
    const a=attorneyState();
    const registry=a.otherEnabled?a.others.filter(o=>o.name&&UETS_RE.test(o.uets)):[];
    return {lineSpacing:Number($('lineSpacing').value)||1.5,dateMode:$('dateToday').checked?'today':'keep',markUets:$('markUets').checked,listMode:$('listMode').value==='auto'?'auto':'text',font:LEGAL_FONT,
      ownAttorney:a.own.name?{name:a.own.name,uets:a.own.uets}:null,uetsRegistry:registry};
  }
  function addOtherRow(data={}){
    const row=document.createElement('div');row.className='other-row';
    const name=document.createElement('input');name.type='text';name.className='o-name';name.placeholder='Av. Ad SOYAD';name.value=data.name||'';name.spellcheck=false;name.setAttribute('aria-label','Başka vekil adı');
    const uets=document.createElement('input');uets.type='text';uets.className='o-uets';uets.placeholder='UETS (boş bırakılabilir)';uets.value=data.uets||'';uets.inputMode='numeric';uets.spellcheck=false;uets.setAttribute('aria-label','Başka vekil UETS');
    const del=document.createElement('button');del.type='button';del.textContent='Sil';del.setAttribute('aria-label','Bu vekili sil');
    del.addEventListener('click',()=>{row.remove();saveAttorneys();render();});
    for(const el of [name,uets])el.addEventListener('change',()=>{saveAttorneys();render();});
    row.append(name,uets,del);$('otherList').append(row);return row;
  }
  function uetsWarnings(){
    const a=attorneyState(),bad=[];
    if(a.own.uets&&!UETS_RE.test(a.own.uets))bad.push('kendi UETS');
    if(a.otherEnabled)a.others.forEach((o,i)=>{if(o.uets&&!UETS_RE.test(o.uets))bad.push(`${i+1}. başka vekil`);});
    return bad.length?`Geçersiz UETS (${bad.join(', ')}) yok sayıldı. Biçim: 12345-12345-12345`:'';
  }
  const fileInput=$('fileInput'),drop=$('dropZone'),status=$('status');
  const download=$('download'),reportDownload=$('reportDownload'),review=$('review'),profileSelect=$('typographyProfile');
  function message(text,kind='') {status.textContent=text;status.className=`status ${kind}`;}
  function setReady(){
    download.disabled=!state.source||!state.result||(state.source.warnings.length>0&&!review.checked);
    reportDownload.disabled=!state.source||!state.result;
  }
  function safeName(s){return String(s||'Belge').replace(/\.docx$/i,'').normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu,'').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g,'_').replace(/\s+/g,' ').trim().replace(/[. ]+$/u,'').slice(0,90)||'Belge';}
  function downloadBlob(bytes,name,mime){
    const blob=new Blob([bytes],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=name;
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function labelFor(b,i){
    const value=globalThis.WordToUDFNormalize.flatten(b).replace(/\s+/g,' ').trim();
    return `${i+1}. ${value.slice(0,75)}${value.length>75?'…':''}`;
  }
  function fillSelect(id,blocks,current){
    const sel=$(id);sel.replaceChildren();
    const auto=new Option('Otomatik tanıma','auto');sel.add(auto);
    sel.add(new Option('Seçme / bölüm uygulanmasın','none'));
    for(let i=0;i<blocks.length;i++){
      if(blocks[i].kind==='paragraph')sel.add(new Option(labelFor(blocks[i],i),String(i)));
    }
    sel.value=current;
  }
  function showWarnings(source){
    const list=$('warningList');list.replaceChildren();
    const warningCount=source.warnings.length;
    $('colorNote').textContent='Doğrudan RGB ve çözümlenebilen Word tema renkleri aktarılır. Kullanılan yazı tipinin bilgisayarınızda yüklü olması görünümü etkileyebilir.';
    if(!warningCount){const item=document.createElement('li');item.className='ok';item.textContent='Temel biçimlendirmeler için tespit edilen ek kayıp yok.';list.append(item);}
    for(const warning of source.warnings){const item=document.createElement('li');item.textContent=`${warning.message}${warning.count>1?` (${warning.count} bölüm)`:''}`;list.append(item);}
    $('reviewLabel').hidden=!warningCount;
    review.checked=false;
    setReady();
  }
  const alpha=n=>{let out='';n=Math.max(1,Math.trunc(n));while(n){n--;out=String.fromCharCode(97+(n%26))+out;n=Math.floor(n/26);}return out;};
  function listMarker(list,listState){
    if(!list)return null;
    const key=`${list.kind}:${list.id}`,level=Math.max(0,Math.min(8,list.level||0));
    let counters=listState.get(key);if(!counters){counters=[];listState.set(key,counters);}
    counters.length=Math.min(counters.length,level+1);
    counters[level]=(counters[level]||0)+1;
    if(list.kind==='bullet')return '•';
    return `${list.format==='lowerLetter'?alpha(counters[level]):counters[level]}${list.suffix===')'?')':'.'}`;
  }
  const CHANGE_LABELS={label:'Etiket kısaltıldı','case-number':'Dosya/karar no tek etikette',surname:'Soyadı büyük harf','name-ambiguous':'Ad/soyad belirsiz','uets-profile':'UETS kayıtlı vekilden','attorney-fuse':'Vekil adres/UETS satırı birleşti','label-split':'Uzun etiket iki satıra bölündü','explanations-split':'AÇIKLAMALAR metni yeni paragrafta','section-inline':'Bölüm değeri başlık satırında','result-intro':'SONUÇ girişi','closing-split':'Kapanış listeden ayrıldı','closing-added':'Kapanış cümlesi eklendi','manual-number':'Metindeki numara otomatik listeye çevrildi',date:'Kapanış tarihi','blank-removed':'Boş satır kaldırıldı'};
  function changeText(c){return `${CHANGE_LABELS[c.type]||c.type}: ${c.before} → ${c.after}`;}
  function showChanges(stats){
    const list=$('changeList');list.replaceChildren();
    $('changesBlock').hidden=!stats?.enabled;
    if(!stats?.enabled)return;
    const changes=stats.changes||[];
    if(!changes.length){const li=document.createElement('li');li.className='ok';li.textContent='Metinde hukuk profiline bağlı değişiklik yapılmadı.';list.append(li);}
    for(const c of changes.slice(0,80)){const li=document.createElement('li');li.textContent=changeText(c);list.append(li);}
    if(changes.length>80){const li=document.createElement('li');li.textContent=`… ve ${changes.length-80} değişiklik daha (raporda tamamı).`;list.append(li);}
    $('uetsInfo').textContent=uetsWarnings();
  }
  function makeParagraph(block,listState=new Map()){
    const p=document.createElement('div');p.className='paragraph'+(block.source==='table'?' table-row':'');if(block.role)p.dataset.role=block.role;
    p.style.textAlign=block.alignment==='justify'?'justify':(block.alignment||'left');
    if(block.tabStops?.length)p.dataset.tabStops=JSON.stringify(block.tabStops);
    p.style.marginTop=`${Math.max(0,block.above||0)/.75}px`;
    p.style.marginBottom=`${Math.max(0,block.below||0)/.75}px`;
    if(Number.isFinite(block.first))p.style.textIndent=`${block.first/.75}px`;
    if(Number.isFinite(block.left))p.style.paddingLeft=`${Math.max(0,block.left)/.75}px`;
    if(Number.isFinite(block.right))p.style.paddingRight=`${Math.max(0,block.right)/.75}px`;
    if(Number.isFinite(block.line))p.style.lineHeight=String(block.line);
    const marker=listMarker(block.list,listState);
    if(marker!==null){
      // Real list number (not document text): drawn in the hanging column.
      const m=document.createElement('span');m.className='list-marker';m.textContent=marker;m.setAttribute('aria-hidden','true');
      m.style.width=`${Math.max(0,-(block.first||0))/.75}px`;p.append(m);p.dataset.list=`${block.list.id}`;
    }
    for(const run of block.runs){
      const parts=run.text.split('\t');
      for(let i=0;i<parts.length;i++){
        const span=document.createElement('span');
        span.textContent=parts[i];
        if(run.font)span.style.fontFamily=run.font;
        if(Number.isFinite(run.size))span.style.fontSize=`${run.size}pt`;
        if(run.color)span.style.color=`#${run.color}`;
        if(run.bold!==undefined)span.style.fontWeight=run.bold?'700':'400';
        if(run.italic!==undefined)span.style.fontStyle=run.italic?'italic':'normal';
        const deco=[];if(run.underline)deco.push('underline');if(run.strike)deco.push('line-through');
        if(run.underline===false||run.strike===false||deco.length)span.style.textDecoration=deco.length?deco.join(' '):'none';
        if(parts[i])p.append(span);
        if(i<parts.length-1){
          const tab=document.createElement('span');
          tab.className='tab-stop'+(run.underline?' underlined':'');
          tab.textContent='\t';
          if(run.color)tab.style.color=`#${run.color}`;
          p.append(tab);
        }
      }
    }
    return p;
  }
  function positionTabs(paper){
    for(const p of paper.querySelectorAll('.paragraph[data-tab-stops]')){
      const tabs=JSON.parse(p.dataset.tabStops||'[]');
      // Match the export's custom TabSet in the preview. DOM pixel widths
      // are measured only after the new page has been attached to the tree.
      // Tab positions are measured from the paragraph box (page margin), as in
      // Word, so a hanging list number "1.<TAB>" lands on the indent.
      const rowLeft=p.getBoundingClientRect().left;
      for(const tab of p.querySelectorAll('.tab-stop')){
        let x=tab.getBoundingClientRect().left-rowLeft;
        const target=tabs.find(t=>t.pos*(96/72)>x+1);
        const width=target?target.pos*(96/72)-x:24;
        tab.style.width=`${Math.max(4,Math.min(2500,width))}px`;
        tab.textContent='';
      }
    }
  }
  function render(){
    if(!state.source)return;
    const source=state.source;
    state.result=null;
    let norm;
    const opts=settings();
    try{norm=WordToUDFNormalize.apply(source.blocks,state.selection,{preserveFormatting:state.profile==='faithful',sourceMargins:source.options.margins,lineSpacing:opts.lineSpacing});}
    catch(err){message(err.message,'error');setReady();return;}
    let profile;
    try{profile=WordToUDFLegalTypography.apply(norm.blocks,{enabled:state.profile==='legal',selection:norm.selection,now:new Date(),...opts});}
    catch(err){message(`Hukuk tipografisi uygulanamadı: ${err.message}`,'error');setReady();return;}
    state.result={...norm,blocks:profile.blocks,typography:profile.statistics};
    $('sectionPanel').hidden=state.profile==='faithful';
    $('legalOptions').hidden=state.profile==='faithful';
    showChanges(profile.statistics);
    const paper=$('paper');paper.replaceChildren();
    paper.style.width=source.options.landscape?'1123px':'794px';
    paper.style.minHeight=source.options.landscape?'794px':'1123px';
    for(const side of ['top','right','bottom','left'])paper.style[`padding${side[0].toUpperCase()+side.slice(1)}`]=`${state.result.margins[side]*96/72}px`;
    paper.style.fontFamily=state.profile==='legal'?LEGAL_FONT:source.options.font;paper.style.fontSize=`${state.profile==='legal'?12:source.options.size}pt`;
    const frag=document.createDocumentFragment();
    const max=state.result.blocks.length,listState=new Map();
    for(let i=0;i<max;i++){
      const block=state.result.blocks[i];
      if(block.kind==='page-break'){const line=document.createElement('div');line.className='page-break';line.setAttribute('aria-label','Sayfa sonu');frag.append(line);}
      else frag.append(makeParagraph(block,listState));
    }
    paper.append(frag);
    positionTabs(paper);
    const t=state.result.typography;
    const typeInfo=t?.enabled?` · ${t.metadataMerged||0} künye satırı birleştirildi · ${t.resultItems||0} talep ve ${t.attachments||0} ek otomatik listede · hukuk tipografisi etkin`:' · Word biçimi profili';
    const courtWarning=t?.enabled&&!t.roles?.['court-heading']?' · Uyarı: mahkeme/makam başlığı tanınmadı; başlığın biçimini önizlemede kontrol edin.':'';
    $('sectionInfo').textContent=(norm.selection.start<0?'AÇIKLAMALAR başlığı bulunamadı; gerekirse başlangıç başlığını seçin.':`${norm.bodyCount} gövde paragrafı ve ${norm.headingCount||0} ara başlık açıklamalar düzeninde işlendi${typeInfo}.`)+courtWarning;
    $('previewCount').textContent=`${source.statistics.paragraphs} paragraf · A4 ${source.options.landscape?'yatay':'dikey'}`;
    setReady();
  }
  async function handleFile(file){
    if(!file)return;
    if(!/\.docx$/iu.test(file.name)){message('Yalnız .docx uzantılı Word belgeleri desteklenmektedir.','error');return;}
    if(file.size<100||file.size>24*1024*1024){message('Dosya boş, hasarlı veya 24 MB sınırını aşıyor.','error');return;}
    const serial=++state.loadSerial;
    state.file=null;state.source=null;state.result=null;state.selection={start:'auto',end:'auto'};
    $('sectionPanel').hidden=true;$('reportPanel').hidden=true;$('paper').replaceChildren();
    review.checked=false;setReady();message('Belge yerel olarak okunuyor…');
    try{
      const source=await WordToUDFDocx.readDocx(await file.arrayBuffer());
      if(serial!==state.loadSerial)return;
      state.file=file;state.source=source;
      fillSelect('startSection',source.blocks,'auto');fillSelect('endSection',source.blocks,'auto');
      $('sectionPanel').hidden=false;$('reportPanel').hidden=false;
      $('fileStats').textContent=`${source.statistics.paragraphs} paragraf · ${source.statistics.tables} tablo`;
      showWarnings(source);render();
      message(`${file.name} okundu. Önizlemeyi ve varsa dönüşüm uyarılarını denetleyin.`,'success');
    }catch(err){
      if(serial!==state.loadSerial)return;
      $('paper').replaceChildren();state.source=null;setReady();
      message(`DOCX açılamadı: ${err.message}`,'error');
    }
  }
  fileInput.addEventListener('change',e=>handleFile(e.target.files?.[0]));
  for(const name of ['dragover','dragenter'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.add('drag');});
  for(const name of ['dragleave','drop'])drop.addEventListener(name,e=>{e.preventDefault();drop.classList.remove('drag');});
  drop.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length)handleFile(e.dataTransfer.files[0]);});
  review.addEventListener('change',setReady);
  const saved=storage.get();
  $('ownName').value=saved?.own?.name??OWN.name;$('ownUets').value=saved?.own?.uets??OWN.uets;
  $('otherAttorney').checked=!!saved?.otherEnabled;$('otherBox').hidden=!$('otherAttorney').checked;
  for(const o of saved?.others||[])addOtherRow(o);
  const syncSpec=()=>{$('specLine').textContent=`${$('lineSpacing').value==='1'?'1,0':'1,5'} · iki yana yaslı`;};
  for(const id of ['lineSpacing','dateToday','markUets','listMode'])$(id).addEventListener('change',()=>{syncSpec();render();});
  for(const id of ['ownName','ownUets'])$(id).addEventListener('change',()=>{saveAttorneys();render();});
  $('otherAttorney').addEventListener('change',()=>{
    $('otherBox').hidden=!$('otherAttorney').checked;
    if($('otherAttorney').checked&&!$('otherList').children.length)addOtherRow().querySelector('.o-name').focus();
    saveAttorneys();render();
  });
  $('addAttorney').addEventListener('click',()=>{addOtherRow().querySelector('.o-name').focus();saveAttorneys();});
  profileSelect.addEventListener('change',e=>{state.profile=e.target.value==='faithful'?'faithful':'legal';render();});
  $('startSection').addEventListener('change',e=>{state.selection.start=e.target.value;render();});
  $('endSection').addEventListener('change',e=>{state.selection.end=e.target.value;render();});
  reportDownload.addEventListener('click',()=>{
    if(!state.source)return;
    const source=state.source,norm=state.result;
    const parts=[`Kaynak: ${state.file.name}`,'WORD → UDF DÖNÜŞÜM RAPORU','',`Paragraf sayısı: ${source.statistics.paragraphs}`,`Düz metne çevrilen tablo sayısı: ${source.statistics.tables}`,`Tipografi profili: ${state.profile==='legal'?'Hukuk dilekçesi':'Word biçimini koru'}`,`Birleştirilen künye satırı: ${norm?.typography?.metadataMerged||0}`];
    if(state.profile==='legal'){
      const t=norm.typography||{},ls=String(t.lineSpacing??1.5).replace('.',',');
      parts.push('Sayfa kenar boşlukları: 1,5 cm',`Açıklamalar gövdesi: ${norm.bodyCount} paragraf`,`Açıklamalar ara başlığı: ${norm.headingCount||0}`,'AÇIKLAMALAR öncesi ve başlıklar: 0 pt / 0 pt','AÇIKLAMALAR gövdesi paragraf önce/sonra: 0,15 cm / 0,15 cm','AÇIKLAMALAR sonrası paragraf önce/sonra: 0 pt / 0 pt',`AÇIKLAMALAR: 1,25 cm ilk satır, ${ls} satır aralığı, iki yana yaslama (1.3.2 sürümünde 1,0 idi)`,
        `Ortak iki nokta sekme durağı: ${(t.colonTabPt||0).toFixed(2)} pt (${((t.colonTabPt||0)*2.54/72).toFixed(2)} cm); etiket ve iki nokta kalın-altı çizili, değer normal, devam satırı girintisiz`,
        `SONUÇ talepleri: ${t.resultItems||0} madde, ${$('listMode').value==='auto'?'gerçek otomatik liste (ListId 1)':'metin numarası + sekme'}`,`EKLER: ${t.attachments||0} madde, ${$('listMode').value==='auto'?'ayrı otomatik liste (ListId 2)':'ayrı numaralı liste'}`,`Yazı karakteri: ${LEGAL_FONT}`,
        `Kapanış: ${t.closing||'—'}`,`Kapanış tarihi: ${t.date||'kaynaktaki gibi bırakıldı'}`);
      parts.push('','Hukuk profilinin yaptığı metin değişiklikleri:');
      parts.push(...((t.changes||[]).length?t.changes.map(c=>`- ${changeText(c)}`):['- Yok']));
      const integ=t.integrity||{removed:[],added:[]};
      parts.push('','Metin bütünlüğü denetimi (sözcük karşılaştırması; yukarıdaki değişikliklerle açıklanmalıdır):',`- Kaynakta olup çıktıda azalan sözcükler: ${integ.removed.join(', ')||'yok'}`,`- Çıktıya eklenen sözcükler: ${integ.added.join(', ')||'yok'}`);
    }
    else parts.push('Sayfa kenar boşlukları: Word kaynağı (varsa)','Paragraf hizalama, girinti, satır aralığı ve önce/sonra boşlukları: Word kaynağından korunur.');
    parts.push('','Dönüşüm uyarıları:');
    parts.push(...(source.warnings.length?source.warnings.map(w=>`- ${w.message} (${w.count})`):['- Tespit edilen ek biçim kaybı yok.']));
    parts.push('','UDF üzerinde UYAP Doküman Editörü ile son kontrol yapılmalıdır; UYAP kabulü bu eklenti tarafından test edilmemiştir.','Belge imzasızdır: görünen imza metni kriptografik e-imza değildir, UYAP\'ta yeniden imzalanmalıdır.','Gerçek otomatik liste (Numbered/ListId) öznitelikleri UYAP Doküman Editörü\'nde ayrıca denetlenmelidir.');
    downloadBlob(new TextEncoder().encode(parts.join('\n')),safeName(state.file.name)+'-donusum-raporu.txt','text/plain;charset=utf-8');
  });
  download.addEventListener('click',async()=>{
    if(!state.source||!state.result||download.disabled)return;
    // Re-render so the closing date is the date of generation, not of preview.
    if(state.profile==='legal')render();
    if(!state.result)return;
    download.disabled=true;message('UDF oluşturuluyor ve içeriği doğrulanıyor…');
    try{
      const {blocks,margins}=state.result;const {landscape}=state.source.options;const fileName=state.file.name;
      const font=state.profile==='legal'?LEGAL_FONT:state.source.options.font;
      const size=state.profile==='legal'?12:state.source.options.size;
      const writer=WordToUDFWriter.write(blocks,{margins,font,size,landscape});
      const checked=WordToUDFWriter.verify(writer.xml,writer.fullText);
      const bytes=await WordToUDFZip.makeZip('content.xml',writer.xml);
      const zip=WordToUDFZip.openZip(bytes);
      if(zip.names.length!==1||!zip.has('content.xml'))throw new Error('UDF ZIP dosya listesi doğrulanamadı.');
      const unpacked=await zip.text('content.xml');
      WordToUDFWriter.verify(unpacked,writer.fullText);
      downloadBlob(bytes,safeName(fileName)+'.udf','application/octet-stream');
      message(`UDF hazır: ${writer.paragraphs} paragraf, ${checked.lists} liste maddesi, ${writer.breaks} sayfa sonu. İndirilen dosyayı UYAP'ta denetleyin.`,'success');
    }catch(err){message(`Dönüştürme başarısız: ${err.message}`,'error');}
    finally{setReady();}
  });
  setReady();
})();
