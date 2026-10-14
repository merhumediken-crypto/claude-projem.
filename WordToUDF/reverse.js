/* Read-only UDF conversion UI. Does NOT invoke Word→UDF normalization. */
(() => {
 'use strict';
 const $=x=>document.getElementById(x);
 const state={source:null,file:null};
 const fileInput=$('fileInput'),status=$('status');
 const say=(str,kind='')=>{status.textContent=str;status.className=`status ${kind}`;};
 const safeName=name=>String(name||'Belge').replace(/\.udf$/i,'').normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu,'').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g,'_').replace(/\s+/g,' ').trim().replace(/[. ]+$/u,'').slice(0,90)||'Belge';
 const downloadBlob=(bytes,name,mime)=>{const url=URL.createObjectURL(new Blob([bytes],{type:mime}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
 const ready=()=>{const ok=!!state.source;$('downloadWord').disabled=!ok;$('printPdf').disabled=!ok;};

 const alpha=(n,upper=false)=>{let out='';n=Math.max(1,Math.trunc(n));while(n){n--;out=String.fromCharCode((upper?65:97)+(n%26))+out;n=Math.floor(n/26);}return out;};
 const roman=(n,upper=false)=>{n=Math.max(1,Math.min(3999,Math.trunc(n)));const pairs=[[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];let out='';for(const [v,s] of pairs)while(n>=v){out+=s;n-=v;}return upper?out:out.toLowerCase();};
 const formatListNumber=(n,fmt)=>fmt==='lowerLetter'?alpha(n,false):fmt==='upperLetter'?alpha(n,true):fmt==='lowerRoman'?roman(n,false):fmt==='upperRoman'?roman(n,true):String(n);
 function listMarker(list,state){
  if(!list)return null;
  if(list.kind==='bullet')return list.symbol||'•';
  const key=`${list.kind}:${list.id}`,level=Math.max(0,Math.min(8,list.level||0));
  let counters=state.get(key);if(!counters){counters=[];state.set(key,counters);}
  counters.length=Math.min(counters.length,level+1);
  counters[level]=(Number.isFinite(counters[level])?counters[level]:0)+1;
  return `${formatListNumber(counters[level],list.format)}${list.suffix===')'?')':'.'}`;
 }
 function paragraph(b,listState){
  const p=document.createElement('div');p.className='paragraph';
  p.style.textAlign=b.alignment||'left';
  if(Number.isFinite(b.above))p.style.marginTop=`${b.above}pt`;
  if(Number.isFinite(b.below))p.style.marginBottom=`${b.below}pt`;
  if(Number.isFinite(b.first))p.style.textIndent=`${b.first}pt`;
  if(Number.isFinite(b.left))p.style.paddingLeft=`${b.left}pt`;
  if(Number.isFinite(b.right))p.style.paddingRight=`${b.right}pt`;
  if(Number.isFinite(b.line))p.style.lineHeight=String(b.line);
  if(b.tabStops?.length)p.dataset.tabStops=JSON.stringify(b.tabStops);
  const marker=listMarker(b.list,listState);
  if(marker!==null){const m=document.createElement('span');m.className='list-marker';m.textContent=marker;m.setAttribute('aria-hidden','true');p.append(m);}
  for(const run of b.runs){
   const pieces=run.text.split('\t');
   for(let i=0;i<pieces.length;i++){
    if(pieces[i]){
     const span=document.createElement('span');span.textContent=pieces[i];
     if(run.font)span.style.fontFamily=run.font;
     if(Number.isFinite(run.size))span.style.fontSize=`${run.size}pt`;
     if(run.color)span.style.color=`#${run.color}`;
     if(run.background)span.style.backgroundColor=`#${run.background}`;
     if(run.bold!==undefined)span.style.fontWeight=run.bold?'700':'400';
     if(run.italic!==undefined)span.style.fontStyle=run.italic?'italic':'normal';
     const deco=[];if(run.underline)deco.push('underline');if(run.strike)deco.push('line-through');
     if(run.underline!==undefined||run.strike!==undefined)span.style.textDecoration=deco.join(' ')||'none';
     p.append(span);
    }
    if(i<pieces.length-1){const tab=document.createElement('span');tab.className='tab-stop'+(run.underline?' underlined':'');tab.textContent='\t';if(run.color)tab.style.color=`#${run.color}`;if(run.background)tab.style.backgroundColor=`#${run.background}`;p.append(tab);}
   }
  }
  return p;
 }
 function blocksNode(blocks,listState=new Map()){
  const fragment=document.createDocumentFragment();
  for(const b of blocks){
   if(b.kind==='page-break'){
    const br=document.createElement('div');br.className='page-break';fragment.append(br);
   }else if(b.kind==='table'){
    const table=document.createElement('table');table.className='udf-table';
    const tbody=document.createElement('tbody');
    for(const row of b.rows){
     const tr=document.createElement('tr');
     if(Number.isFinite(row.height)&&row.height>0)tr.style.minHeight=`${row.height}pt`;
     for(const cell of row.cells){const td=document.createElement('td');td.append(blocksNode(cell.blocks,listState));tr.append(td);}
     tbody.append(tr);
    }
    table.append(tbody);fragment.append(table);
   }else fragment.append(paragraph(b,listState));
  }
  return fragment;
 }
 function positionTabs(root){
  for(const p of root.querySelectorAll('.paragraph[data-tab-stops]')){
   const stops=JSON.parse(p.dataset.tabStops||'[]');
   const left=p.getBoundingClientRect().left+(parseFloat(getComputedStyle(p).paddingLeft)||0);
   for(const tab of p.querySelectorAll('.tab-stop')){
    const offset=tab.getBoundingClientRect().left-left;
    const stop=stops.find(x=>x.pos*(96/72)>offset+1);
    const width=stop?stop.pos*(96/72)-offset:24;
    tab.style.width=`${Math.max(4,Math.min(width,2500))}px`;tab.textContent='';
   }
  }
 }
 function preview(source){
  const paper=$('paper');paper.replaceChildren();
  paper.style.width=source.options.landscape?'1123px':'794px';
  paper.style.minHeight=source.options.landscape?'794px':'1123px';
  paper.style.paddingTop=`${source.options.margins.top*96/72}px`;
  paper.style.paddingRight=`${source.options.margins.right*96/72}px`;
  paper.style.paddingBottom=`${source.options.margins.bottom*96/72}px`;
  paper.style.paddingLeft=`${source.options.margins.left*96/72}px`;
  paper.style.fontFamily=source.options.font;
  paper.style.fontSize=`${source.options.size}pt`;
  if(source.headers.length){const header=document.createElement('div');header.className='preview-header';header.append(blocksNode(source.headers,new Map()));paper.append(header);}
  paper.append(blocksNode(source.blocks,new Map()));
  if(source.footers.length){const footer=document.createElement('div');footer.className='preview-footer';footer.append(blocksNode(source.footers,new Map()));paper.append(footer);}
  positionTabs(paper);
  $('previewCount').textContent=`${source.statistics.paragraphs} paragraf · ${source.statistics.tableRows||0} tablo satırı · A4 ${source.options.landscape?'yatay':'dikey'}`;
 }
 function printDOM(source){
  for(const [id,blocks] of [['printBody',source.blocks],['printHeader',source.headers],['printFooter',source.footers]]){
   const node=$(id);node.replaceChildren();node.append(blocksNode(blocks,new Map()));node.style.fontFamily=source.options.font;node.style.fontSize=`${source.options.size}pt`;
  }
  const {margins:m,landscape,headerOffset,footerOffset}=source.options;
  for(const style of document.styleSheets){
   for(const rule of style.cssRules){
    if(rule.type===CSSRule.PAGE_RULE){
     rule.style.setProperty('size',landscape?'A4 landscape':'A4 portrait');
     rule.style.setProperty('margin',`${m.top}pt ${m.right}pt ${m.bottom}pt ${m.left}pt`);
    }
   }
  }
  const topDistance=Number.isFinite(headerOffset)?headerOffset:20;
  const bottomDistance=Number.isFinite(footerOffset)?footerOffset:20;
  $('printHeader').style.top=`${-(m.top-topDistance)}pt`;
  $('printFooter').style.bottom='0pt';
  // Position tabs against a measured A4 text column before print media starts.
  // A display:none tree has zero rectangles and loses the source TabSet.
  const surf=$('printSurface');
  surf.style.display='block';surf.style.position='absolute';surf.style.left='-100000px';
  surf.style.visibility='hidden';surf.style.width=`${(595.28-m.left-m.right)*(96/72)}px`;
  try{positionTabs(surf);}finally{
   surf.style.display='';surf.style.position='';surf.style.left='';surf.style.visibility='';surf.style.width='';
  }
 }
 async function handle(file){
  if(!file)return;
  state.source=null;state.file=null;$('reportPanel').hidden=true;$('paper').replaceChildren();ready();
  if(!/\.udf$/iu.test(file.name)){say('Lütfen .udf dosyası seçin.','error');return;}
  if(file.size<80||file.size>24*1024*1024){say('UDF dosyası boş, hasarlı veya 24 MB sınırını aşıyor.','error');return;}
  say('UDF arşivi ve içerik ofsetleri doğrulanıyor…');
  try{
   const source=await WordToUDFReader.readUdf(await file.arrayBuffer());
   state.source=source;state.file=file;preview(source);$('reportPanel').hidden=false;
   $('fileStats').textContent=`${source.statistics.paragraphs} paragraf · ${source.statistics.characters} karakter`;
   const list=$('warningList');list.replaceChildren();
   if(!source.warnings.length){const li=document.createElement('li');li.className='ok';li.textContent='Desteklenmeyen öğe tespit edilmedi.';list.append(li);}
   for(const w of source.warnings){const li=document.createElement('li');li.textContent=w.message;list.append(li);}
   $('sourceNote').textContent=source.warnings.length?'Bazı UDF özelliklerinin birebir Word/PDF karşılığı yok. Bunlar uyarı olarak listelendi; okunabilen metin ve desteklenen biçimler yine dışa aktarılabilir.':'Metin ve tanımlı biçimler okundu; farklı dizgi motorlarında sayfalama değişebilir.';
   ready();say(source.warnings.length?'UDF okundu. Uyarılar dışa aktarmayı engellemez; Word/PDF oluşturabilirsiniz.':'UDF okundu. Word indirme ve PDF olarak kaydetme kullanılabilir.','success');
  }catch(err){state.source=null;ready();say(`UDF açılamadı: ${err.message}`,'error');}
 }
 fileInput.addEventListener('change',e=>handle(e.target.files?.[0]));
 const drop=$('dropZone');for(const e of ['dragover','dragenter'])drop.addEventListener(e,x=>{x.preventDefault();drop.classList.add('drag');});
 for(const e of ['dragleave','drop'])drop.addEventListener(e,x=>{x.preventDefault();drop.classList.remove('drag');});
 drop.addEventListener('drop',e=>{if(e.dataTransfer?.files?.length)handle(e.dataTransfer.files[0]);});
 $('downloadWord').addEventListener('click',async()=>{
  if(!state.source)return;
  $('downloadWord').disabled=true;say('Word dosyası hazırlanıyor ve ZIP bütünlüğü doğrulanıyor…');
  try{const bytes=await WordToUDFDocxWriter.create(state.source);downloadBlob(bytes,safeName(state.file.name)+'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document');say('Word dosyası indirildi. Belgeyi açıp sayfa düzenini kontrol edin.','success');}
  catch(e){say(`DOCX dönüştürme başarısız: ${e.message}`,'error');}finally{ready();}
 });
 $('printPdf').addEventListener('click',()=>{
  if(!state.source)return;
  try{printDOM(state.source);say('Yazdır penceresinde hedefi “PDF olarak kaydet” seçin.','success');window.print();}
  catch(e){say(`PDF yazdırma hatası: ${e.message}`,'error');}
 });
 ready();
})();
