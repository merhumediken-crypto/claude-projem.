/* Dependency-free OOXML text and formatting importer for the standalone extension. */
(() => {
  'use strict';
  const W1='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const W2='http://purl.oclc.org/ooxml/wordprocessingml/main';
  const W=x=>x&&(x.namespaceURI===W1||x.namespaceURI===W2);
  const has=(x,name)=>!!x&&W(x)&&x.localName===name;
  const kids=(el,name)=>el?[...el.children].filter(x=>has(x,name)):[];
  const kid=(el,name)=>kids(el,name)[0]||null;
  const attr=(el,name)=>el?(el.getAttributeNS(el.namespaceURI,name)??el.getAttribute('w:'+name)??el.getAttribute(name)):null;
  function assertXmlComplexity(doc,name,maxNodes=120000,maxDepth=64){
    const root=doc.documentElement;if(!root)return;
    let count=0,stack=[[root,1]];
    while(stack.length){const [node,depth]=stack.pop();if(++count>maxNodes)throw new Error(`${name} XML öğe sayısı güvenlik sınırını aşıyor.`);if(depth>maxDepth)throw new Error(`${name} XML iç içe geçme sınırını aşıyor.`);for(const child of node.children)stack.push([child,depth+1]);}
  }
  function parseXml(xml,name){
    if(/<!DOCTYPE|<!ENTITY/iu.test(xml))throw new Error(`${name} içinde DTD/harici varlık kullanımı yasak.`);
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error(`${name} XML ayrıştırılamadı.`);
    assertXmlComplexity(doc,name);
    return doc;
  }
  const twips=v=>{if(v===null||v===undefined||v==='')return undefined;const n=Number(v);return Number.isFinite(n)?n/20:undefined;};
  const num=v=>{if(v===null||v===undefined||v==='')return undefined;const n=Number(v);return Number.isFinite(n)?n:undefined;};
  const parseBool=e=>e===null?undefined:!['0','false','off'].includes(String(attr(e,'val')??'true').toLowerCase());
  const toggle=(rpr,name)=>{const el=kid(rpr,name);return el?parseBool(el):undefined;};
  function readTheme(xml,warning) {
    const fallback={colors:new Map(),fonts:{},mapping:new Map()};
    if(!xml)return fallback;
    const theme=parseXml(xml,'word/theme/theme1.xml');
    const elements=[...theme.getElementsByTagName('*')];
    const scheme=elements.find(x=>x.localName==='clrScheme');
    if(scheme) for(const item of scheme.children) {
      const entry=[...item.children].find(x=>x.localName==='srgbClr'||x.localName==='sysClr');
      const raw=entry&&(entry.getAttribute('lastClr')||entry.getAttribute('val'));
      if(raw&&/^[a-f0-9]{6}$/i.test(raw))fallback.colors.set(item.localName,raw.toUpperCase());
    }
    const fs=elements.find(x=>x.localName==='fontScheme');
    for(const [kind,selector] of [['major','majorFont'],['minor','minorFont']]){
      const parent=fs&&[...fs.children].find(x=>x.localName===selector);
      const latin=parent&&[...parent.children].find(x=>x.localName==='latin');
      if(latin)fallback.fonts[kind]=latin.getAttribute('typeface')||'';
    }
    if(!scheme)warning('theme','Belge teması okunamadı; tema renkleri uygulanamadı.');
    return fallback;
  }
  const schemeAliases={text1:'dk1',background1:'lt1',text2:'dk2',background2:'lt2',dark1:'dk1',light1:'lt1',dark2:'dk2',light2:'lt2',hyperlink:'hlink',followedHyperlink:'folHlink'};
  function themeRgb(color,theme) {
    const src={text1:'t1',background1:'bg1',text2:'t2',background2:'bg2'}[color]||color;
    const mapped=theme.mapping.get(src)||src;
    const key=schemeAliases[mapped]||mapped;
    return theme.colors.get(key)||theme.colors.get(color)||null;
  }
  function applyColorModifier(rgb, tint, shade) {
    const tintVal=tint&&/^[a-f0-9]{2}$/i.test(tint)?parseInt(tint,16)/255:null;
    const shadeVal=shade&&/^[a-f0-9]{2}$/i.test(shade)?parseInt(shade,16)/255:null;
    if(tintVal===null&&shadeVal===null)return rgb;
    // Word processes theme tint/shade in HSL luminance, not per RGB channel.
    const [r,g,b]=rgb.match(/../g).map(v=>parseInt(v,16)/255);
    const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
    let h=0,s=0,l=(max+min)/2;
    if(delta){
      s=delta/(1-Math.abs(2*l-1));
      switch(max){
        case r:h=((g-b)/delta)%6;break;
        case g:h=(b-r)/delta+2;break;
        default:h=(r-g)/delta+4;
      }
      h=(h/6+1)%1;
    }
    if(tintVal!==null)l=l*tintVal+(1-tintVal);
    else l=l*shadeVal; // OOXML: themeShade ignored if themeTint is set.
    l=Math.max(0,Math.min(1,l));
    const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;
    const hue=v=>{
      v=(v+1)%1;
      if(v<1/6)return p+(q-p)*6*v;
      if(v<.5)return q;
      if(v<2/3)return p+(q-p)*(2/3-v)*6;
      return p;
    };
    const result=s===0?[l,l,l]:[hue(h+1/3),hue(h),hue(h-1/3)];
    return result.map(v=>Math.max(0,Math.min(255,Math.round(v*255))).toString(16).padStart(2,'0')).join('').toUpperCase();
  }
  function readRPr(rpr,warning,theme){
    const props={};if(!rpr)return props;
    const fonts=kid(rpr,'rFonts');
    const font=fonts&&(attr(fonts,'ascii')||attr(fonts,'hAnsi')||attr(fonts,'eastAsia')||attr(fonts,'cs'));
    if(font)props.font=font.slice(0,80);
    if(fonts&&attr(fonts,'ascii')&&attr(fonts,'hAnsi')&&attr(fonts,'ascii')!==attr(fonts,'hAnsi'))
      warning('font-script','Word metni Latin ve genişletilmiş karakterler için farklı yazı tipleri kullanıyor; tek yazı tipine indirgenmiştir.');
    else if(fonts){
      const code=attr(fonts,'asciiTheme')||attr(fonts,'hAnsiTheme')||attr(fonts,'eastAsiaTheme')||'';
      const which=/major/iu.test(code)?'major':/minor/iu.test(code)?'minor':'';
      if(which&&theme.fonts[which])props.font=theme.fonts[which].slice(0,80);
      else if(code)warning('font-theme','Tema yazı tipi çözümlenemedi; belge varsayılanı kullanıldı.');
    }
    const size=twips(attr(kid(rpr,'sz'),'val'));
    if(size!==undefined){
      const points=size*10; // DOCX w:sz is expressed in half-points.
      if(points<6||points>96)warning('font-size','6–96 punto dışındaki Word yazı boyutları desteklenen aralığa uyarlandı.');
      props.size=Math.max(6,Math.min(96,points));
    }
    // twips(val) * 10 == sz / 2
    for(const [tag,key] of [['b','bold'],['i','italic'],['strike','strike'],['dstrike','strike']]){
      const e=kid(rpr,tag);if(e)props[key]=parseBool(e);
    }
    const underline=kid(rpr,'u');if(underline){
      const kind=String(attr(underline,'val')??'single');
      props.underline=!['none','0'].includes(kind);
      if(!['none','0','single'].includes(kind))warning('underline','Çift/dalgalı gibi özel alt çizgiler düz alt çizgiye dönüştürüldü.');
    }
    const color=kid(rpr,'color');if(color){
      const key=attr(color,'themeColor'),themed=key&&themeRgb(key,theme);
      const v=attr(color,'val');
      if(themed)props.color=applyColorModifier(themed,attr(color,'themeTint'),attr(color,'themeShade'));
      else if(v&&/^[0-9a-f]{6}$/i.test(v))props.color=v.toUpperCase();
      else if(v==='auto') { props.color='000000';warning('auto-color','Word otomatik metin rengi UDF’de siyah olarak ayarlandı.'); }
      else if(key||v)warning('theme-color','Word tema rengi çözümlenemedi; varsayılan renk kullanıldı.');
    }
    if(toggle(rpr,'vanish')||toggle(rpr,'webHidden'))props.hidden=true;
    // Only real values count: highlight "none", an "auto"/white clear shading,
    // spacing 0, width 100 % and baseline are Word's way of saying "nothing".
    const hl=kid(rpr,'highlight'),shd=kid(rpr,'shd');
    const shdOn=shd&&!(['auto','ffffff',''].includes(String(attr(shd,'fill')??'auto').toLowerCase())&&['clear','nil',''].includes(String(attr(shd,'val')??'clear')));
    if((hl&&!['none',''].includes(String(attr(hl,'val')??'')))||shdOn)warning('highlight','Word metin vurgusu / arka plan gölgesi aktarılmadı; metin aynen aktarıldı.',true);
    // Caps are real capitals in UDF (same look, same text); small caps become
    // capitals too. Purely visual effects never lose text: they are listed
    // as information and do not block the download.
    const caps=toggle(rpr,'caps');if(caps!==undefined)props.caps=caps;
    const small=toggle(rpr,'smallCaps');if(small!==undefined)props.smallCaps=small;
    if(['outline','shadow','emboss','imprint','effect'].some(name=>kid(rpr,name)))
      warning('effects','Gölge, kabartma veya dış çizgi gibi Word karakter efektleri uygulanmadı; metin aynen aktarıldı.',true);
    const sp=kid(rpr,'spacing'),wd=kid(rpr,'w');
    if((sp&&Number(attr(sp,'val')||0)!==0)||(wd&&Number(attr(wd,'val')||100)!==100))
      warning('char-spacing','Word karakter aralığı / genişlik ayarı uygulanmadı; metin aynen aktarıldı, görünüm farkı küçüktür.',true);
    if(['superscript','subscript'].includes(String(attr(kid(rpr,'vertAlign'),'val')||'')))warning('vertical','Üst simge veya alt simge düz metne aktarıldı.');
    return props;
  }
  function readPPr(ppr,warning){
    if(!ppr)return {};
    const p={};
    const alignment=attr(kid(ppr,'jc'),'val');
    if(alignment){p.alignment=({left:'left',start:'left',right:'right',end:'right',center:'center',both:'justify',distribute:'justify'})[alignment]||'left';
      if(!['left','start','right','end','center','both','distribute'].includes(alignment))warning('alignment','Özel paragraf hizalaması sola dönüştürüldü.');}
    const ind=kid(ppr,'ind');if(ind){
      const l=twips(attr(ind,'left')||attr(ind,'start')),r=twips(attr(ind,'right')||attr(ind,'end'));
      const first=twips(attr(ind,'firstLine')),hanging=twips(attr(ind,'hanging'));
      if(l!==undefined)p.left=l;if(r!==undefined)p.right=r;
      if(first!==undefined)p.first=first;else if(hanging!==undefined)p.first=-hanging;
    }
    const spacing=kid(ppr,'spacing');if(spacing){
      const above=twips(attr(spacing,'before')),below=twips(attr(spacing,'after'));
      if(above!==undefined)p.above=above;if(below!==undefined)p.below=below;
      const line=num(attr(spacing,'line')),rule=attr(spacing,'lineRule')||'auto';
      if(line!==undefined&&rule==='auto')p.line=line/240;
      else if(line!==undefined)warning('line','Word sabit/en az satır yüksekliği birebir aktarılamadı.');
    }
    const numbering=kid(ppr,'numPr');if(numbering){
      p.numId=attr(kid(numbering,'numId'),'val');p.ilvl=Number(attr(kid(numbering,'ilvl'),'val')||0);
    }
    if(kid(ppr,'pageBreakBefore'))p.pageBreakBefore=parseBool(kid(ppr,'pageBreakBefore'));
    const tabs=kid(ppr,'tabs');
    if(tabs){
      const stops=[];
      for(const tab of kids(tabs,'tab')){
        const pos=twips(attr(tab,'pos'));
        if(pos===undefined||pos<0||pos>2000){warning('tabs','Desteklenmeyen Word sekme konumu atlandı.');continue;}
        const val=attr(tab,'val')||'left',leader=attr(tab,'leader')||'none';
        if(!['left','start','center','right','end','decimal','clear'].includes(val))warning('tab-type','Özel Word sekme hizalaması sola sadeleştirildi.');
        if(!['none','dot','hyphen'].includes(leader))warning('tab-leader','Özel Word sekme öncüsü korunamadı.');
        stops.push({pos,align:val,leader});
      }
      p.tabStops=stops;
    }
    if(kid(ppr,'bidi'))warning('bidi','Sağdan sola paragraf düzeni kontrol edilmelidir.');
    return p;
  }
  function roman(n){if(n<1||n>3999)return String(n);let result='';for(const [v,s] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]){while(n>=v){result+=s;n-=v;}}return result;}
  function alpha(n){let s='';while(n>0){n--;s=String.fromCharCode(65+n%26)+s;n=Math.floor(n/26);}return s;}
  async function readDocx(buffer) {
    const zip=globalThis.WordToUDFZip.openZip(buffer),warnings=new Map();
    // minor: listed for information only, does not require "inceledim" before download.
    const warn=(code,message,minor=false)=>{const old=warnings.get(code);warnings.set(code,{code,message,count:(old?.count||0)+1,...(minor?{minor:true}:{})});};
    for(const required of ['[Content_Types].xml','word/document.xml'])if(!zip.has(required))throw new Error(`DOCX gerekli ${required} dosyasını içermiyor.`);
    const [documentXml,stylesXml,numberXml,settingsXml]=await Promise.all([
      zip.text('word/document.xml'),
      zip.has('word/styles.xml')?zip.text('word/styles.xml'):Promise.resolve(null),
      zip.has('word/numbering.xml')?zip.text('word/numbering.xml'):Promise.resolve(null),
      zip.has('word/settings.xml')?zip.text('word/settings.xml'):Promise.resolve(null)
    ]);
    const themeFile=zip.names.find(n=>/^word\/theme\/theme\d+\.xml$/.test(n));
    const theme=readTheme(themeFile?await zip.text(themeFile):null,warn);
    const settings=settingsXml?parseXml(settingsXml,'word/settings.xml'):null;
    const schemeMapping=settings&&[...settings.getElementsByTagName('*')].find(x=>has(x,'clrSchemeMapping'));
    if(schemeMapping)for(const key of ['bg1','t1','bg2','t2','accent1','accent2','accent3','accent4','accent5','accent6','hyperlink','followedHyperlink']){
      const value=attr(schemeMapping,key);
      if(value)theme.mapping.set(key,value);
    }
    const doc=parseXml(documentXml,'word/document.xml');
    const body=kid(doc.documentElement,'body');
    if(!has(doc.documentElement,'document')||!body)throw new Error('Geçerli bir Word belge gövdesi bulunamadı.');
    const styleMap=new Map();let defaultsP={},defaultsR={};
    if(stylesXml){
      const styles=parseXml(stylesXml,'word/styles.xml');
      const base=kid(styles.documentElement,'docDefaults');
      defaultsP=readPPr(kid(kid(base,'pPrDefault'),'pPr'),warn);
      defaultsR=readRPr(kid(kid(base,'rPrDefault'),'rPr'),warn,theme);
      // A style's warnings are kept until a paragraph or run actually uses it:
      // Word templates define many styles (superscript footnote reference,
      // spaced titles…) that the document never shows.
      for(const style of kids(styles.documentElement,'style')){
        const id=attr(style,'styleId');if(!id)continue;
        const later=[],hold=(...a)=>later.push(a);
        styleMap.set(id,{id,name:attr(kid(style,'name'),'val')||'',type:attr(style,'type'),basedOn:attr(kid(style,'basedOn'),'val'),default:attr(style,'default'),p:readPPr(kid(style,'pPr'),hold),r:readRPr(kid(style,'rPr'),hold,theme),later});
      }
    }
    // A direct paragraph property may add/clear one Word tab stop without
    // discarding the stops inherited from its paragraph style.
    function mergePProps(base,extra){
      const combined={...base,...extra};
      if(extra.tabStops!==undefined){
        const tabs=new Map((base.tabStops||[]).map(x=>[x.pos,x]));
        for(const tab of extra.tabStops){
          if(tab.align==='clear')tabs.delete(tab.pos);
          else tabs.set(tab.pos,tab);
        }
        combined.tabStops=[...tabs.values()].sort((a,b)=>a.pos-b.pos);
      }
      return combined;
    }
    const pCache=new Map(),rCache=new Map();
    function resolveStyle(styleId,kind,seen=new Set()){
      if(!styleId)return {};
      const cache=kind==='p'?pCache:rCache;if(cache.has(styleId))return cache.get(styleId);
      const st=styleMap.get(styleId);
      if(!st)return {};
      if(st.later?.length){for(const a of st.later)warn(...a);st.later.length=0;}
      if(seen.has(styleId)){warn('styles','Word stillerinde döngü algılandı; ilgili kalıtım atlandı.');return {};}
      seen.add(styleId);
      const parent=resolveStyle(st.basedOn,kind,seen);
      const result=kind==='p'?mergePProps(parent,st.p):{...parent,...st.r};
      seen.delete(styleId);cache.set(styleId,result);return result;
    }
    const defaultPara=([...styleMap.values()].find(s=>s.type==='paragraph'&&s.default==='1')||{}).id;
    const numbers=new Map(), abstract=new Map();
    if(numberXml){
      const nd=parseXml(numberXml,'word/numbering.xml');
      for(const a of kids(nd.documentElement,'abstractNum')){
        const levels=new Map();
        for(const lev of kids(a,'lvl')){const level=num(attr(lev,'ilvl'))||0;
          levels.set(level,{format:attr(kid(lev,'numFmt'),'val')||'decimal',text:attr(kid(lev,'lvlText'),'val')||'%1.',start:num(attr(kid(lev,'start'),'val'))||1});}
        abstract.set(attr(a,'abstractNumId'),levels);
      }
      for(const n of kids(nd.documentElement,'num')){
        const overrides=new Map();
        for(const ov of kids(n,'lvlOverride')){
          const ilvl=num(attr(ov,'ilvl'))||0;const start=num(attr(kid(ov,'startOverride'),'val'));
          if(start!==undefined)overrides.set(ilvl,start);
        }
        numbers.set(attr(n,'numId'),{id:attr(kid(n,'abstractNumId'),'val'),overrides});
      }
    }
    const counters=new Map();
    function listPrefix(p){
      if(p.numId===undefined||p.numId===null||p.numId==='0')return '';
      const numbering=numbers.get(p.numId),levels=numbering&&abstract.get(numbering.id),lvl=levels&&levels.get(p.ilvl||0);
      if(!lvl){warn('lists','Liste biçimi çözümlenemedi; düz metin korunup numara eksik kalabilir.');return '' ;}
      const key=p.numId;let item=counters.get(key);if(!item){item=new Map();counters.set(key,item);}
      const level=p.ilvl||0;for(const x of [...item.keys()])if(x>level)item.delete(x);
      item.set(level,(item.get(level)??((numbering.overrides.get(level)??lvl.start)-1))+1);
      if(lvl.format==='bullet')return (lvl.text||'•').replace(/[^•·\-*▪●◦○]/g,'•')+'\t';
      const formatter=(n,format)=>{
        if(format==='decimal')return String(n);
        if(format==='decimalZero')return String(n).padStart(2,'0');
        if(format==='lowerLetter')return alpha(n).toLowerCase();
        if(format==='upperLetter')return alpha(n);
        if(format==='lowerRoman')return roman(n).toLowerCase();
        if(format==='upperRoman')return roman(n);
        warn('lists','Özel Word liste numaralandırması yalın sayıya dönüştürüldü.');return String(n);
      };
      let result=lvl.text.replace(/%([1-9])/g,(_,index)=>{
        const idx=Number(index)-1,sub=levels.get(idx);return formatter(item.get(idx)??(sub?.start||1),sub?.format||lvl.format);
      });
      if(result.includes('%'))warn('lists','Karmaşık liste yer tutucuları birebir korunamadı.');
      return result+'\t';
    }
    const blocks=[];
    let paragraphCount=0,tableCount=0;
    function getProps(el){const ppr=kid(el,'pPr'),sid=attr(kid(ppr,'pStyle'),'val')||defaultPara,style=styleMap.get(sid);
      return {p:mergePProps(mergePProps(defaultsP,resolveStyle(sid,'p')),readPPr(ppr,warn)),r:{...defaultsR,...resolveStyle(sid,'r')},styleId:sid||'',styleName:style?.name||''};
    }
    function parsePara(p,{withList=true,count=true}={}){
      const inherited=getProps(p);
      const para={kind:'paragraph',...inherited.p,sourceStyleId:inherited.styleId,sourceStyleName:inherited.styleName,runs:[]};
      const paragraphs=[];let current=para;
      const newLine=()=>{paragraphs.push(current);current={kind:'paragraph',...inherited.p,sourceStyleId:inherited.styleId,sourceStyleName:inherited.styleName,runs:[]};delete current.pageBreakBefore;};
      const append=(text,run)=>{
        if(!text)return;
        const old=current.runs.at(-1);
        if(old&&Object.keys(run).every(k=>old[k]===run[k])&&Object.keys(old).every(k=>k==='text'||run[k]===old[k]))old.text+=text;
        else current.runs.push({text,...run});
      };
      if(withList){const prefix=listPrefix(inherited.p);if(prefix)append(prefix,inherited.r);}
      function handleRun(r,overrideStyle){
        const charId=attr(kid(kid(r,'rPr'),'rStyle'),'val');
        const {caps,smallCaps,...rpr}={...inherited.r,...resolveStyle(charId,'r'),...readRPr(kid(r,'rPr'),warn,theme),...overrideStyle};
        if(rpr.hidden){warn('hidden','Gizli Word metni UDF’ye aktarılmadı.');return;}
        const shown=t=>caps||smallCaps?t.toLocaleUpperCase('tr-TR'):t;
        if(smallCaps&&!caps)warn('small-caps','Word küçük büyük harf (small caps) yazısı büyük harfe çevrildi.',true);
        for(const node of r.children){
          if(has(node,'t')||has(node,'delText')){if(has(node,'t'))append(shown(node.textContent),rpr);}
          else if(has(node,'tab')||has(node,'ptab'))append('\t',rpr);
          else if(has(node,'br')){if(attr(node,'type')==='page'){newLine();paragraphs.push({kind:'page-break'});current={kind:'paragraph',...inherited.p,sourceStyleId:inherited.styleId,sourceStyleName:inherited.styleName,runs:[]};}else newLine();}
          else if(has(node,'cr'))newLine();
          else if(has(node,'noBreakHyphen'))append('\u2011',rpr);
          else if(has(node,'softHyphen'))append('\u00ad',rpr);
          else if(has(node,'drawing')||has(node,'pict')||has(node,'object')){
            append('⟦GÖRSEL/NESNE AKTARILMADI⟧',rpr);
            warn('images','Görsel veya gömülü nesne UDF metnine taşınmadı; konumu yer tutucuyla gösterildi.');
          }
          else if(has(node,'footnoteReference')||has(node,'endnoteReference')){
            append(`⟦${has(node,'footnoteReference')?'DİPNOT':'SONNOT'} ${attr(node,'id')||''} AKTARILMADI⟧`,rpr);
            warn('footnotes','Dipnot veya sonnot metni aktarılmadı; metindeki yeri işaretlendi.');
          }else if(has(node,'instrText')||has(node,'fldChar'))warn('fields','Word alan kodları korunmadı; görünür alan sonucu varsa aktarıldı.');
          else if(has(node,'lastRenderedPageBreak')){ /* layout cache, not a hard break */ }
        }
      }
      function walk(container){
        for(const node of container.children){
          if(has(node,'r'))handleRun(node);
          else if(has(node,'hyperlink')){warn('links','Bağlantı adresleri korunmadı; görünür metin aktarıldı.');walk(node);}
          else if(has(node,'ins')||has(node,'moveTo')){warn('changes','Değişiklik izleme temizlendi; eklenen metnin görünür hâli alındı.');walk(node);}
          else if(has(node,'del')||has(node,'moveFrom')){warn('changes','Değişiklik izleme temizlendi; silinen metin alınmadı.');}
          else if(has(node,'sdt')){const content=kid(node,'sdtContent');if(content)walk(content);else warn('fields','İçerik kontrolü işlenemedi.');}
          else if(has(node,'smartTag')||has(node,'customXml')||has(node,'fldSimple')){if(has(node,'fldSimple'))warn('fields','Word alanı düz metne aktarıldı.');walk(node);}
          else if(has(node,'commentRangeStart')||has(node,'commentReference'))warn('comments','Word yorumları taşınmadı.');
          else if(has(node,'oMath')||has(node,'oMathPara')){append('⟦DENKLEM AKTARILMADI⟧',inherited.r);warn('equations','Word denklemi metne dönüştürülemedi.');}
          else if(has(node,'altChunk'))warn('altChunk','Dış içerik parçası işlenmedi.');
        }
      }
      if(inherited.p.pageBreakBefore)paragraphs.push({kind:'page-break'});
      walk(p);
      if((inherited.p.tabStops||[]).some(t=>!['left','start','center','right','end','decimal'].includes(t.align)))
        warn('tab-type','Özel Word sekme hizalaması en yakın desteklenen hizalamaya sadeleştirildi.');
      paragraphs.push(current);
      if(count){paragraphCount+=paragraphs.filter(x=>x.kind==='paragraph').length;if(paragraphCount>12000)throw new Error('DOCX 12.000 paragraf sınırını aşıyor.');}
      return paragraphs;
    }
    function parseTable(table){
      tableCount++;warn('tables','Tablo ızgarası düz metin satırlarına dönüştürüldü; sütun genişlikleri, birleştirmeler ve kenarlıklar korunmadı.');
      const results=[];
      for(const row of kids(table,'tr')){
        // Keep individual paragraphs/soft-break lines inside each cell. The
        // previous implementation joined them with " / ", destroying signatures.
        const cells=kids(row,'tc').map(cell=>{
          if(kids(cell,'tbl').length)warn('tables','İç içe tablolar desteklenmiyor.');
          const paragraphs=kids(cell,'p').flatMap(p=>parsePara(p,{withList:false,count:false}));
          if(paragraphs.some(p=>p.kind==='page-break'))warn('tables','Tablo içi sayfa sonları korunamadı.');
          return paragraphs.filter(p=>p.kind==='paragraph');
        });
        const n=Math.max(1,...cells.map(lines=>lines.length));
        for(let i=0;i<n;i++){
          const atLine=cells.map(lines=>lines[i]||null);
          const meaningful=atLine.filter(b=>b&&b.runs.some(r=>r.text.trim()));
          let runs=[],alignment='left';
          if(meaningful.length===1&&['right','center'].includes(meaningful[0].alignment)){
            // A single populated cell with right/center alignment is common
            // in signature blocks. Preserve its alignment rather than tabs.
            alignment=meaningful[0].alignment;
            runs=meaningful[0].runs.map(r=>({...r}));
          }else{
            for(let j=0;j<atLine.length;j++){
              if(j)runs.push({text:'\t'});
              if(atLine[j])runs.push(...atLine[j].runs.map(r=>({...r})));
            }
          }
          results.push({kind:'paragraph',source:'table',alignment,runs});
          paragraphCount++;if(paragraphCount>12000)throw new Error('DOCX 12.000 paragraf sınırını aşıyor.');
        }
      }
      return results;
    }
    for(const el of body.children){
      if(has(el,'p'))blocks.push(...parsePara(el));
      else if(has(el,'tbl'))blocks.push(...parseTable(el));
      else if(has(el,'sdt')){
        const content=kid(el,'sdtContent');if(!content){warn('controls','İçerik kontrolü işlenemedi.');continue;}
        for(const block of content.children){if(has(block,'p'))blocks.push(...parsePara(block));else if(has(block,'tbl'))blocks.push(...parseTable(block));}
      }
      else if(has(el,'altChunk'))warn('altChunk','Word dış içerik parçası aktarılmadı.');
    }
    if(!blocks.length||!blocks.some(b=>b.runs?.some(r=>r.text.trim())))throw new Error('DOCX içinde aktarılabilir metin bulunamadı.');
    if(blocks.length>12000)throw new Error('DOCX 12.000 paragraf sınırını aşıyor.');
    const names=zip.names;
    // Unreferenced media (for example, excluded headers) is intentionally ignored.
    // Headers and footers are intentionally excluded, as requested.
    if(names.some(n=>/^word\/(footnotes|endnotes)\.xml$/.test(n))&&!warnings.has('footnotes'))warn('footnotes','Dipnot/sonnot içerikleri aktarılmadı.');
    if(names.some(n=>/^word\/comments[^/]*\.xml$/.test(n))&&!warnings.has('comments'))warn('comments','DOCX yorumları aktarılmadı.');
    if(names.some(n=>/vbaProject\.bin$/i.test(n)))warn('macro','Makro bulundu; hiçbir makro veya gömülü dosya UDF’ye taşınmadı.');
    if(names.some(n=>/^word\/embeddings\//.test(n)))warn('embedded','DOCX gömülü nesneleri UDF’ye taşınmadı.');
    if(names.some(n=>/^_xmlsignatures\//.test(n)))warn('signatures','DOCX dijital imzası aktarılmadı; yeni UDF imzasızdır.');
    if(names.some(n=>/^word\/(charts|diagrams)\//.test(n)))warn('charts','Grafik ve çizim nesneleri aktarılmadı.');
    if(zip.has('word/_rels/document.xml.rels')){
      const rel=parseXml(await zip.text('word/_rels/document.xml.rels'), 'word/_rels/document.xml.rels');
      if([...rel.getElementsByTagName('*')].some(x=>x.localName==='Relationship'&&x.getAttribute('TargetMode')==='External'))warn('external','Belge dış bağlantılar içeriyor; hiçbir dış kaynağa erişilmedi.');
    }
    if(settings&&[...settings.getElementsByTagName('*')].some(x=>has(x,'trackRevisions')))warn('changes','Belgede değişiklik izleme ayarı mevcut; kabul/red durumu kontrol edilmelidir.');
    const section=kid(body,'sectPr');let margins={},landscape=false;
    if(section){
      const mar=kid(section,'pgMar');
      for(const [from,to] of [['left','left'],['right','right'],['top','top'],['bottom','bottom']]){
        const value=twips(attr(mar,from));if(value!==undefined)margins[to]=value;
      }
      const size=kid(section,'pgSz');landscape=attr(size,'orient')==='landscape';
      const width=num(attr(size,'w')),height=num(attr(size,'h'));
      if(width&&height&&!((Math.abs(width-11906)<130&&Math.abs(height-16838)<130)||(Math.abs(height-11906)<130&&Math.abs(width-16838)<130)))
        warn('paper','Word A4 dışında kâğıt ölçüsü kullanıyor; çıktı A4 olarak oluşturuldu.',true);
      if(kids(body,'sectPr').length>1||[...body.querySelectorAll('*')].some(x=>has(x,'sectPr')&&x!==section))warn('sections','Birden fazla bölüm düzeni tek sayfa düzenine indirgenir.');
    }
    let characters=0;for(const p of blocks)if(p.runs)for(const r of p.runs)characters+=r.text.length;
    return {blocks,warnings:[...warnings.values()],statistics:{paragraphs:blocks.filter(b=>b.kind==='paragraph').length,tables:tableCount,characters,pages:blocks.filter(b=>b.kind==='page-break').length},options:{margins,landscape,font:defaultsR.font||'Times New Roman',size:defaultsR.size||12}};
  }
  globalThis.WordToUDFDocx={readDocx};
})();
