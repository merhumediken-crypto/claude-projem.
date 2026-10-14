/* Run from package root: node tests/logic.test.js. No dependencies.
 *
 * v1.4.0: the 23 v1.3.2 regressions are kept. Seven of them asserted the old
 * künye layout (separate KARAR NO label, 199 pt hanging indent, colon without
 * underline, "DAVACI:" left untouched). The user's final petition standard
 * replaces exactly those expectations; each revised test says "REVİZE" and
 * names the WTU rule that changed it. New tests are named after WTU-xxx ids.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ctx=vm.createContext({Intl,Date});
for(const name of ['normalize.js','settings.js','legal-rules.js','legal-typography.js','edits.js','checks.js','udf.js','templates.js','paste.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const normal=ctx.WordToUDFNormalize, legal=ctx.WordToUDFLegalTypography, writer=ctx.WordToUDFWriter, checks=ctx.WordToUDFChecks, settingsApi=ctx.WordToUDFSettings, tpl=ctx.WordToUDFTemplates, edits=ctx.WordToUDFEdits, paste=ctx.WordToUDFPaste;
const para=(text,attributes={})=>({kind:'paragraph',runs:[{text}],...attributes});
const text=b=>b.runs.map(r=>r.text).join('');
const arr=x=>[...x];
const NOW=new Date('2026-10-14T09:00:00Z');
const COLON=Math.round(6*72/2.54*100)/100;
// v1.4.1: default list mode is 'text' (visible 1.<TAB>); the real-list tests run with listMode 'auto'.
const run=(items,opts={})=>{const n=normal.apply(items.map(x=>typeof x==='string'?para(x):x));return legal.apply(n.blocks,{selection:n.selection,now:NOW,listMode:'auto',...opts});};
const runText=(items,opts={})=>run(items,{listMode:'text',...opts});
const find=(blocks,re)=>blocks.find(b=>re.test(text(b)));
let count=0,failed=0;
function test(name,fn){try{fn();console.log('PASS',name);count++;}catch(e){failed++;console.error('FAIL',name);console.error(e.message);}}

/* ----------------------------- v1.3.2 regresyonları ----------------------------- */
test('mahkeme başlığında ortalama kalınlık ve alt çizgisizlik',()=>{
  const b=legal.apply([para('T.C.'),para('ŞANLIURFA 1. ASLİYE HUKUK MAHKEMESİNE',{alignment:'right',runs:[{text:'ŞANLIURFA 1. ASLİYE HUKUK MAHKEMESİNE',underline:true}]})]).blocks[1];
  assert.equal(b.role,'court-heading');assert.equal(b.alignment,'center');assert.equal(b.runs[0].underline,false);assert.equal(b.runs[0].size,14);
});
test('ardışık künye etiketleri yanlış birleştirilmez (REVİZE WTU-024: boş etiket de ortak sekmeli)',()=>{
  const input=[para('DAVACI:'),para('DAVALI: Karşı taraf'),para('AÇIKLAMALAR')];
  const res=legal.apply(input).blocks;
  assert.equal(text(res[0]),'DAVACI\t:');assert.equal(text(res[1]),'DAVALI\t: Karşı taraf');assert.equal(res.length,3);
});
test('tek başına künye etiketi doğru değeriyle birleştirilir',()=>{
  const res=legal.apply([para('DAVACI:'),para('Ahmet K.'),para('AÇIKLAMALAR')]);
  assert.equal(res.statistics.metadataMerged,1);assert.equal(text(res.blocks[0]),'DAVACI\t: Ahmet K.');
});
test('künye alanındaki değer normal, etiket ve iki nokta kalın (REVİZE WTU-026/027: ":" ayrı run, boşluk değerde)',()=>{
  const res=legal.apply([{kind:'paragraph',runs:[{text:'DAVACI: '},{text:'Ali',italic:true},{text:' Veli',bold:true}]},para('AÇIKLAMALAR')]);
  const r=res.blocks[0].runs;
  assert(r.some(x=>x.text===' Ali VELİ' && x.bold===false));assert.equal(r.find(x=>x.text===':').bold,true);
});
test('künye devamı girintisiz, ortak sekmeli satır (REVİZE WTU-028: 199 pt asılı girinti kaldırıldı)',()=>{
  const res=legal.apply([para('DAVACI: Ahmet K.'),para('Adres: X Sokak'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(res[1].role,'metadata');assert.equal(res[1].left,0);assert.equal(res[1].first,0);assert.equal(res[1].tabStops[0].pos,COLON);
});
test('imza sadece gerçek kapanış sonrası sağa geçer',()=>{
  const items=['DAVACI: Ali','VEKİLİ: Av. Fatih Nakışlı','AÇIKLAMALAR','Av. Fatih Nakışlı toplantıya katıldı.','SONUÇ VE İSTEM','1. Kabulüne karar verilmesini talep ederim.','Av. Fatih Nakışlı','EKLER','EK-1 Karar'];
  const res=legal.apply(items.map(para),{now:NOW}).blocks;
  assert.notEqual(res[1].role,'signature');
  assert.notEqual(find(res,/toplantıya/).role,'signature');
  const sig=res.find(b=>text(b)==='Av. Fatih NAKIŞLI');
  assert.equal(sig.role,'signature');assert.equal(sig.alignment,'right');
});
test('imza diye uzun cümleyi sağa taşımaz',()=>{
  const items=['SONUÇ VE İSTEM','Karar verilmesini talep ederim.','Av. Fatih tarafından hazırlanan tüm belgeler tekrar değerlendirildi.'];
  const res=legal.apply(items.map(para),{now:NOW}).blocks;
  assert.notEqual(find(res,/hazırlanan/).role,'signature');
});
test('Word biçimini koru aynı paragraf niteliklerini tutar',()=>{
  const items=[para('AÇIKLAMALAR'),para('Örnek içerik',{alignment:'center',above:20,below:10,first:4,line:1.5})];
  const out=normal.apply(items,{}, {preserveFormatting:true,sourceMargins:{left:70,top:65,right:70,bottom:55}});
  assert.equal(out.blocks[1].alignment,'center');assert.equal(out.blocks[1].first,4);assert.equal(out.blocks[1].line,1.5);assert.equal(out.margins.left,70);
});
test('hukuk profili açıklamalarını ayarlar',()=>{
  const out=normal.apply([para('AÇIKLAMALAR'),para('Paragraf'),para('SONUÇ VE İSTEM')]);
  assert.equal(out.blocks[1].alignment,'justify');assert(Math.abs(out.blocks[1].first-35.433)<.01);assert(Math.abs(out.blocks[1].above-4.252)<.01);assert.equal(out.blocks[2].above,0);
});
test('roma rakamı ara başlık girintilenmez',()=>{
  const out=normal.apply([para('AÇIKLAMALAR'),para('I. TEMEL AÇIKLAMALAR'),para('Gövde'),para('SONUÇ VE İSTEM')]);
  assert.equal(out.blocks[1].first,0);assert.equal(out.blocks[1].alignment,'left');assert(out.blocks[2].first>35);
});
test('AÇIKLAMALARIMIZ alternatif başlığı tanınır',()=>{
  const items=[para('AÇIKLAMALARIMIZ'),para('Gövde'),para('SONUÇ VE TALEP')];
  assert.equal(normal.detection(items).start,0);assert.equal(legal.apply(items).blocks[0].role,'major-heading');assert.equal(legal.apply(items).blocks[1].role,'explanation-body');
});
test('tablodaki AÇIKLAMALAR metni sınır başlığı sayılmaz',()=>{
  const items=[para('AÇIKLAMALAR',{source:'table'}),para('Gövde')];
  assert.equal(normal.detection(items).start,-1);
});
test('karar künyesi birden fazla run üzerinde kalın italiktir',()=>{
  const items=[para('AÇIKLAMALAR'),{kind:'paragraph',runs:[{text:'Yargıtay 3.'},{text:' Hukuk Dairesi 2025/5112 E., '},{text:'2026/3190 K.'}]},para('SONUÇ VE İSTEM')];
  const r=legal.apply(items,{now:NOW}).blocks[1].runs;
  assert.equal(r.length,3);assert(r.every(x=>x.bold&&x.italic));
});
test('kanun atfı run sınırları boyunca italiktir',()=>{
  const items=[para('AÇIKLAMALAR'),{kind:'paragraph',runs:[{text:'HMK '},{text:'m. 119',bold:true},{text:' hükmü uygulanır.'}]},para('SONUÇ VE İSTEM')];
  const result=legal.apply(items,{now:NOW}).blocks[1].runs;
  const italic=result.filter(r=>r.italic).map(r=>r.text).join('');
  assert(italic.includes('HMK m. 119'));
});
test('sonuç maddesi asılı girinti alır',()=>{
  const items=[para('SONUÇ VE İSTEM'),para('1. Mahkemenizce karar verilmesini talep ederim.')];
  const item=legal.apply(items,{now:NOW}).blocks[1];assert.equal(item.role,'result-item');assert.equal(item.left,18);assert.equal(item.first,-18);
});
test('kaynak girdi mutasyona uğramaz',()=>{
  const original=[para('DAVACI: Kişi',{runs:[{text:'DAVACI: Kişi',bold:false}]}),para('AÇIKLAMALAR'),para('SONUÇ VE İSTEM'),para('1. Kabulüne,')];const before=JSON.stringify(original);
  legal.apply(normal.apply(original).blocks,{now:NOW});assert.equal(JSON.stringify(original),before);
});
test('kapanış olmayan anlatımda avukat imza sayılmaz',()=>{
  const items=[para('AÇIKLAMALAR'),para('Av. Fatih Nakışlı'),para('SONUÇ VE İSTEM')];
  assert.notEqual(legal.apply(items,{now:NOW}).blocks[1].role,'signature');
});
test('dosya no + karar no tek DOSYA NO etiketi (REVİZE WTU-022: ikinci KARAR NO etiketi yok)',()=>{
  const r=legal.apply([para('DOSYA NO: 2026/713 D. İş'),para('KARAR NO: 2026/708'),para('AÇIKLAMALAR')]);
  assert.equal(r.statistics.caseNumberPairs,1);assert.equal(r.blocks.length,2);
  assert.equal(text(r.blocks[0]),'DOSYA NO\t: 2026/713 D. İş 2026/708 K.');
  assert.equal(r.blocks[0].role,'case-number');
  assert.equal(r.blocks[0].runs.filter(x=>x.bold).map(x=>x.text).join('|'),'DOSYA NO|:');
});
test('zaten aynı satırdaki dosya karar çifti tek etikete iner',()=>{
  const r=legal.apply([para('DOSYA NO: 2026/713 D. İş KARAR NO: 2026/708'),para('AÇIKLAMALAR')]);
  assert.equal(r.statistics.caseNumberPairs,1);assert.equal(r.blocks.length,2);assert(!text(r.blocks[0]).includes('KARAR NO'));
});
test('taraf etiketi kısaltılır, etiket+iki nokta kalın-altı çizili, isim normal, soyadı büyük (REVİZE WTU-026/028/029/035)',()=>{
  const r=legal.apply([para('İHTİYATİ HACZE İTİRAZ EDEN:'),para('Dumanbey Rezistans Isı Sistemleri ve Sanayi Ticaret Limited Şirketi'),para('VEKİLİ:'),para('Av. Ayşe Nur Geyik Öztürkmen'),para('AÇIKLAMALAR')]);
  const b=r.blocks[0];assert.equal(text(b),'İTİRAZ EDEN\t: Dumanbey Rezistans Isı Sistemleri ve Sanayi Ticaret Limited Şirketi');
  assert.equal(b.runs[0].bold,true);assert.equal(b.runs[0].underline,true);assert.equal(b.runs[2].bold,true);assert.equal(b.runs[2].underline,true);assert.equal(b.runs[3].bold,false);
  assert.equal(b.first,0);assert.equal(b.left,0);assert.equal(b.tabStops[0].pos,COLON);
  assert.equal(text(r.blocks[1]),'VEKİLİ\t: Av. Ayşe Nur GEYİK ÖZTÜRKMEN');
  assert.equal(r.blocks[1].runs[3].bold,false);
});
test('vergi adres UETS etiketleri aynı hizada kalır (REVİZE WTU-024: ortak durak, ADRES→ADRESİ)',()=>{
  const r=legal.apply([para('DAVACI: Ahmet Yılmaz'),para('Vergi No: 123'),para('Adres: Yeni Sokak'),para('UETS: 123-456'),para('AÇIKLAMALAR')]).blocks;
  assert.deepEqual(Array.from(r.slice(0,4),x=>x.role),['metadata','metadata','metadata','metadata']);
  assert(r.slice(0,4).every(x=>x.tabStops[0].pos===COLON&&x.runs[2].bold&&x.runs[2].underline));
  assert.equal(text(r[2]),'ADRESİ\t: Yeni Sokak');
});
test('vekili adı aynı satırda, KONU ortak sekmede ve tam genişlikte (REVİZE WTU-036/041)',()=>{
  const r=legal.apply([para('VEKİLİ:'),para('Av. Emin Kablama'),para('KONU: Çok uzun anlatımlı konu başlığı'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(r[0]),'VEKİLİ\t: Av. Emin KABLAMA');
  assert.equal(r[1].role,'topic');assert.equal(r[1].left,0);assert.equal(r[1].alignment,'left'); // REVİZE v1.4.1: iki yana yaslı satırda UDF sekmesi kayıyordu
  assert.equal(r[1].tabStops[0].pos,COLON);
  assert.equal(text(r[1]),'KONU\t: Çok uzun anlatımlı konu başlığı');
});
test('karşı taraf gibi betimleyici ifadeler soyadı sanılmaz',()=>{
  const r=legal.apply([para('DAVALI: Karşı taraf'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(r[0]),'DAVALI\t: Karşı taraf');
});

/* ----------------------------- v1.4.0 yeni kurallar ----------------------------- */
const PETITION=['T.C.','İSTANBUL 22. ASLİYE TİCARET MAHKEMESİNE','İHTİYATİ HACİZ KARARINA İTİRAZ VE İVEDİ İNCELEME TALEPLİDİR.',
  'DOSYA NO: 2026/713 E.','KARAR NO: 2026/708','İHTİYATİ HACZE İTİRAZ EDEN:','Dumanbey Rezistans Isı Sistemleri ve Sanayi Ticaret Limited Şirketi',
  'TEBLİGAT ADRESİ: Başpınar OSB,','Şehitkamil/Gaziantep','VEKİLİ: Av. Ayşe Nur Geyik Öztürkmen','ADRES VE UETS: 16615-16448-62422',
  'İHTİYATİ HACİZ TALEP EDEN: Pimar Plastik Kimya Tekstil Makina Sanayi ve Ticaret Limited Şirketi','ADRES: Çalı Mahallesi, Gri Caddesi No:13, Nilüfer/Bursa','VEKİLİ: Av. Emin Kablama',
  'İLGİLİ İCRA DOSYASI: İstanbul Anadolu 10. İcra Dairesi, 2026/18304 E.','KONU: İhtiyati haciz kararına itiraz edilmesi istemidir.','AÇIKLAMALAR: Mahkemenizce verilen karara itiraz ediyoruz.',
  'I. MAHKEMENİN YETKİSİNE İTİRAZ EDİLMEKTEDİR.','Müvekkil şirketin merkezi Gaziantep\'tir. HMK m. 6 uygulanır.',
  'HUKUKİ SEBEPLER:','İİK m. 50, 257, 258; HMK m. 6, 7 ve ilgili mevzuat.','HUKUKİ DELİLLER: Çek, imza sirküleri, ticaret sicili kayıtları.',
  'SONUÇ VE İSTEM:','Yukarıda arz edilen (Yetki kamu düzeninden olduğundan) sebeplerle;','1. Yetki itirazının kabulüne,','2. İhtiyati haciz kararının KALDIRILMASINA,',
  '3. Yargılama giderlerinin karşı tarafa yükletilmesine karar verilmesini vekâleten talep ederim.','10.10.2026',
  'İtiraz Eden Vekili','Av. Ayşe Nur Geyik Öztürkmen','EKLER:','1- İhtiyati haciz kararı örneği.','2- Çekin ön ve arka yüzü.','3- İmza sirküleri.'];
const full=run(PETITION);
const B=full.blocks;
const FIELD_ROLES=new Set(['metadata','topic','case-number','major-heading','section-field','result-heading']);
const fields=B.filter(b=>FIELD_ROLES.has(b.role));

test('WTU-021 ilçe mahkemesi, başsavcılık, BAM dairesi ve icra dairesi başlıkları tanınır; düz cümle tanınmaz',()=>{
  for(const h of ['KARŞIYAKA 2. SULH HUKUK MAHKEMESİNE','İSTANBUL CUMHURİYET BAŞSAVCILIĞINA','ANKARA BÖLGE ADLİYE MAHKEMESİ 3. HUKUK DAİRESİ BAŞKANLIĞINA','İSTANBUL ANADOLU 10. İCRA DAİRESİ MÜDÜRLÜĞÜNE','GAZİANTEP NÖBETÇİ SULH CEZA HÂKİMLİĞİNE'])
    assert.equal(legal.apply([para(h),para('AÇIKLAMALAR')]).blocks[0].role,'court-heading',h);
  assert.notEqual(legal.apply([para('Mahkemenize sunulan dilekçe ektedir'),para('AÇIKLAMALAR')]).blocks[0].role,'court-heading');
  assert.equal(legal.apply([para('Dilekçe'),para('AÇIKLAMALAR')]).statistics.roles['court-heading'],undefined);
});
test('WTU-022 DOSYA NO tek etiket ve tek satır; KARAR NO etiketi yok',()=>{
  assert.equal(text(B.find(b=>b.role==='case-number')),'DOSYA NO\t: 2026/713 E. 2026/708 K.');
  assert(!B.some(b=>/KARAR NO/u.test(text(b))));
});
test('WTU-023 ESAS NO çıplak numara E., KARAR NO K. alır; D. İş E. yapılmaz',()=>{
  assert.equal(text(legal.apply([para('ESAS NO: 2026/713'),para('KARAR NO: 2026/708'),para('AÇIKLAMALAR')]).blocks[0]),'DOSYA NO\t: 2026/713 E. 2026/708 K.');
  assert.equal(text(legal.apply([para('DOSYA NO: 2026/713 D. İş'),para('AÇIKLAMALAR')]).blocks[0]),'DOSYA NO\t: 2026/713 D. İş');
  assert.equal(text(legal.apply([para('DOSYA NO: 2026/713'),para('AÇIKLAMALAR')]).blocks[0]),'DOSYA NO\t: 2026/713');
});
test('WTU-024/025 bütün iki noktalar tek ortak sekme durağında, tek gerçek tab',()=>{
  const labels=fields.map(b=>b.fieldLabel);
  for(const need of ['DOSYA NO','İTİRAZ EDEN','ADRESİ','VEKİLİ','TALEP EDEN','İCRA DOSYA NO','KONU','AÇIKLAMALAR','HUKUKİ SEBEPLER','HUKUKİ DELİLLER','SONUÇ VE İSTEM','EKLER'])assert(labels.includes(need),need);
  for(const b of fields){
    assert.equal(b.tabStops.length,1,b.fieldLabel);assert.equal(b.tabStops[0].pos,COLON,b.fieldLabel);
    assert.equal(b.runs[1].text,'\t');assert.equal(b.runs[2].text,':');
    assert.equal(text(b).split('\t').length,2,'tek tab: '+b.fieldLabel);
    assert(!/ {2,}/u.test(text(b)),'boşlukla hizalama yok');
  }
});
test('WTU-026 etiket, sekme ve iki nokta kesintisiz altı çizili (REVİZE v1.4.1); değer altı çizgisiz/normal',()=>{
  for(const b of fields){
    const [label,tab,colon,...value]=b.runs;
    assert(label.bold&&label.underline,b.fieldLabel);assert(colon.bold&&colon.underline);
    assert.equal(tab.text,'\t');assert.equal(tab.underline,true);assert.equal(tab.bold,false);
    for(const v of value){assert.equal(v.underline,false);if(!v.italic)assert.equal(v.bold,false,text(b));}
  }
});
test('WTU-027 iki noktadan sonra tam bir boşluk; boş değerde boşluk yok',()=>{
  for(const b of fields){const t=text(b);if(b.runs.length>3)assert(/\t: \S/u.test(t),t);else assert(t.endsWith('\t:'),t);}
});
test('WTU-028 uzun değer girintisiz doğal sarma; adres devamı aynı paragrafta',()=>{
  for(const b of fields){assert.equal(b.left,0);assert.equal(b.first,0);}
  assert.equal(text(find(B,/^ADRESİ\t: Başpınar/u)),'ADRESİ\t: Başpınar OSB, Şehitkamil/Gaziantep');
  assert(!B.some(b=>b.role==='metadata-continuation'));
});
test('WTU-029 kısa hukuki sıfatlar; diğer sıfatlar değişmez',()=>{
  assert(find(B,/^İTİRAZ EDEN\t/u));assert(find(B,/^TALEP EDEN\t/u));assert(find(B,/^İCRA DOSYA NO\t/u));
  const r=legal.apply([para('KATILAN: Ali Veli'),para('ŞÜPHELİ: Can Demir'),para('MÜŞTEKİ: Ece Kara'),para('AÇIKLAMALAR')]).blocks;
  assert.deepEqual(Array.from(r.slice(0,3),b=>b.fieldLabel),['KATILAN','ŞÜPHELİ','MÜŞTEKİ']);
});
test('WTU-030 sütuna sığmayan etiket iki satıra bölünür, iki nokta ortak yerde kalır',()=>{
  const r=legal.apply([para('İSTİNAF EDEN SANIK: Ali Veli'),para('AÇIKLAMALAR')],{colonTabCm:3.5}).blocks;
  assert.equal(text(r[0]),'İSTİNAF EDEN');assert.equal(r[0].role,'field-label-line');assert(r[0].runs[0].underline);
  assert.equal(text(r[1]),'SANIK\t: Ali VELİ');assert.equal(r[1].tabStops[0].pos,Math.round(3.5*72/2.54*100)/100);
  for(const l of ['İCRA HUKUK DOSYA NO','HUKUKİ DELİLLER','SONUÇ VE İSTEM','İSTİNAF EDEN SANIK'])assert(legal.labelWidthPt(l)+5<COLON,l);
});
test('WTU-028 büyük harfli şirket unvanı ayrı satırdaysa etiketle birleşir; büyük harfli başlık birleşmez',()=>{
  const r=legal.apply([para('İTİRAZ EDEN:'),para('DUMANBEY REZİSTANS ISI SİSTEMLERİ'),para('VE SANAYİ TİCARET LİMİTED ŞİRKETİ'),para('GİRİŞ'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(r[0]),'İTİRAZ EDEN\t: DUMANBEY REZİSTANS ISI SİSTEMLERİ VE SANAYİ TİCARET LİMİTED ŞİRKETİ');
  assert.equal(text(r[1]),'GİRİŞ');
});
test('WTU-031 taraf adı etiketin kalın/altı çizili biçimini devralmaz',()=>{
  const r=legal.apply([{kind:'paragraph',runs:[{text:'DAVACI: Ali Veli',bold:true,underline:true}]},para('AÇIKLAMALAR')]).blocks[0];
  assert.equal(r.runs[3].bold,false);assert.equal(r.runs[3].underline,false);
});
test('WTU-032 kişi soyadı büyük; belirsizde yalnız son sözcük; büyük yazılmış kaynak korunur',()=>{
  assert.equal(legal.nameCase('Av. Fatih Nakışlı'),'Av. Fatih NAKIŞLI');
  assert.equal(legal.nameCase('Av. Ayşe Nur Geyik Öztürkmen'),'Av. Ayşe Nur GEYİK ÖZTÜRKMEN');
  assert.equal(legal.nameCase('Mehmet Ali Yılmaz'),'Mehmet Ali YILMAZ');
  assert.equal(legal.nameCase('Ayşe Geyik Öztürkmen'),'Ayşe Geyik ÖZTÜRKMEN');
  assert.equal(legal.nameCase('Ayşe Nur GEYİK ÖZTÜRKMEN'),'Ayşe Nur GEYİK ÖZTÜRKMEN');
});
test('WTU-033 şirket ve kurum unvanları değiştirilmez',()=>{
  for(const v of ['Dumanbey Rezistans Isı Sistemleri ve Sanayi Ticaret Ltd. Şti.','Kaya İnşaat','Demir Holding','Ankara Büyükşehir Belediyesi','Yılmaz Tekstil','Hazine ve Maliye Bakanlığı'])assert.equal(legal.nameCase(v),v);
});
test('WTU-034 taraf adresi ADRESİ etiketinde tam korunur',()=>{
  assert.equal(text(find(B,/Çalı Mahallesi/u)),'ADRESİ\t: Çalı Mahallesi, Gri Caddesi No:13, Nilüfer/Bursa');
});
test('WTU-035/038 vekil UETS aynı paragrafta; ayrı ADRES VE UETS satırı yok, tekrar yok',()=>{
  assert.equal(text(find(B,/GEYİK/u)),'VEKİLİ\t: Av. Ayşe Nur GEYİK ÖZTÜRKMEN (UETS: 16615-16448-62422)');
  assert(!B.some(b=>/ADRES VE UETS/u.test(text(b))));
  assert.equal(B.filter(b=>/16615-16448-62422/u.test(text(b))).length,1);
  const r=legal.apply([para('VEKİLİ: Av. Ali Kaya'),para('VEKİL ADRESİ: Kızılay Mah. Ankara'),para('UETS: 11111-22222-33333'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(r.length,2);assert.equal(text(r[0]),'VEKİLİ\t: Av. Ali KAYA (UETS: 11111-22222-33333), Kızılay Mah. Ankara');
});
test('WTU-036 bilinmeyen UETS numarası uydurulmaz (v1.4.1: numarasız vekilde UETS alanı boş kalır)',()=>{
  const t=text(find(B,/KABLAMA/u));assert.equal(t,'VEKİLİ\t: Av. Emin KABLAMA');assert(!/\d/u.test(t));
  assert.equal(text(legal.apply([para('VEKİLİ: Av. Emin Kablama'),para('AÇIKLAMALAR')],{markUets:false}).blocks[0]),'VEKİLİ\t: Av. Emin KABLAMA');
});
test('WTU-037 kullanıcı UETS listesi yalnız tam eşleşen vekile uygulanır',()=>{
  const reg='Av. Fatih NAKIŞLI = 16615-16448-62422\nAv. Hatalı Kayıt = 123';
  const r=legal.apply([para('VEKİLİ: Av. Fatih Nakışlı'),para('VEKİLİ: Av. Fatih Nakış'),para('AÇIKLAMALAR')],{uetsRegistry:reg});
  assert.equal(text(r.blocks[0]),'VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)');
  assert.equal(text(r.blocks[1]),'VEKİLİ\t: Av. Fatih NAKIŞ');
  assert.deepEqual(Array.from(r.statistics.uetsRegistryErrors),[2]);
});
test('WTU-039 farklı künye alanları birbirinin değerine girmez',()=>{
  const r=legal.apply([para('DAVACI:'),para('Ali Veli'),para('DAVALI:'),para('Can Demir'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(r[0]),'DAVACI\t: Ali VELİ');assert.equal(text(r[1]),'DAVALI\t: Can DEMİR');
});
test('WTU-040 İCRA DOSYA NO / İCRA HUKUK DOSYA NO ortak hizada, değer korunur',()=>{
  assert.equal(text(find(B,/^İCRA DOSYA NO/u)),'İCRA DOSYA NO\t: İstanbul Anadolu 10. İcra Dairesi, 2026/18304 E.');
  assert.equal(legal.apply([para('İLGİLİ İCRA HUKUK DOSYASI: 2026/55 Esas'),para('AÇIKLAMALAR')]).blocks[0].fieldLabel,'İCRA HUKUK DOSYA NO');
});
test('WTU-041 KONU değeri aynı satırda, ortak kolonda',()=>{
  assert.equal(text(find(B,/^KONU/u)),'KONU\t: İhtiyati haciz kararına itiraz edilmesi istemidir.');
});
test('WTU-042/043 AÇIKLAMALAR satırı boş, açıklama yeni paragrafta ve tabsız',()=>{
  const i=B.findIndex(b=>b.fieldLabel==='AÇIKLAMALAR');
  assert.equal(text(B[i]),'AÇIKLAMALAR\t:');
  assert.equal(text(B[i+1]),'Mahkemenizce verilen karara itiraz ediyoruz.');assert.equal(B[i+1].role,'explanation-body');
  assert(!text(B[i+1]).includes('\t'));assert(Math.abs(B[i+1].first-35.433)<.01);assert.equal(B[i+1].alignment,'justify');
});
test('WTU-044 Roma rakamlı ara başlık kalın-altı çizili, sola yaslı, girintisiz',()=>{
  const h=find(B,/^I\. MAHKEMENİN/u);assert.equal(h.role,'section-heading');assert.equal(h.alignment,'left');assert.equal(h.first,0);assert(h.runs.every(r=>r.bold&&r.underline));
});
test('WTU-045 kanun atfı italik, değer metni değişmez',()=>{
  const b=find(B,/^HUKUKİ SEBEPLER/u);
  assert(b.runs.some(r=>r.italic&&/İİK m\. 50/u.test(r.text)));assert(!b.runs[0].italic);
});
test('WTU-047 HUKUKİ SEBEPLER ayrı satırdaki içerikle aynı paragrafa alınır, ikinci tab yok',()=>{
  const b=find(B,/^HUKUKİ SEBEPLER/u);assert.equal(text(b),'HUKUKİ SEBEPLER\t: İİK m. 50, 257, 258; HMK m. 6, 7 ve ilgili mevzuat.');
  assert.equal(b.role,'section-field');assert.equal(b.first,0);assert.equal(b.left,0);
  assert(!B.some(x=>text(x)==='İİK m. 50, 257, 258; HMK m. 6, 7 ve ilgili mevzuat.'));
});
test('WTU-048 HUKUKİ DELİLLER / DELİLLER satır içi, deliller korunur',()=>{
  assert.equal(text(find(B,/^HUKUKİ DELİLLER/u)),'HUKUKİ DELİLLER\t: Çek, imza sirküleri, ticaret sicili kayıtları.');
  const r=run(['AÇIKLAMALAR','Gövde','DELİLLER','Tanık beyanları ve bilirkişi incelemesi.','SONUÇ VE İSTEM','1. Kabulüne,']).blocks;
  assert.equal(text(find(r,/^DELİLLER/u)),'DELİLLER\t: Tanık beyanları ve bilirkişi incelemesi.');
});
test('WTU-049 eş anlamlı bölüm başlıkları doğru role bağlanır, adı değişmez',()=>{
  const r=run(['AÇIKLAMALAR','Gövde','HUKUKİ NEDENLER: TBK m. 49','NETİCE VE TALEP','1. Kabulüne,']).blocks;
  const n=find(r,/^HUKUKİ NEDENLER/u);assert.equal(n.role,'section-field');assert.equal(n.fieldKind,'legal-basis');
  assert.equal(find(r,/^NETİCE VE TALEP/u).role,'result-heading');
});
test('WTU-050 SONUÇ girişi birebir ve tek kez; parantezli ek yok',()=>{
  const h=B.find(b=>b.role==='result-heading');assert.equal(text(h),'SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;');
  assert.equal(B.filter(b=>/Yukarıda arz edilen/u.test(text(b))).length,1);assert(!B.some(b=>/kamu düzeninden/u.test(text(b))));
  const r=run(['AÇIKLAMALAR','Gövde','SONUÇ VE İSTEM','1. Kabulüne,']).blocks;
  assert.equal(text(find(r,/^SONUÇ/u)),'SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;');
});
test('WTU-051 talepler gerçek otomatik liste; elle yazılmış numara kalmaz',()=>{
  const items=B.filter(b=>b.role==='result-item');
  assert.deepEqual(arr(items.map(text)),['Yetki itirazının kabulüne,','İhtiyati haciz kararının KALDIRILMASINA,','Yargılama giderlerinin karşı tarafa yükletilmesine,']);
  for(const b of items){assert.equal(b.list.kind,'number');assert.equal(b.list.id,'1');assert.equal(b.list.raw,'NUMBER_TYPE_NUMBER_DOT');assert(!/^\s*\d/u.test(text(b)));}
});
test('WTU-051 UDF yazıcısı Numbered/NumberType/ListLevel/ListId yazar',()=>{
  const w=writer.write(B,{});
  const lists=w.xml.match(/<paragraph[^>]*Numbered="true"[^>]*>/gu)||[];
  assert.equal(lists.length,6);
  assert.equal(lists.filter(x=>/ListId="1"/u.test(x)).length,3);assert.equal(lists.filter(x=>/ListId="2"/u.test(x)).length,3);
  assert(lists.every(x=>/NumberType="NUMBER_TYPE_NUMBER_DOT"/u.test(x)&&/ListLevel="1"/u.test(x)));
  assert(!/\n\d+[.)-]\s/u.test(w.fullText.replace(/\n(?:I|II)\.\s/gu,'')),'görünür metinde elle numara yok');
});
test('WTU-052 altı talepli girdi altı ayrı talep taşır',()=>{
  const src=['SONUÇ VE İSTEM','Yukarıda arz edilen sebeplerle;'];for(let i=1;i<=6;i++)src.push(`${i}. Talep ${i} kabulüne,`);src.push('Karar verilmesini vekâleten talep ederim.');
  const r=run(src);assert.equal(r.statistics.resultItems,6);
  assert.deepEqual(arr(r.blocks.filter(b=>b.role==='result-item').map(text)),[1,2,3,4,5,6].map(i=>`Talep ${i} kabulüne,`));
});
test('WTU-053 liste asılı girintisi var, madde metninde tab yok',()=>{
  for(const b of B.filter(b=>b.role==='result-item'||b.role==='attachment-item')){assert.equal(b.left,18);assert.equal(b.first,-18);assert(!text(b).includes('\t'));assert.equal(b.tabStops.length,0);}
});
test('WTU-054 kritik usul istemi seçici kalın, paragrafın tamamı değil',()=>{
  const b=find(B,/KALDIRILMASINA/u);assert(b.runs.some(r=>r.bold&&r.text==='KALDIRILMASINA'));assert(b.runs.some(r=>!r.bold));
});
test('WTU-055 kapanış liste dışında ve normal paragraf',()=>{
  const c=B.find(b=>b.role==='result-closing');assert(!c.list);assert.equal(c.left,0);assert.equal(c.first,0);assert(c.runs.every(r=>!r.bold));
  assert(/^Karar verilmesini vekâleten talep ederim\./u.test(text(c)));
});
test('WTU-056 tarih kapanışla aynı paragrafta, ayrı tarih satırı kalmaz',()=>{
  const c=B.find(b=>b.role==='result-closing');assert.equal(text(c),'Karar verilmesini vekâleten talep ederim. 14.10.2026');
  assert(!B.some(b=>text(b)==='10.10.2026'));
});
test('WTU-057 Türkiye yerel tarihi: 23:59 ve 00:01 sınırları',()=>{
  assert.equal(legal.todayTR(new Date('2026-10-13T20:59:00Z')),'13.10.2026');
  assert.equal(legal.todayTR(new Date('2026-10-13T21:01:00Z')),'14.10.2026');
  const r=run(['SONUÇ VE İSTEM','1. Kabulüne,','Karar verilmesini vekâleten talep ederim. 01.01.2020'],{now:new Date('2026-10-15T08:00:00Z')});
  assert.equal(text(r.blocks.find(b=>b.role==='result-closing')),'Karar verilmesini vekâleten talep ederim. 15.10.2026');
  assert(r.statistics.changes.some(c=>c.type==='date'&&c.before==='01.01.2020'&&c.after==='15.10.2026'));
});
test('WTU-057 tarih seçeneği kapalıysa kaynak kapanış korunur',()=>{
  const r=run(['SONUÇ VE İSTEM','1. Kabulüne,','Karar verilmesini talep ederim. 01.01.2020'],{dateMode:'keep'});
  assert.equal(text(r.blocks.find(b=>b.role==='result-closing')),'Karar verilmesini talep ederim. 01.01.2020');
});
test('WTU-058 kapanış normal, imza sağa hizalı kalın ve ayrı',()=>{
  const sig=B.filter(b=>b.role==='signature');assert.deepEqual(arr(sig.map(text)),['İtiraz Eden Vekili','Av. Ayşe Nur GEYİK ÖZTÜRKMEN']);
  assert(sig.every(b=>b.alignment==='right'&&b.runs.every(r=>r.bold)));
  assert.equal(B.find(b=>b.role==='result-closing').alignment,'justify');
});
test('WTU-055 kapanış yoksa kullanıcı standardındaki kapanış eklenir ve raporlanır',()=>{
  const r=run(['SONUÇ VE İSTEM','1. Kabulüne,']);
  assert.equal(text(r.blocks.at(-1)),'Karar verilmesini vekâleten talep ederim. 14.10.2026');
  assert(r.statistics.changes.some(c=>c.type==='closing-added'));
});
test('WTU-059 ek yoksa EKLER bölümü oluşturulmaz',()=>{
  const r=run(['AÇIKLAMALAR','Gövde','SONUÇ VE İSTEM','1. Kabulüne,']).blocks;assert(!r.some(b=>/EKLER/u.test(text(b))));
});
test('WTU-060 ekler ayrı otomatik liste, sonuç listesini etkilemez',()=>{
  const a=B.filter(b=>b.role==='attachment-item');
  assert.deepEqual(arr(a.map(text)),['İhtiyati haciz kararı örneği.','Çekin ön ve arka yüzü.','İmza sirküleri.']);
  assert(a.every(b=>b.list.id==='2'));assert(B.filter(b=>b.role==='result-item').every(b=>b.list.id==='1'));
  assert.equal(text(B.find(b=>b.fieldLabel==='EKLER')),'EKLER\t:');
});
test('WTU-062 yedi ek yedi ek olarak kalır (EK-1 biçimi dahil)',()=>{
  const src=['SONUÇ VE İSTEM','1. Kabulüne,','Karar verilmesini talep ederim.','Av. Ali Kaya','EKLER'];for(let i=1;i<=7;i++)src.push(`EK-${i} Belge ${i}`);
  const r=run(src);assert.equal(r.statistics.attachments,7);assert.deepEqual(arr(r.blocks.filter(b=>b.role==='attachment-item').map(text)),[1,2,3,4,5,6,7].map(i=>`Belge ${i}`));
});
test('WTU-005 Word biçimini koru profili hiçbir hukuk değişikliği yapmaz',()=>{
  const items=PETITION.map(t=>para(t));const r=legal.apply(items,{enabled:false});
  assert.equal(JSON.stringify(r.blocks.map(text)),JSON.stringify(PETITION));assert.equal(r.statistics.changes.length,0);
});
test('WTU-008 elle seçilen AÇIKLAMALAR sınırı hukuk katmanında da esas alınır',()=>{
  const items=['DAVACI: Ali Veli','GİRİŞ','Birinci gövde.','SONUÇ VE İSTEM','1. Kabulüne,'].map(t=>para(t));
  const n=normal.apply(items,{start:1,end:3});const r=legal.apply(n.blocks,{selection:n.selection,now:NOW}).blocks;
  assert.equal(find(r,/^Birinci/u).role,'explanation-body');
  const none=normal.apply(items,{start:'none',end:'none'});const r2=legal.apply(none.blocks,{selection:none.selection,now:NOW}).blocks;
  assert.notEqual(find(r2,/^Birinci/u).role,'explanation-body');
});
test('WTU-012/013 gövde 12 pt ve varsayılan 1,5 satır; 1,0 seçilebilir',()=>{
  const body=B.find(b=>b.role==='explanation-body');assert.equal(body.line,1.5);assert(body.runs.every(r=>r.size===12));
  const n=normal.apply([para('AÇIKLAMALAR'),para('Gövde')],{},{lineSpacing:1});assert.equal(n.blocks[1].line,1);
  assert.equal(normal.RULES.explanationLine,1.5);
});
test('WTU-017 metin bütünlüğü raporu yalnız açıklanan sözcük farklarını gösterir',()=>{
  const {removed,added}=full.statistics.integrity;
  for(const w of removed)assert(/^(?:ihtiyati|haciz|hacze|tebligat|adres|ilgili|dosyası|karar|ve|uets|yetki|kamu|düzeninden|olduğundan|10)(?: ×\d+)?$/u.test(w),w);
  for(const w of added)assert(/^(?:dosya|adresi|uets|2026|14|10)(?: ×\d+)?$/u.test(w),w);
  assert(full.statistics.changes.length>=10);
});
test('WTU-018 tab ayrı <tab> öğesi; liste maddesindeki satır sonu yeni madde açmaz',()=>{
  const item={kind:'paragraph',runs:[{text:'Birinci\nikinci satır'}],list:{kind:'number',id:'1',level:0,raw:'NUMBER_TYPE_NUMBER_DOT'}};
  const w=writer.write([B.find(b=>b.role==='case-number'),item],{});
  assert(/<tab [^>]*length="1"/u.test(w.xml));
  assert.equal((w.xml.match(/Numbered="true"/gu)||[]).length,1);assert.equal(w.paragraphs,3);
});
test('WTU-070 12.001 paragraf sessizce kırpılmaz, hata verir',()=>{
  const many=Array.from({length:12001},(_,i)=>para(`P${i}`));
  assert.throws(()=>writer.write(many,{}),/12\.000 paragraf sınırı aşıldı/u);
});
test('WTU-072 manifest izinleri, CSP ve sürüm',()=>{
  const m=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.equal(m.manifest_version,3);assert.deepEqual(m.permissions,[]);assert.deepEqual(m.host_permissions,[]);
  assert(/connect-src 'none'/u.test(m.content_security_policy.extension_pages));assert.equal(m.version,'1.6.1');assert(m.description.length<=132,'Chrome açıklama sınırı 132 karakter');
  // sw.js (PWA offline cache) may fetch, but only its own origin.
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert(/url\.origin !== location\.origin\) return/u.test(sw));
  for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js')&&f!=='sw.js'))assert(!/\bfetch\(|XMLHttpRequest|WebSocket|eval\(|new Function/u.test(fs.readFileSync(path.join(root,f),'utf8')),f);
});
test('WTU-078 tek kaynak: sekme durağı ve satır aralığı normalize.RULES içinde tanımlı',()=>{
  assert.equal(normal.RULES.colonTabCm,6);assert.equal(full.statistics.colonTabPt,COLON);
  const n=normal.apply([para('DAVACI\t: Ali')]);assert.equal(n.blocks[0].tabStops[0].pos,COLON);
});

/* ----------------------------- v1.4.1 düzeltmeleri ----------------------------- */
const ISA=['ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ\'NE','DOSYA NO\t:\t2026/1929 Esas','DAVALI\t:\tİsa ÇİFTÇİ','VEKİLİ\t:\tAv. Fatih NAKIŞLI','DAVACI\t:\tYapı ve Kredi Bankası Anonim Şirketi',
  'KONU\t:\t14.10.2026 tarihli duruşmaya ilişkin mesleki mazeretimizin sunulması talebidir.','AÇIKLAMALAR','Mahkemenizin yukarıda esas numarası belirtilen dosyasının duruşmasına katılamayacağız.',
  'SONUÇ VE İSTEM: Yukarıda açıklanan nedenlerle; 14.10.2026 tarihli duruşmaya ilişkin mesleki mazeretimizin kabulüne, müvekkil yönünden cevap süresi henüz sona ermediğinden ön inceleme duruşmasının dilekçeler aşamasının tamamlanmasından sonraki bir tarihe bırakılmasına, 06.10.2026 tarihli dilekçemizde ileri sürdüğümüz ihtiyati tedbire yönelik itirazlarımızın kabulüyle tedbir kararının kaldırılmasına, aksi hâlde tedbirin kapsamı ve teminat yönünden taleplerimizin değerlendirilmesine, yeni duruşma gününün UYAP üzerinden öğrenilmesine karar verilmesini saygıyla talep ederiz. 14.10.2026',
  'Davalı İsa Çiftçi Vekili','Av. Fatih NAKIŞLI'];
const ISA_R=runText(ISA,{now:new Date('2026-10-14T09:00:00Z')});
const IB=ISA_R.blocks;
test('v1.4.1 uzun son talepteki kapanış ayrılır; ikinci "Karar verilmesini" kapanışı eklenmez',()=>{
  const closings=IB.filter(b=>b.role==='result-closing');
  assert.equal(closings.length,1);
  assert.equal(text(closings[0]),'Karar verilmesini saygıyla talep ederiz. 14.10.2026');
  assert(!IB.some(b=>/vekâleten talep ederim/u.test(text(b))));
  assert(!ISA_R.statistics.changes.some(c=>c.type==='closing-added'));
  const item=IB.find(b=>b.role==='result-item');
  assert(/öğrenilmesine,$/u.test(text(item)));assert(!/talep ederiz|14\.10\.2026$/u.test(text(item)));
  assert.equal(IB.filter(b=>/14\.10\.2026$/u.test(text(b))).length,1,'tarih yalnız kapanışta');
});
test('v1.4.1 liste numarası metin + sekme; numara ile ilk sözcük iç içe girmez',()=>{
  const item=IB.find(b=>b.role==='result-item');
  assert(!item.list,'otomatik liste özniteliği yok');
  assert.equal(item.runs[0].text,'1.\t');assert.equal(item.left,18);assert.equal(item.first,-18);
  assert.equal(item.tabStops.length,1);assert.equal(item.tabStops[0].pos,18);
  assert(/^1\.\t14\.10\.2026 tarihli/u.test(text(item)));
  const w=writer.write(IB,{font:'Times New Roman'});
  assert(!/Numbered="true"/u.test(w.xml));
  assert(/<paragraph[^>]*LeftIndent="18"[^>]*FirstLineIndent="-18"[^>]*TabSet="18:0:0"/u.test(w.xml));
  const r=runText(['SONUÇ VE İSTEM','1. Birinci talebin kabulüne,','a) alt talep,','2. İkinci talebin kabulüne,','Karar verilmesini talep ederim.','EKLER','EK-1 Vekaletname','EK-2 Karar']).blocks;
  assert.deepEqual(arr(r.filter(b=>b.role==='result-item').map(b=>b.runs[0].text)),['1.\t','a)\t','2.\t']);
  assert.deepEqual(arr(r.filter(b=>b.role==='attachment-item').map(text)),['1.\tVekaletname','2.\tKarar']);
});
test('v1.4.1 hukuk profilinde bütün metin Times New Roman (Cambria/tema yazı tipi kalmaz)',()=>{
  const r=runText([{kind:'paragraph',runs:[{text:'DAVACI: Ali Veli',font:'Cambria'}]},{kind:'paragraph',runs:[{text:'AÇIKLAMALAR',font:'Calibri'}]},{kind:'paragraph',runs:[{text:'Gövde metni.',font:'Cambria'}]}]).blocks;
  assert(r.every(b=>b.runs.every(x=>x.font==='Times New Roman')));
  assert(IB.every(b=>b.runs.every(x=>x.font==='Times New Roman')));
  const w=writer.write(r,{font:'Times New Roman'});assert(!/Cambria|Calibri/u.test(w.xml));
});
test('v1.4.1 kendi vekil profili: Av. Fatih NAKIŞLI satırına UETS numarası otomatik eklenir',()=>{
  assert.equal(text(IB.find(b=>b.fieldLabel==='VEKİLİ')),'VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)');
  const r=legal.apply([para('VEKİLİ: Av. Fatih Nakışlı (UETS)'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(r[0]),'VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)');
});
test('v1.4.1 başka vekil: UETS girilirse eklenir, girilmezse boş bırakılır',()=>{
  const none=legal.apply([para('VEKİLİ: Av. Ali Kaya'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(none[0]),'VEKİLİ\t: Av. Ali KAYA');
  const withU=legal.apply([para('VEKİLİ: Av. Ali Kaya'),para('AÇIKLAMALAR')],{uetsRegistry:[{name:'Av. Ali KAYA',uets:'11111-22222-33333'}]}).blocks;
  assert.equal(text(withU[0]),'VEKİLİ\t: Av. Ali KAYA (UETS: 11111-22222-33333)');
  const two=legal.apply([para('VEKİLİ: Av. Fatih Nakışlı, Av. Ali Kaya'),para('AÇIKLAMALAR')]).blocks;
  assert.equal(text(two[0]),'VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422), Av. Ali KAYA');
  const off=legal.apply([para('VEKİLİ: Av. Fatih Nakışlı'),para('AÇIKLAMALAR')],{ownAttorney:null}).blocks;
  assert.equal(text(off[0]),'VEKİLİ\t: Av. Fatih NAKIŞLI');
});

/* ----------------------------- v1.5.0 ----------------------------- */
const ISA_TEXT=ISA.slice();
test('v1.5 kesme işaretli mahkeme başlığı (MAHKEMESİ\'NE / ’NE) tanınır',()=>{
  assert(legal.isCourtHeading("ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE",0));
  assert(legal.isCourtHeading('ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ’NE',0));
  assert(legal.isCourtHeading('ANKARA CUMHURİYET BAŞSAVCILIĞI\'NA',0));
  assert.equal(IB[0].role,'court-heading');assert.equal(IB[0].alignment,'center');
});
test('v1.5 kural verisi legal-rules.js içinde, tipografi motorunda kopyası yok',()=>{
  const src=fs.readFileSync(path.join(root,'legal-typography.js'),'utf8');
  assert(!/const FIELD_RULES = \[/u.test(src));assert(!/const GIVEN_NAMES = new Set/u.test(src));
  assert(ctx.WordToUDFLegalRules.FIELD_RULES.length>10);
});
test('v1.5 ayarlar: varsayılan vekil settings.js içinde, temizleme ve içe/dışa aktarma',()=>{
  const d=settingsApi.sanitize({});
  assert.equal(d.ownAttorney.name,'Av. Fatih NAKIŞLI');assert.equal(d.ownAttorney.uets,'16615-16448-62422');assert.equal(d.listMode,'text');
  assert.equal(legal.SCHEMA.ownAttorney.uets,'16615-16448-62422');
  const s=settingsApi.sanitize({ownAttorney:{name:' Av. Ali KAYA ',uets:'11111 -22222-33333'},otherEnabled:true,others:[{name:'Av. Can Er',uets:''},{name:'Av. Su Ak',uets:'12345-12345-12345'}],listMode:'auto',lineSpacing:1,evil:'x'});
  assert.equal(s.ownAttorney.name,'Av. Ali KAYA');assert.equal(s.ownAttorney.uets,'11111-22222-33333');assert.equal(s.evil,undefined);assert.equal(s.lineSpacing,1);
  assert.deepEqual(arr(settingsApi.registry(s).map(o=>o.name)),['Av. Su Ak'],'UETS boş vekil kayda girmez');
  const back=settingsApi.importJson(settingsApi.exportJson(s));assert.deepEqual(JSON.parse(JSON.stringify(back)),JSON.parse(JSON.stringify(s)));
  assert.throws(()=>settingsApi.importJson('{"application":"Başka"}'),/WordToUDF ayar/u);assert.throws(()=>settingsApi.importJson('bozuk'),/JSON/u);
  assert.deepEqual(arr(settingsApi.invalidUets({ownAttorney:{name:'Av. A B',uets:'123'}})),['kendi UETS']);
  assert.deepEqual(arr(settingsApi.signatureLines(d,{sifat:'Davalı',muvekkil:'İsa ÇİFTÇİ',avukat:'Av. Fatih NAKIŞLI'})),['Davalı İsa ÇİFTÇİ Vekili','Av. Fatih NAKIŞLI']);
});
test('v1.5 talepleri maddelere ayırma: öneri sayısı ve onaylı bölme',()=>{
  assert.equal(ISA_R.statistics.splittableRequests,5);
  const r=runText(ISA,{splitRequests:true,now:new Date('2026-10-14T09:00:00Z')});
  const items=r.blocks.filter(b=>b.role==='result-item').map(text);
  assert.deepEqual(arr(items),['1.\t14.10.2026 tarihli duruşmaya ilişkin mesleki mazeretimizin kabulüne,','2.\tMüvekkil yönünden cevap süresi henüz sona ermediğinden ön inceleme duruşmasının dilekçeler aşamasının tamamlanmasından sonraki bir tarihe bırakılmasına,',
    '3.\t06.10.2026 tarihli dilekçemizde ileri sürdüğümüz ihtiyati tedbire yönelik itirazlarımızın kabulüyle tedbir kararının kaldırılmasına,','4.\tAksi hâlde tedbirin kapsamı ve teminat yönünden taleplerimizin değerlendirilmesine,','5.\tYeni duruşma gününün UYAP üzerinden öğrenilmesine,']);
  assert.equal(text(r.blocks.find(b=>b.role==='result-closing')),'Karar verilmesini saygıyla talep ederiz. 14.10.2026');
  assert(r.statistics.changes.some(c=>c.type==='request-split'));assert.equal(r.statistics.splittableRequests,0);
  // Kısa, tek talepli maddeler bölünmez; "kabulüne, reddine" gibi kısa sıralar korunur.
  assert.deepEqual(arr(legal.requestCuts('Davanın kabulüne, karşı davanın reddine,')),[]);
  const one=runText(['SONUÇ VE İSTEM','1. Davanın kabulüne,','2. Yargılama giderlerinin davalıya yükletilmesine,','Karar verilmesini talep ederim.'],{splitRequests:true});
  assert.equal(one.blocks.filter(b=>b.role==='result-item').length,2);
});
test('v1.5 elle düzenleme: tür, hizalama, yazı; metin aynı kalır; anahtar metne bağlı',()=>{
  const keys=edits.blockKeys(IB);const i=IB.findIndex(b=>b.role==='signature');
  const r=edits.apply(IB,new Map([[keys[i],{role:'plain'}]]));
  assert.equal(r.applied,1);const b=r.blocks.find(x=>x.editKey===keys[i]);
  assert.equal(b.alignment,'left');assert(b.runs.every(x=>!x.bold));assert.equal(text(b),text(IB[i]));assert(b.edited);
  assert.equal(r.log[0].summary,'tür: Düz paragraf');
  const all=edits.apply(IB,{});assert(all.blocks.filter(x=>x.kind==='paragraph').every(x=>x.editKey),'her paragrafın anahtarı var');
  const item=IB.findIndex(b=>b.role==='result-item');
  const h=edits.apply(IB,{[keys[item]]:{role:'heading'}}).blocks.find(x=>x.editKey===keys[item]);
  assert(!/^1\.\t/u.test(text(h)),'liste numarası kaldırılır');assert(h.runs.every(x=>x.bold&&x.underline));
  const f=edits.apply(IB,{[keys[i]]:{align:'center',bold:false,italic:true,underline:true,size:14,line:2,above:12,below:6,right:1}}).blocks.find(x=>x.editKey===keys[i]);
  assert.equal(f.alignment,'center');assert(f.runs.every(x=>!x.bold&&x.italic&&x.underline&&x.size===14));assert.equal(f.line,2);assert.equal(f.above,12);assert.equal(f.below,6);assert(Math.abs(f.right-28.346)<.01);
  assert.equal(edits.apply(IB,{[keys[i]]:{role:'yok',size:99,align:'x',evil:1}}).applied,0,'geçersiz alanlar yok sayılır');
  assert.deepEqual(JSON.parse(JSON.stringify(edits.sanitize({bold:false,remove:false,above:0,first:1.25,text:'a\r\nb'}))),{bold:false,above:0,first:1.25,text:'a\nb'});
});
test('v1.5 elle düzenleme: talep maddesi ekle/sil → numaralar yeniden sıralanır',()=>{
  const r0=runText(ISA,{splitRequests:true,now:new Date('2026-10-14T09:00:00Z')}).blocks;
  const keys=edits.blockKeys(r0);const items=r0.map((b,i)=>b.role==='result-item'?i:-1).filter(i=>i>=0);
  // 2. maddeyi sil → 5 madde 4'e iner ve 1..4 sıralı
  const del=edits.apply(r0,{[keys[items[1]]]:{remove:true}}).blocks.filter(b=>b.role==='result-item');
  assert.deepEqual(arr(del.map(b=>b.runs[0].text)),['1.\t','2.\t','3.\t','4.\t']);
  assert(/^2\.\t06\.10\.2026/u.test(text(del[1])));
  // Bir açıklama paragrafını talep maddesi yap → başa eklenir, numaralar kayar
  const body=r0.findIndex(b=>b.role==='explanation-body');
  const add=edits.apply(r0,{[keys[body]]:{role:'result-item'}}).blocks;
  const nums=add.filter(b=>b.listMarker&&b.listId==='1').map(b=>b.runs[0].text);
  assert.deepEqual(arr(nums),['1.\t','2.\t','3.\t','4.\t','5.\t','6.\t']);
  const conv=add.find(b=>b.editKey===keys[body]);assert.equal(conv.left,18);assert.equal(conv.first,-18);assert.equal(conv.tabStops[0].pos,18);
  // Ek maddesi ayrı liste (2) olarak 1'den başlar
  const ek=edits.apply(r0,{[keys[body]]:{role:'attachment-item'}}).blocks.find(b=>b.editKey===keys[body]);
  assert.equal(ek.listId,'2');assert.equal(ek.runs[0].text,'1.\t');
  // Otomatik liste kipinde UDF listesi olur
  const auto=edits.apply(r0,{[keys[body]]:{role:'result-item'}},{listMode:'auto'}).blocks.find(b=>b.editKey===keys[body]);
  assert.equal(auto.list.id,'1');assert(!auto.listMarker);
});
test('v1.5 elle düzenleme: metin, birleştirme, boş satır, sayfa sonu; UDF geçerli kalır',()=>{
  const keys=edits.blockKeys(IB);const body=IB.findIndex(b=>b.role==='explanation-body');
  const t=edits.apply(IB,{[keys[body]]:{text:'Yeni metin HMK m. 6 uyarınca yazıldı.'}}).blocks.find(b=>b.editKey===keys[body]);
  assert.equal(text(t),'Yeni metin HMK m. 6 uyarınca yazıldı.');assert(t.runs.some(r=>r.italic&&r.text==='HMK m. 6'),'atıf yeniden italik');
  const item=IB.findIndex(b=>b.role==='result-item');
  const ti=edits.apply(IB,{[keys[item]]:{text:'Mazeretimizin kabulüne,'}}).blocks.find(b=>b.editKey===keys[item]);
  assert.equal(text(ti),'1.\tMazeretimizin kabulüne,','liste numarası korunur');
  const sig=IB.map((b,i)=>b.role==='signature'?i:-1).filter(i=>i>=0);
  const m=edits.apply(IB,{[keys[sig[0]]]:{mergeNext:true}});
  assert.equal(m.blocks.filter(b=>b.role==='signature'||b.role==='edit-signature'||b.editKey===keys[sig[0]]).length,1);
  assert.equal(text(m.blocks.find(b=>b.editKey===keys[sig[0]])),'Davalı İsa Çiftçi Vekili Av. Fatih NAKIŞLI');
  const ins=edits.apply(IB,{[keys[sig[0]]]:{blankBefore:true,breakBefore:true,blankAfter:true}}).blocks;
  const at=ins.findIndex(b=>b.editKey===keys[sig[0]]);
  assert.equal(ins[at-2].kind,'page-break');assert.equal(ins[at-1].role,'inserted-blank');assert.equal(ins[at+1].role,'inserted-blank');
  const w=writer.write(ins,{});writer.verify?.length;assert(/<page-break \/>/u.test(w.xml));
  assert.equal(edits.blockKeys(ins).filter(Boolean).length,edits.blockKeys(IB).filter(Boolean).length,'eklenen boş satırlar anahtar almaz');
  const st=edits.state(IB[sig[0]]);assert.equal(st.align,'right');assert.equal(st.bold,true);
});
test('v1.5 denetim: temiz dilekçede hata yok; hatalı dilekçede somut uyarılar',()=>{
  const now=new Date('2026-10-14T09:00:00Z');
  const ok=checks.run(IB,ISA_R.statistics,{now});
  assert(!ok.some(c=>c.level==='error'),JSON.stringify(ok));
  const bad=ISA_TEXT.slice();bad[1]='DOSYA NO: 1929';bad[3]='VEKİLİ: Av. Fatih NAKIŞLI (UETS: 1234-5)';bad[5]='KONU: 10.10.2026 tarihli duruşmaya katılamayacağız; 31.02.2026';bad[9]='Davacı Ahmet Yılmaz Vekili';bad[10]='Av. Ali Kaya';
  const r=runText(bad,{now});const c=checks.run(r.blocks,r.statistics,{now});const codes=new Set(c.map(x=>x.code));
  for(const k of ['case-format','uets-format','date-invalid','hearing-past','signature-attorney','signature-party-name'])assert(codes.has(k),k+' '+JSON.stringify(c));
  assert.equal(c[0].level,'error','hatalar önce');
  // Geçmiş duruşmaya atıf (duruşmada verilen karar) uyarı değildir.
  const ref=ISA_TEXT.slice();ref[5]='KONU: 01.10.2026 tarihli duruşmada verilen ara karara itiraz.';
  const rr=runText(ref,{now});assert(!checks.run(rr.blocks,rr.statistics,{now}).some(x=>x.code==='hearing-past'));
  // SONUÇ girişinin başka yazılışı açıklanmamış sözcük kaybı sayılmaz.
  const intro=runText(['SONUÇ VE İSTEM','Yukarıdaki gerekçelerden dolayı;','1. Kabulüne,','Karar verilmesini talep ederim.'],{now});
  assert(!checks.run(intro.blocks,intro.statistics,{now}).some(x=>x.code==='integrity'),JSON.stringify(intro.statistics.integrity));
  const none=checks.run(runText(['Bir paragraf.']).blocks,{},{now});const nc=new Set(none.map(x=>x.code));
  assert(nc.has('court-missing')&&nc.has('result-missing'));
  assert.equal(checks.run([],{enabled:false},{now})[0].code,'profile');
  const justified=[{kind:'paragraph',alignment:'justify',runs:[{text:'A\tB'}]}];
  assert(checks.run(justified,{},{now}).some(x=>x.code==='uyap-tab-justify'));
});
test('v1.5 şablon: mahkeme başlığı, esas no ve kaynak satırları',()=>{
  assert.equal(tpl.courtHeading('Şanlıurfa 8. Asliye Hukuk Mahkemesi'),"ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE");
  assert.equal(tpl.courtHeading("Ankara Cumhuriyet Başsavcılığı'na"),"ANKARA CUMHURİYET BAŞSAVCILIĞI'NA");
  assert.equal(tpl.caseNumber('2026 / 1929'),'2026/1929 Esas');assert.equal(tpl.caseNumber('2026/1929 E.'),'2026/1929 E.');
  assert.equal(tpl.trDate('2026-10-14'),'14.10.2026');
  for(const t of tpl.TEMPLATES){
    const f={hearingDate:'14.10.2026',serviceDate:'01.10.2026',orderDate:'25.09.2026',learnDate:'01.10.2026',reason:'durusma',otherCourt:'X Mahkemesi 2026/1 E.',grounds:'Tedbir şartları oluşmamıştır.',security:true,subject:'Beyan.',
      reportDate:'01.10.2026',objections:'Hesaplama hatalıdır.',supplement:true,newExpert:true,method:'segbis',place:'Gaziantep Adliyesi',witnesses:'Ali VELİ – Gaziantep – ödeme hususu',advancePaid:true,access:true,client:'İsa ÇİFTÇİ'};
    const lines=tpl.sourceLines({court:'Şanlıurfa 8. Asliye Hukuk Mahkemesi',caseNo:'2026/1929',role:'DAVALI',client:'İsa ÇİFTÇİ',other:'Yapı ve Kredi Bankası Anonim Şirketi'},
      {topic:t.topic(f),body:t.body(f),requests:t.requests(f),closing:t.closing,attachments:t.attachments(f)},{attorneyName:'Av. Fatih NAKIŞLI'});
    const n=normal.apply(tpl.toBlocks(lines));const r=legal.apply(n.blocks,{selection:n.selection,now:NOW});
    const B2=r.blocks;
    assert.equal(B2[0].role,'court-heading',t.id);
    assert.equal(text(B2.find(b=>b.fieldLabel==='VEKİLİ')),'VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)',t.id);
    assert.equal(text(B2.find(b=>b.fieldLabel==='DOSYA NO')),'DOSYA NO\t: 2026/1929 Esas',t.id);
    assert.equal(B2.filter(b=>b.role==='result-item').length,t.requests(f).length,t.id);
    assert.equal(B2.filter(b=>b.role==='result-closing').length,1,t.id);
    assert(/14\.10\.2026$/u.test(text(B2.find(b=>b.role==='result-closing'))),t.id);
    assert.deepEqual(arr(B2.filter(b=>b.role==='signature').map(text)),['Davalı İsa ÇİFTÇİ Vekili','Av. Fatih NAKIŞLI'],t.id);
    assert(!checks.run(B2,r.statistics,{now:NOW}).some(c=>c.level==='error'),t.id);
    assert(!lines.some(l=>l.includes('…')),t.id+' boş alan kalmadı');
  }
  assert.equal(tpl.TEMPLATES.length,8);
  const ids=new Set(tpl.TEMPLATES.map(t=>t.id));assert.equal(ids.size,8,'şablon kimlikleri tekil');
  const bk=tpl.byId('bilirkisi');assert.deepEqual(arr(bk.requests({supplement:false,newExpert:true})),['Bilirkişi raporuna yönelik itirazlarımızın kabulüne,','Yeni bir bilirkişi (heyeti) atanarak yeniden inceleme yapılmasına,']);
  assert(/e-Duruşma/u.test(tpl.byId('segbis').body({method:'edurusma',hearingDate:'20.10.2026'})[0]));
  assert.deepEqual(arr(tpl.byId('tanik').body({witnesses:'A – B – C\nD – E – F'}).slice(1)),['Tanık 1: A – B – C','Tanık 2: D – E – F']);
  assert(/İsa ÇİFTÇİ/u.test(tpl.byId('vekalet').body({client:'İsa ÇİFTÇİ',access:true})[0]));
  const empty=tpl.sourceLines({role:'DAVALI'},{body:[],requests:[]},{});
  assert(empty.some(l=>l.includes('…')),'boş alan … ile gösterilir, uydurulmaz');
});

/* ----------------------------- v1.6.0 yapıştırma ----------------------------- */
const PDF_TEXT=['ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ\'NE','DOSYA NO : 2026/1929 Esas','DAVALI : İsa ÇİFTÇİ','AÇIKLAMALAR :',
  'Mahkemenizin yukarıda esas numarası belirtilen dosyasının 14.10.2026 tarihli','duruşmasına, şehir dışında bulunmamız ve önceden planlanmış diğer mesleki iş ve','işlemlerimiz nedeniyle katılım sağlayamayacağımızdan mesleki mazeretimizin','kabulünü talep etmekteyiz.',
  '1','Mahkemenizin 08.10.2026 tarihli ara kararıyla müvekkil yönünden ek cevap süresi verilmiş olup cevap sürem-','iz henüz sona ermemiştir.','Sayfa 2 / 2','SONUÇ VE İSTEM : Yukarıda arz edilen sebeplerle;'].join('\n');
test('v1.6 kaynak tanıma: Word, Google, LibreOffice, UYAP, yapay zekâ, web, PDF, WhatsApp, e-posta, düz metin',()=>{
  assert.equal(paste.detect({html:'<html xmlns:w="urn:schemas-microsoft-com:office:word"><p class=MsoNormal>a</p>'}),'word');
  assert.equal(paste.detect({html:'<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1a2b"><p>a</p></b>'}),'gdocs');
  assert.equal(paste.detect({html:'<meta name="generator" content="LibreOffice 7.6"><p>a</p>'}),'libre');
  assert.equal(paste.detect({html:'<html>\n  <head>\n\n  </head>\n  <body>\n    <p style="margin-top: 0">\n      a\n    </p>'}),'uyap');
  assert.equal(paste.detect({html:'<div class="markdown prose"><p><strong>a</strong></p></div>'}),'ai');
  assert.equal(paste.detect({html:'<p>a</p>'}),'web');
  assert.equal(paste.detect({text:PDF_TEXT}),'pdf');
  assert.equal(paste.detect({text:'[14.10.2026 09:12] Ali: Dilekçe şöyle\n[14.10.2026 09:13] Ali: KONU: mazeret'}),'whatsapp');
  assert.equal(paste.detect({text:'Kimden: Ali\nKime: Fatih\nKonu: Dilekçe\n\nMetin'}),'mail');
  assert.equal(paste.detect({text:'## Dilekçe\n**DAVALI:** Ali\n- madde'}),'ai');
  assert.equal(paste.detect({text:'DAVALI: Ali\nMetin.'}),'plain');
});
test('v1.6 PDF: cümle ortası satırlar birleşir, heceleme tiresi ve sayfa numaraları kalkar, etiket satırları korunur',()=>{
  const r=paste.textToBlocks(PDF_TEXT,'pdf');const t=r.blocks.map(text);
  assert(t.includes('Mahkemenizin yukarıda esas numarası belirtilen dosyasının 14.10.2026 tarihli duruşmasına, şehir dışında bulunmamız ve önceden planlanmış diğer mesleki iş ve işlemlerimiz nedeniyle katılım sağlayamayacağımızdan mesleki mazeretimizin kabulünü talep etmekteyiz.'),JSON.stringify(t));
  assert(t.includes('Mahkemenizin 08.10.2026 tarihli ara kararıyla müvekkil yönünden ek cevap süresi verilmiş olup cevap süremiz henüz sona ermemiştir.'),JSON.stringify(t));
  assert(!t.includes('1')&&!t.some(x=>/Sayfa 2/u.test(x)));
  assert(t.includes('DOSYA NO : 2026/1929 Esas')&&t.includes('DAVALI : İsa ÇİFTÇİ'));
  assert(r.notes.some(n=>/sayfa numarası/u.test(n))&&r.notes.some(n=>/heceleme/u.test(n)));
});
test('v1.6 yapay zekâ/Markdown, WhatsApp ve e-posta temizliği',()=>{
  const md=paste.textToBlocks('## MAZERET DİLEKÇESİ\n**DAVALI:** İsa ÇİFTÇİ\n* Duruşmanın ertelenmesine,\n| A | B |\n|---|---|\n| 1 | 2 |\n```\nkod\n```','ai').blocks;
  assert.equal(text(md[0]),'MAZERET DİLEKÇESİ');assert(md[0].runs[0].bold);
  assert.equal(text(md[1]),'DAVALI: İsa ÇİFTÇİ');assert(md[1].runs[0].bold&&!md[1].runs[1].bold);
  assert.equal(text(md[2]),'- Duruşmanın ertelenmesine,');assert.equal(text(md[3]),'A\tB');assert.equal(text(md[4]),'1\t2');assert.equal(text(md[5]),'kod');
  const wa=paste.textToBlocks('[14.10.2026 09:12] Ali Veli: DAVALI: İsa\n14.10.2026 09:13 - Ali Veli: KONU: Mazeret','whatsapp');
  assert.deepEqual(arr(wa.blocks.map(text)),['DAVALI: İsa','KONU: Mazeret']);
  const mail=paste.textToBlocks('Kimden: a@b\nKime: c@d\nKonu: Dilekçe taslağı\n\n> DAVALI: İsa\n> KONU: Mazeret','mail');
  assert.deepEqual(arr(mail.blocks.map(text)),['DAVALI: İsa','KONU: Mazeret'],'e-posta Konu başlığı dilekçe KONU sanılmaz');
  const sp=paste.textToBlocks('DOSYA NO            : 2026/1\n        Girintili gövde.','plain').blocks.map(text);
  assert.deepEqual(arr(sp),['DOSYA NO\t: 2026/1','Girintili gövde.']);
});
test('v1.6 dağınık metinden dilekçe kurulur: eksik parçalar formdan, olanlar korunur, hiçbir şey uydurulmaz',()=>{
  const raw='Şanlıurfa 8. Asliye Hukuk Mahkemesine\n\nMahkemenizin dosyasının 20.10.2026 tarihli duruşmasına şehir dışında olmamız nedeniyle katılamayacağız.\nYukarıda açıklanan nedenlerle mazeretimizin kabulüne karar verilmesini saygıyla talep ederiz.';
  const parsed=paste.parse({text:raw});assert.equal(parsed.source,'plain');
  const a0=paste.analyze(parsed.blocks);assert.equal(a0.has.court,false);assert.equal(a0.courtCandidate,0);assert.equal(a0.has.explanations,false);
  const asm=paste.assemble(parsed.blocks,{caseNo:'2026/1929',role:'DAVALI',client:'İsa ÇİFTÇİ',other:'Yapı ve Kredi Bankası Anonim Şirketi',topic:'20.10.2026 tarihli duruşmaya ilişkin mazeretimizin sunulmasıdır.'},{});
  assert.deepEqual(arr(asm.addedKeys).sort(),['attorney','caseNo','client','court','explanations','other','result','signature','topic'].sort());
  const n=normal.apply(asm.blocks);const r=legal.apply(n.blocks,{selection:n.selection,now:new Date('2026-10-14T09:00:00Z'),listMode:'text'});
  const lines=r.blocks.map(text);
  for(const e of ["ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİNE",'DOSYA NO\t: 2026/1929 Esas','DAVALI\t: İsa ÇİFTÇİ','VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)','DAVACI\t: Yapı ve Kredi Bankası Anonim Şirketi',
    'KONU\t: 20.10.2026 tarihli duruşmaya ilişkin mazeretimizin sunulmasıdır.','AÇIKLAMALAR\t:','SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;','1.\tMazeretimizin kabulüne,','Karar verilmesini saygıyla talep ederiz. 14.10.2026','Davalı İsa ÇİFTÇİ Vekili','Av. Fatih NAKIŞLI'])
    assert(lines.includes(e),e+'\n'+JSON.stringify(lines));
  assert.equal(r.blocks[0].role,'court-heading');
  assert(!checks.run(r.blocks,r.statistics,{now:new Date('2026-10-14T09:00:00Z')}).some(c=>c.level==='error'));
  // Formda boş bırakılan bilgi eklenmez.
  const bare=paste.assemble(parsed.blocks,{addSignature:false},{});
  assert(!bare.blocks.some(b=>/DOSYA NO|DAVACI|KONU|Vekili/u.test(text(b))));
  // Zaten tam olan dilekçeye hiçbir şey eklenmez.
  const full=paste.assemble(paste.parse({text:ISA.join('\n')}).blocks,{caseNo:'9999/1',client:'X',other:'Y',topic:'Z'},{});
  assert.deepEqual(arr(full.added),[]);
});
test('v1.6 denetim düzeltmeleri: künye satırları doğru yere, kapanışsız talep listesi, düz madde listesi yapay zekâ sanılmaz',()=>{
  const raw="ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE\nDAVALI: İsa ÇİFTÇİ\nADRESİ: Haliliye/Şanlıurfa\nDAVACI: Yapı ve Kredi Bankası Anonim Şirketi\nKONU: Mazeret.\nDuruşmaya katılamayacağız.\nYukarıda açıklanan nedenlerle;\n1. Mazeretimizin kabulüne,\n2. Duruşmanın ertelenmesine,";
  const asm=paste.assemble(paste.parse({text:raw}).blocks,{caseNo:'2026/1929',role:'DAVALI',addSignature:false},{});
  assert.deepEqual(arr(asm.blocks.map(text)),["ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE",'DOSYA NO: 2026/1929 Esas','DAVALI: İsa ÇİFTÇİ','ADRESİ: Haliliye/Şanlıurfa','VEKİLİ: Av. Fatih NAKIŞLI',
    'DAVACI: Yapı ve Kredi Bankası Anonim Şirketi','KONU: Mazeret.','AÇIKLAMALAR','Duruşmaya katılamayacağız.','SONUÇ VE İSTEM','Yukarıda açıklanan nedenlerle;','1. Mazeretimizin kabulüne,','2. Duruşmanın ertelenmesine,']);
  const one=paste.assemble(paste.parse({text:"DAVALI: Ali VELİ\nKONU: Mazeret.\nAçıklama."}).blocks,{other:'Banka A.Ş.',addSignature:false,role:'DAVALI'},{});
  assert.deepEqual(arr(one.blocks.map(text)).slice(0,4),['DAVALI: Ali VELİ','VEKİLİ: Av. Fatih NAKIŞLI','DAVACI: Banka A.Ş.','KONU: Mazeret.'],'karşı taraf KONU\'dan önce');
  assert.equal(paste.detect({text:'DAVALI: Ali\n- birinci madde\n- ikinci madde'}),'plain');
  assert.equal(paste.textToBlocks('Bu  cümlede     fazla boşluk var.','plain').blocks.map(text)[0],'Bu cümlede fazla boşluk var.','gövdede sekme oluşmaz');
});
console.log(failed?`SONUÇ ${count} başarılı, ${failed} BAŞARISIZ`:`SONUÇ ${count} mantık testi başarılı`);
if(failed)process.exitCode=1;
