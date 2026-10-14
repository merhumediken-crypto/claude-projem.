/* UDF 1.8 writer, independent of LexUDF. */
(() => {
  'use strict';
  const escapeAttr=s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const xmlAttrs=obj=>Object.entries(obj).filter(([,v])=>v!==null&&v!==undefined).map(([k,v])=>` ${k}="${escapeAttr(v)}"`).join('');
  const textXml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const legalXml=s=>String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g,'\ufffd').replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/gu,'\ufffd');
  const rgbInt=rgb=>(0xff000000|parseInt(rgb,16))|0;
  function styleAttrs(run) {
    const attrs={};
    if(run.font)attrs.family=run.font;
    if(Number.isFinite(run.size)&&run.size>=6&&run.size<=96)attrs.size=run.size;
    if(run.bold!==undefined)attrs.bold=!!run.bold;
    if(run.italic!==undefined)attrs.italic=!!run.italic;
    if(run.underline!==undefined)attrs.underline=!!run.underline;
    if(run.strike!==undefined)attrs.strikeThrough=!!run.strike;
    if(typeof run.color==='string'&&/^[0-9A-Fa-f]{6}$/.test(run.color))attrs.foreground=rgbInt(run.color);
    return attrs;
  }
  // Real UDF list metadata (Word→UDF). Attribute names match the ones the
  // reader (udf-reader.js) accepts: Numbered/NumberType/ListLevel/ListId and
  // Bulleted/BulletType. ListLevel is written 1-based (top level = 1); the
  // reader normalises each list to its own lowest level, so 0- and 1-based
  // UDF files both round-trip. Acceptance by the UYAP editor is NOT verified.
  const NUMBER_TYPES=new Set(['NUMBER_TYPE_NUMBER_DOT','NUMBER_TYPE_NUMBER_PARENTHESIS','NUMBER_TYPE_CHAR_SMALL_DOT','NUMBER_TYPE_CHAR_SMALL_PARENTHESIS','NUMBER_TYPE_CHAR_BIG_DOT','NUMBER_TYPE_CHAR_BIG_PARENTHESIS','NUMBER_TYPE_ROMAN_SMALL_DOT','NUMBER_TYPE_ROMAN_SMALL_PARENTHESIS','NUMBER_TYPE_ROMAN_BIG_DOT','NUMBER_TYPE_ROMAN_BIG_PARENTHESIS']);
  function listAttrs(list){
    if(!list||typeof list!=='object')return null;
    const level=String(Math.max(0,Math.min(8,Math.trunc(Number(list.level)||0)))+1);
    const id=String(list.id??'1').replace(/[^0-9A-Za-z_-]/g,'').slice(0,20)||'1';
    if(list.kind==='bullet')return {Bulleted:'true',BulletType:/^BULLET_TYPE_[A-Z_]+$/.test(list.raw||'')?list.raw:'BULLET_TYPE_ELLIPSE',ListLevel:level,ListId:id};
    if(list.kind!=='number')return null;
    return {Numbered:'true',NumberType:NUMBER_TYPES.has(list.raw)?list.raw:'NUMBER_TYPE_NUMBER_DOT',ListLevel:level,ListId:id};
  }
  function numeric(n,min=-500,max=500){return Number.isFinite(n)&&n>=min&&n<=max?String(Math.round(n*1000)/1000):undefined;}
  // The UYAP editor expects the newline that terminates a paragraph to be
  // covered by its final content span. A separate one-character content span
  // can be displayed as no paragraph separator by some UDF editor versions.
  // Normalize embedded Word manual breaks into actual UDF paragraph elements.
  function expandParagraph(block){
    if(block.kind==='page-break')return [block];
    if(!Array.isArray(block.runs))throw new Error('Geçersiz paragraf içeriği.');
    const pieces=[];
    let current={...block,runs:[]};
    // Only the first physical piece of a list item carries the list number;
    // a manual line break inside an item must not create a new item.
    const complete=()=>{pieces.push(current);current={...block,runs:[]};delete current.list;};
    for(const run of block.runs){
      if(typeof run.text!=='string')throw new Error('Geçersiz metin parçası.');
      const segments=run.text.split(/\r\n|\r|\n/u);
      for(let i=0;i<segments.length;i++){
        if(segments[i])current.runs.push({...run,text:segments[i]});
        if(i<segments.length-1)complete();
      }
    }
    complete();
    return pieces;
  }
  function write(blocks,options={}){
    if(!Array.isArray(blocks)||!blocks.length)throw new Error('Belge paragraf sayısı geçersiz.');
    if(blocks.length>12000)throw new Error(`Belge ${blocks.length} paragraf içeriyor; 12.000 paragraf sınırı aşıldı. İçerik kırpılmadı, UDF üretilmedi.`);
    const expanded=blocks.flatMap(expandParagraph);
    if(expanded.length>12000)throw new Error('Satır sonları ayrıştırıldıktan sonra 12.000 paragraf sınırı aşıldı.');
    const defaultFont=String(options.font||'Times New Roman').slice(0,80);
    const defaultSize=Math.max(6,Math.min(96,Number(options.size)||12));
    const margins=options.margins||{};
    const docProps={mediaSizeName:'1',leftMargin:numeric(margins.left,0,200)??'42.52',rightMargin:numeric(margins.right,0,200)??'42.52',topMargin:numeric(margins.top,0,200)??'42.52',bottomMargin:numeric(margins.bottom,0,200)??'42.52',paperOrientation:options.landscape?'0':'1'};
    let fullText='',index=0;
    const elements=[];
    const push=(text,runAttrs,tag='content')=>{
      const cleaned=legalXml(text);
      if(!cleaned)return '';
      const node=`<${tag}${xmlAttrs({resolver:'hvl-default',...runAttrs})} startOffset="${index}" length="${cleaned.length}" />`;
      fullText+=cleaned;index+=cleaned.length;return node;
    };
    for(const block of expanded){
      if(block.kind==='page-break'){
        elements.push('<page-break />');
        continue;
      }
      const p={resolver:'hvl-default',Alignment:{left:'0',center:'1',right:'2',justify:'3',both:'3'}[block.alignment]??'0'};
      for(const [from,to] of [['left','LeftIndent'],['right','RightIndent'],['first','FirstLineIndent'],['above','SpaceAbove'],['below','SpaceBelow']]){
        const val=numeric(block[from]);if(val!==undefined)p[to]=val;
      }
      if(Number.isFinite(block.line)&&block.line>=1&&block.line<=4) p.LineSpacing=numeric(block.line-1,0,3);
      if(Array.isArray(block.tabStops)&&block.tabStops.length){
        const aligns={left:0,start:0,center:1,right:2,end:2,decimal:3};
        const leaders={none:0,dot:1,hyphen:2};
        const stopText=block.tabStops.filter(t=>Number.isFinite(t.pos)&&t.pos>=0&&t.pos<=2000)
          .map(t=>`${numeric(t.pos,0,2000)}:${aligns[t.align]??0}:${leaders[t.leader]??0}`);
        if(stopText.length)p.TabSet=stopText.join(',');
      }
      const list=listAttrs(block.list);
      if(list)Object.assign(p,list);
      let inner='';
      const visible=block.runs.filter(run=>run.text.length>0);
      if(!visible.length){
        inner=push('\n',{});
      }else{
        visible.forEach((run,i)=>{
          // A tab is an independent UDF element. Placing it inside a text
          // <content> causes the UYAP editor to ignore Word's tab stops and
          // sometimes its underline formatting on the preceding label.
          const pieces=(run.text+(i===visible.length-1?'\n':'')).split('\t');
          for(let j=0;j<pieces.length;j++){
            if(pieces[j])inner+=push(pieces[j],styleAttrs(run));
            if(j<pieces.length-1)inner+=push('\t',styleAttrs(run),'tab');
          }
        });
      }
      elements.push(`<paragraph${xmlAttrs(p)}>${inner}</paragraph>`);
    }
    if(fullText.length>8*1024*1024)throw new Error('UDF metni 8 MB sınırını aşıyor.');
    const cdata=fullText.replace(/]]>/g,']]]]><![CDATA[>');
    const xml='<?xml version="1.0" encoding="UTF-8"?>\n' +
       `<template format_id="1.8"><content><![CDATA[${cdata}]]></content>`+
       `<properties><pageFormat${xmlAttrs(docProps)} /></properties>`+
       `<elements resolver="hvl-default">${elements.join('')}</elements>`+
       `<styles><style name="default" description="Geçerli" family="${escapeAttr(defaultFont)}" size="${defaultSize}" bold="false" italic="false" foreground="-16777216" />`+
       `<style name="hvl-default" description="Gövde" family="${escapeAttr(defaultFont)}" size="${defaultSize}" /></styles></template>`;
    return {xml,fullText,paragraphs:expanded.filter(b=>b.kind!=='page-break').length,breaks:expanded.filter(b=>b.kind==='page-break').length};
  }
  function verify(xml,expected){
    if(/<!DOCTYPE|<!ENTITY/iu.test(xml))throw new Error('UDF XML DTD içeremez.');
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror')||doc.documentElement?.localName!=='template')throw new Error('UDF XML ayrıştırılamadı.');
    let nodeCount=0,stack=[[doc.documentElement,1]];while(stack.length){const [node,depth]=stack.pop();if(++nodeCount>140000||depth>64)throw new Error('UDF XML güvenlik karmaşıklık sınırını aşıyor.');for(const child of node.children)stack.push([child,depth+1]);}
    const content=[...doc.documentElement.children].find(x=>x.localName==='content');
    const elements=[...doc.documentElement.children].find(x=>x.localName==='elements');
    if(!content||!elements)throw new Error('UDF gerekli bölümleri içermiyor.');
    const text=content.textContent;
    if(text!==expected)throw new Error('UDF yazılan metin doğrulanamadı.');
    let pos=0;
    let listParagraphs=0;
    for(const paragraph of elements.querySelectorAll('paragraph')){
      if(paragraph.getAttribute('Numbered')==='true'){
        listParagraphs++;
        if(!/^NUMBER_TYPE_[A-Z_]+$/.test(paragraph.getAttribute('NumberType')||'')||!/^[1-9]$/.test(paragraph.getAttribute('ListLevel')||'')||!paragraph.getAttribute('ListId'))throw new Error('UDF liste özellikleri eksik veya hatalı.');
      }
      const spans=[...paragraph.children].filter(el=>el.localName==='content'||el.localName==='tab');
      if(!spans.length)throw new Error('UDF paragraf içeriği boş.');
      const last=spans.at(-1);
      const end=Number(last.getAttribute('startOffset'))+Number(last.getAttribute('length'));
      if(!Number.isSafeInteger(end)||end<1||text[end-1]!=='\n')throw new Error('UDF paragraf sonu kayıp.');
      for(const span of spans){
        const start=Number(span.getAttribute('startOffset')),len=Number(span.getAttribute('length'));
        const slice=text.slice(start,start+len);
        if(span.localName==='tab'&&(len!==1||slice!=='\t'))throw new Error('UDF sekme öğesi hatalı.');
        if(slice.includes('\n')&&span!==last)throw new Error('UDF ara metin parçası beklenmedik satır sonu içeriyor.');
        if(span===last&&slice.includes('\n')&&slice.indexOf('\n')!==slice.length-1)throw new Error('UDF satır sonu paragrafın sonunda olmalıdır.');
      }
    }
    for(const el of elements.querySelectorAll('content[startOffset][length],tab[startOffset][length]')){
      const start=Number(el.getAttribute('startOffset')),len=Number(el.getAttribute('length'));
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(len)||start!==pos||len<0||start+len>text.length)throw new Error('UDF içerik ofsetleri tutarsız.');
      pos+=len;
    }
    if(pos!==text.length)throw new Error('UDF içerik ofsetleri metnin tamamını kapsamıyor.');
    return {characters:text.length,lists:listParagraphs,spans:elements.querySelectorAll('content[startOffset][length],tab[startOffset][length]').length};
  }
  globalThis.WordToUDFWriter={write,verify};
})();
