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
for(const name of ['normalize.js','legal-typography.js','udf.js'])vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),ctx,{filename:name});
const normal=ctx.WordToUDFNormalize, legal=ctx.WordToUDFLegalTypography, writer=ctx.WordToUDFWriter;
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
test('WTU-026 etiket ve iki nokta kalın-altı çizili, tab ve değer altı çizgisiz/normal',()=>{
  for(const b of fields){
    const [label,tab,colon,...value]=b.runs;
    assert(label.bold&&label.underline,b.fieldLabel);assert(colon.bold&&colon.underline);
    assert.equal(tab.underline,false);assert.equal(tab.bold,false);
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
  assert(/connect-src 'none'/u.test(m.content_security_policy.extension_pages));assert.equal(m.version,'1.4.1');
  for(const f of fs.readdirSync(root).filter(f=>f.endsWith('.js')))assert(!/\bfetch\(|XMLHttpRequest|WebSocket|eval\(|new Function/u.test(fs.readFileSync(path.join(root,f),'utf8')),f);
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
console.log(failed?`SONUÇ ${count} başarılı, ${failed} BAŞARISIZ`:`SONUÇ ${count} mantık testi başarılı`);
if(failed)process.exitCode=1;
