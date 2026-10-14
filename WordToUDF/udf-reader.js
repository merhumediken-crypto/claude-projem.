/* Read-only UDF 1.8 reader. Never applies Word→UDF normalization rules. */
(() => {
  'use strict';
  const allowedRun = new Set(['startOffset','length','family','size','bold','italic','underline','strikeThrough',
    'foreground','background','description','style','styleName','resolver','fieldType','fieldName',
    'fieldGroupName','isList','header','Alignment','LeftIndent','RightIndent','FirstLineIndent',
    'SpaceAbove','SpaceBelow','LineSpacing']);
  const allowedP = new Set(['Alignment','LeftIndent','RightIndent','FirstLineIndent','Hanging','SpaceAbove',
    'SpaceBelow','LineSpacing','TabSet','description','style','styleName','resolver','GroupName','RepeatingLabel','header',
    'family','size','bold','italic','underline','strikeThrough','foreground','background',
    'Numbered','NumberType','ListLevel','ListId','Bulleted','BulletType']);
  const children = (node, name) => [...(node?.children || [])].filter(el => el.localName === name);
  const one = (node, name) => children(node, name)[0] || null;
  const attr = (node, name) => node?.getAttribute(name) ?? null;
  const asNum = (raw, context, min=-1e5, max=1e5) => {
    if (raw == null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${context} geçersiz.`);
    return n;
  };
  const asBool = (raw, context) => {
    if (raw == null) return undefined;
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw new Error(`${context} geçersiz.`);
  };
  const rgb = raw => {
    if (raw == null) return undefined;
    if (/^-?\d+$/u.test(raw)) {
      const n = Number(raw);
      if (Number.isSafeInteger(n) && n >= -2147483648 && n <= 4294967295)
        return (n >>> 0 & 0xffffff).toString(16).padStart(6,'0').toUpperCase();
    }
    if (/^#?[a-fA-F\d]{6}$/u.test(raw)) return raw.replace('#','').toUpperCase();
    throw new Error('UDF metin rengi çözümlenemedi.');
  };
  const warn = (warnings, message, blocking=false) => {
    if (!warnings.some(w => w.message === message)) warnings.push({message, blocking});
  };
  const extra = (node, allowed, warnings, context) => {
    for (const a of node.attributes)
      if (!allowed.has(a.name)) warn(warnings, `${context}: ${a.name} özelliğinin birebir aktarımı desteklenmiyor.`);
  };
  const alignMap = {0:'left',1:'center',2:'right',3:'justify'};
  function assertXmlComplexity(doc,maxNodes=140000,maxDepth=64) {
    const root=doc.documentElement;if(!root)return;
    let count=0,stack=[[root,1]];
    while(stack.length){const [node,depth]=stack.pop();if(++count>maxNodes)throw new Error('UDF XML öğe sayısı güvenlik sınırını aşıyor.');if(depth>maxDepth)throw new Error('UDF XML iç içe geçme sınırını aşıyor.');for(const child of node.children)stack.push([child,depth+1]);}
  }

  const numberTypeMap = {
    NUMBER_TYPE_NUMBER_DOT:{format:'decimal',suffix:'.'},
    NUMBER_TYPE_NUMBER_PARENTHESIS:{format:'decimal',suffix:')'},
    NUMBER_TYPE_CHAR_SMALL_DOT:{format:'lowerLetter',suffix:'.'},
    NUMBER_TYPE_CHAR_SMALL_PARENTHESIS:{format:'lowerLetter',suffix:')'},
    NUMBER_TYPE_CHAR_BIG_DOT:{format:'upperLetter',suffix:'.'},
    NUMBER_TYPE_CHAR_BIG_PARENTHESIS:{format:'upperLetter',suffix:')'},
    NUMBER_TYPE_ROMAN_SMALL_DOT:{format:'lowerRoman',suffix:'.'},
    NUMBER_TYPE_ROMAN_SMALL_PARENTHESIS:{format:'lowerRoman',suffix:')'},
    NUMBER_TYPE_ROMAN_BIG_DOT:{format:'upperRoman',suffix:'.'},
    NUMBER_TYPE_ROMAN_BIG_PARENTHESIS:{format:'upperRoman',suffix:')'}
  };
  const bulletTypeMap = {
    BULLET_TYPE_ELLIPSE:'•', BULLET_TYPE_FILLED_CIRCLE:'•', BULLET_TYPE_CIRCLE:'○',
    BULLET_TYPE_RECTANGLE:'■', BULLET_TYPE_SQUARE:'■', BULLET_TYPE_ARROW:'➤', BULLET_TYPE_DIAMOND:'◆'
  };
  function normalizeNumberType(raw, warnings) {
    if (!raw) return {raw:'NUMBER_TYPE_NUMBER_DOT',format:'decimal',suffix:'.'};
    if (numberTypeMap[raw]) return {raw,...numberTypeMap[raw]};
    const u=String(raw).toUpperCase();
    let format='decimal';
    if (/ROMAN.*(?:SMALL|LOWER)|(?:SMALL|LOWER).*ROMAN/u.test(u)) format='lowerRoman';
    else if (/ROMAN.*(?:BIG|UPPER)|(?:BIG|UPPER).*ROMAN/u.test(u)) format='upperRoman';
    else if (/(?:CHAR|ALPHA|LETTER).*(?:SMALL|LOWER)|(?:SMALL|LOWER).*(?:CHAR|ALPHA|LETTER)/u.test(u)) format='lowerLetter';
    else if (/(?:CHAR|ALPHA|LETTER).*(?:BIG|UPPER)|(?:BIG|UPPER).*(?:CHAR|ALPHA|LETTER)/u.test(u)) format='upperLetter';
    const suffix=/PAREN/u.test(u)?')':'.';
    warn(warnings,`UDF numara türü ${raw} doğrudan tanınmadı; en yakın Word/PDF karşılığı (${format}${suffix}) kullanılacak.`);
    return {raw,format,suffix};
  }
  function normalizeBulletType(raw, warnings) {
    if (!raw) return {raw:'BULLET_TYPE_ELLIPSE',symbol:'•'};
    if (bulletTypeMap[raw]) return {raw,symbol:bulletTypeMap[raw]};
    warn(warnings,`UDF madde işareti türü ${raw} doğrudan tanınmadı; • kullanılacak.`);
    return {raw,symbol:'•'};
  }
  function readList(node, warnings) {
    const numbered=asBool(attr(node,'Numbered'),'Numaralı liste') ?? false;
    const bulleted=asBool(attr(node,'Bulleted'),'Madde işaretli liste') ?? false;
    if (!numbered && !bulleted) return undefined;
    if (numbered && bulleted) warn(warnings,'Paragrafta hem Numbered hem Bulleted işaretli; UYAP görünümüne uygun olarak madde işareti öncelikli kullanılacak.');
    const rawLevel=asNum(attr(node,'ListLevel'),'Liste seviyesi',0,100) ?? 0;
    const level=Math.trunc(rawLevel);
    if (rawLevel!==level) warn(warnings,`UDF ListLevel değeri tam sayı değil (${rawLevel}); ${level} kullanıldı.`);
    const safeLevel=Math.max(0,Math.min(8,level));
    if (safeLevel!==level) warn(warnings,`UDF ListLevel ${level} Word'ün 0–8 aralığına uyarlandı.`);
    const id=attr(node,'ListId') ?? `${bulleted?'bullet':'number'}-default`;
    if (bulleted) return {kind:'bullet',id:String(id),level:safeLevel,...normalizeBulletType(attr(node,'BulletType'),warnings)};
    return {kind:'number',id:String(id),level:safeLevel,...normalizeNumberType(attr(node,'NumberType'),warnings)};
  }

  function stops(raw, warnings) {
    if (!raw) return [];
    const aligns = ['left','center','right','decimal'], leaders = ['none','dot','hyphen'];
    return raw.split(',').map(part => {
      const bits = part.split(':');
      if (bits.length !== 3) throw new Error('UDF sekme durağı biçimi geçersiz.');
      const [position, mode, leader] = bits;
      const pos = asNum(position, 'Sekme durağı', 0, 2000);
      const a = Number(mode), l = Number(leader);
      if (!Number.isInteger(a) || !Number.isInteger(l) || !aligns[a] || !leaders[l]) {
        warn(warnings,'UDF özel sekme durağı tam aktarılamıyor.');
        return {pos, align:'left',leader:'none'};
      }
      return {pos, align:aligns[a], leader:leaders[l]};
    });
  }
  function readStyle(node, base) {
    const size = asNum(attr(node,'size'), 'Yazı puntosu', 1, 200);
    return {
      font: attr(node,'family') || base.font,
      size: size ?? base.size,
      bold: asBool(attr(node,'bold'),'Kalınlık') ?? base.bold,
      italic: asBool(attr(node,'italic'),'İtalik') ?? base.italic,
      underline: asBool(attr(node,'underline'),'Alt çizgi') ?? base.underline,
      strike: asBool(attr(node,'strikeThrough'),'Üstü çizili') ?? base.strike,
      color: rgb(attr(node,'foreground')) ?? base.color,
      background: rgb(attr(node,'background')) ?? base.background
    };
  }
  function readParagraphStyle(node, styles, warnings) {
    const format = key => attr(node,key) ?? attr(styles,key);
    const a = format('Alignment');
    if (a != null && !(a in alignMap)) warn(warnings,`Bilinmeyen UDF paragraf hizası: ${a}`);
    const hanging = asNum(format('Hanging'),'Asılı girinti');
    const first = asNum(format('FirstLineIndent'),'İlk satır girintisi');
    const rawLine = asNum(format('LineSpacing'),'Satır aralığı',-0.99,9);
    return {kind:'paragraph',alignment:alignMap[a] || 'left',
      left:asNum(format('LeftIndent'),'Sol girinti'),
      right:asNum(format('RightIndent'),'Sağ girinti'),
      first:first ?? (hanging ? -hanging : undefined),
      above:asNum(format('SpaceAbove'),'Üst boşluk'),
      below:asNum(format('SpaceBelow'),'Alt boşluk'),
      line:rawLine === undefined ? undefined : 1 + rawLine,
      tabStops:stops(format('TabSet'), warnings), list:readList(node,warnings), runs:[]};
  }
  async function readUdf(buffer) {
    const archive = WordToUDFZip.openZip(buffer);
    if (!archive.has('content.xml')) throw new Error('UDF arşivinde content.xml bulunamadı.');
    const xml = await archive.text('content.xml');
    if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error('UDF DTD/ENTITY içeremez.');
    const documentNode = new DOMParser().parseFromString(xml,'application/xml');
    if (documentNode.querySelector('parsererror') || documentNode.documentElement?.localName !== 'template')
      throw new Error('UDF XML içeriği geçersiz.');
    assertXmlComplexity(documentNode);
    const root = documentNode.documentElement;
    if (attr(root,'format_id') !== '1.8') throw new Error('Yalnız UDF 1.8 belgeleri destekleniyor; belge değiştirilmedi.');
    const content = one(root,'content'), elements = one(root,'elements'), properties = one(root,'properties');
    if (!content || !elements) throw new Error('UDF metin veya belge öğeleri eksik.');
    const fullText = content.textContent || '';
    if (fullText.length > 8*1024*1024) throw new Error('UDF metni 8 MB sınırını aşıyor.');
    const warnings = [], used = [];
    let parsedParagraphs=0, parsedRuns=0, parsedCells=0;
    const styleNodes = children(one(root,'styles'),'style');
    const styleMap = new Map(styleNodes.map(el => [attr(el,'name'),el]));
    const normal = styleMap.get('default'), bodyStyle = styleMap.get(attr(elements,'resolver')) || styleMap.get('hvl-default') || normal;
    const fontBase = {font:'Times New Roman',size:12,bold:false,italic:false,underline:false,strike:false,color:'000000',background:undefined};
    const defaults = readStyle(bodyStyle, readStyle(normal,fontBase));
    const styleCache = new Map();
    function styleFor(name, trail = new Set()) {
      if (!name) return defaults;
      if (styleCache.has(name)) return styleCache.get(name);
      const node = styleMap.get(name);
      if (!node) {warn(warnings,`UDF karakter stili ${name} bulunamadı; varsayılan biçim kullanıldı.`);return defaults;}
      if (trail.has(name) || trail.size > 12) throw new Error('UDF stil tanımları döngülü veya çok derin.');
      const next = new Set(trail);next.add(name);
      const parent = attr(node,'resolver');
      const s = readStyle(node,parent && parent !== name ? styleFor(parent,next) : defaults);
      styleCache.set(name,s);
      return s;
    }
    function paraStyle(node) {
      const name=attr(node,'resolver');
      const resolved = name ? styleMap.get(name) : bodyStyle;
      if (name && !resolved) warn(warnings,`UDF paragraf stili ${name} bulunamadı; varsayılan düzen kullanıldı.`);
      const parent = resolved && attr(resolved,'resolver') ? styleMap.get(attr(resolved,'resolver')) : bodyStyle;
      const styleNode = resolved || parent || bodyStyle;
      return readParagraphStyle(node,styleNode,warnings);
    }
    let fieldWarning = false;
    function parseParagraph(node) {
      if(++parsedParagraphs>12000)throw new Error('UDF 12.000 paragraf güvenlik sınırını aşıyor.');
      extra(node,allowedP,warnings,'Paragraf');
      if (node.hasAttribute('style') || node.hasAttribute('styleName')) warn(warnings,'Adlandırılmış UDF paragraf stili birebir eşlenemiyor.');
      const block = paraStyle(node);
      const permitted = new Set(['content','field','space','tab']);
      for (const child of node.children) {
        const type = child.localName;
        if (!permitted.has(type)) {warn(warnings,`UDF paragrafı içinde ${type} öğesi desteklenmiyor.`);continue;}
        if(++parsedRuns>100000)throw new Error('UDF metin parçası güvenlik sınırını aşıyor.');
        extra(child,allowedRun,warnings,'Metin');
        const start = asNum(attr(child,'startOffset'),'Metin başlangıcı',0,fullText.length);
        const length = asNum(attr(child,'length'),'Metin uzunluğu',0,fullText.length);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start+length > fullText.length)
          throw new Error('UDF UTF-16 metin ofseti geçersiz.');
        const value = fullText.slice(start,start+length);
        if (type === 'tab' && (value !== '\t' || length !== 1)) throw new Error('UDF sekme içeriği geçersiz.');
        if (type === 'field' && !fieldWarning) {
          fieldWarning = true;
          warn(warnings,'UDF form alanlarındaki görüntülenen değerler aynen aktarılır; düzenlenebilir UYAP form alanı işlevi Word/PDF’ye geçmez.',false);
        }
        if (child.hasAttribute('style') || child.hasAttribute('styleName')) warn(warnings,'Adlandırılmış karakter stili için birebir eşleme bulunmuyor.');
        const resolvedBase=styleFor(attr(child,'resolver') || attr(node,'resolver'));
        // UDF may place family/size and other character defaults on the paragraph itself.
        // Apply those defaults before any run-level override instead of reporting them as unsupported.
        const paragraphBase=readStyle(node,resolvedBase);
        block.runs.push({text:value,...readStyle(child,paragraphBase)});
        used.push({start,end:start+length,owner:block});
      }
      // A UDF paragraph's final LF acts as the Word paragraph boundary.
      const last=block.runs.at(-1);
      if(last && last.text.endsWith('\n')) last.text=last.text.slice(0,-1);
      return block;
    }
    function parseTable(node) {
      const allowedTable = new Set(['border']);
      extra(node,allowedTable,warnings,'Tablo');
      const border=attr(node,'border') || 'borderNone';
      if (border !== 'borderNone') warn(warnings,`UDF tablo kenarlığı (${border}) birebir aktarılamıyor.`);
      const rows=[];
      for (const child of node.children) {
        if (child.localName !== 'row') {warn(warnings,`UDF tablosu içinde ${child.localName} desteklenmiyor.`);continue;}
        extra(child,new Set(['height']),warnings,'Tablo satırı');
        const height=asNum(attr(child,'height'),'Tablo satır yüksekliği',0,2000);
        const cells=[];
        for(const cell of child.children){
          if(cell.localName !== 'cell'){warn(warnings,`UDF tablosundaki ${cell.localName} öğesi desteklenmiyor.`);continue;}
          extra(cell,new Set(),warnings,'Tablo hücresi');
          const blocks=[];
          for(const p of cell.children){
            if(p.localName==='paragraph')blocks.push(parseParagraph(p));
            else warn(warnings,`UDF tablo hücresindeki ${p.localName} öğesi desteklenmiyor.`);
          }
          if(++parsedCells>20000)throw new Error('UDF tablo hücresi güvenlik sınırını aşıyor.');
          cells.push({blocks:blocks.length?blocks:[{kind:'paragraph',alignment:'left',tabStops:[],runs:[]}]});
        }
        rows.push({height,cells});
      }
      if(!rows.length)warn(warnings,'Boş UDF tablosu düzen bilgisi korunamıyor.');
      if(rows.length>1500 || rows.some(r=>r.cells.length>150))throw new Error('UDF tablosu boyut sınırını aşıyor.');
      return {kind:'table',border:'none',rows};
    }
    const pageFormat = one(properties,'pageFormat');
    if (!pageFormat) warn(warnings,'UDF sayfa ayarları bulunamadı.');
    const media = attr(pageFormat,'mediaSizeName');
    if (media !== null && media !== '1') warn(warnings,`UDF sayfa boyutu (${media}) için birebir eşleme bulunmuyor.`);
    const orientation = attr(pageFormat,'paperOrientation');
    if (orientation !== null && !['0','1'].includes(orientation)) warn(warnings,'UDF kâğıt yönü desteklenmiyor.');
    const margins = {};
    for (const side of ['left','right','top','bottom']) margins[side]=asNum(attr(pageFormat,`${side}Margin`),`${side} sayfa kenarı`,0,500) ?? 42.52;
    const options={margins,landscape:orientation==='0',font:defaults.font,size:defaults.size,
      headerOffset:asNum(attr(pageFormat,'headerFOffset'),'Üstbilgi mesafesi',0,200),
      footerOffset:asNum(attr(pageFormat,'footerFOffset'),'Altbilgi mesafesi',0,200)};
    const knownExtras=new Set(['content.xml','documentproperties.xml','sign.sgn']);
    for(const name of archive.names){
      if(name==='sign.sgn')warn(warnings,'UDF elektronik imzası DOCX/PDF’ye geçerli kriptografik imza olarak taşınamaz; yeniden imzalanması gerekir.',false);
      else if(name==='documentproperties.xml')warn(warnings,'UDF belge kayıt/meta verileri Word/PDF dosya özelliklerine birebir aktarılmaz.',false);
      else if(!knownExtras.has(name))warn(warnings,`UDF arşivindeki ${name} ekinin aktarımı desteklenmiyor.`);
    }
    const blocks=[], other={header:[],footer:[]};
    for(const child of elements.children){
      if(child.localName==='paragraph')blocks.push(parseParagraph(child));
      else if(child.localName==='table')blocks.push(parseTable(child));
      else if(child.localName==='page-break')blocks.push({kind:'page-break'});
      else if(child.localName==='header'||child.localName==='footer')other[child.localName].push(child);
      else warn(warnings,`UDF ${child.localName} öğesi birebir aktarılamıyor.`);
    }
    const specials = name => {
      const output=[];
      for (const parent of [...children(root,name),...other[name]]){
        for(const child of parent.children){
          if(child.localName==='paragraph')output.push(parseParagraph(child));
          else warn(warnings,`UDF ${name} içindeki ${child.localName} öğesi desteklenmiyor.`);
        }
      }
      return output;
    };
    const headers=specials('header'), footers=specials('footer');
    const ordered = [...used].sort((a,b)=>a.start-b.start || a.end-b.end);
    let position=0, previous=null;
    for(const span of ordered){
      if(span.start<position)throw new Error('UDF metin ofsetleri çakışıyor; belge değiştirilmedi.');
      if(span.start>position){
        const gap=fullText.slice(position,span.start);
        // Some UYAP versions keep the paragraph LF outside formatting spans.
        // In DOCX the structural paragraph boundary represents precisely one LF.
        if(!/^\r?\n$/u.test(gap) || previous===span.owner)
          throw new Error(`UDF metninde açıklanamayan boşluk (karakter ${position}–${span.start}); belge değiştirilmedi.`);
      }
      position=span.end;
      previous=span.owner;
    }
    if (position!==fullText.length && !/^\r?\n$/u.test(fullText.slice(position)))
      throw new Error('UDF sonunda görünür metin belge öğeleriyle eşleşmiyor; belge değiştirilmedi.');
    return {blocks,headers,footers,options,warnings,fullText,
      statistics:{paragraphs:blocks.filter(b=>b.kind==='paragraph').length,
        tableRows:blocks.filter(b=>b.kind==='table').reduce((n,t)=>n+t.rows.length,0),
        characters:fullText.length,breaks:blocks.filter(b=>b.kind==='page-break').length,
        headers:headers.length,footers:footers.length}};
  }
  globalThis.WordToUDFReader={readUdf};
})();
