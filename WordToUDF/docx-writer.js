/* Native OOXML exporter: transfers only styles present in source UDF. */
(() => {
  'use strict';
  const w='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const r='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  const twips=(val)=>Math.round(val*20);
  const t=(name,val)=>`<w:${name} w:val="${esc(val)}"/>`;
  const color=(value)=>/^[a-fA-F0-9]{6}$/.test(value||'')?value:'000000';
  const style=run=>{
    const attrs=[];
    if(run.font)attrs.push(`<w:rFonts w:ascii="${esc(run.font)}" w:hAnsi="${esc(run.font)}" w:cs="${esc(run.font)}" w:eastAsia="${esc(run.font)}"/>`);
    if(Number.isFinite(run.size))attrs.push(t('sz',Math.round(run.size*2)),t('szCs',Math.round(run.size*2)));
    if(run.bold!==undefined)attrs.push(t('b',run.bold?1:0),t('bCs',run.bold?1:0));
    if(run.italic!==undefined)attrs.push(t('i',run.italic?1:0),t('iCs',run.italic?1:0));
    if(run.underline!==undefined)attrs.push(`<w:u w:val="${run.underline?'single':'none'}"/>`);
    if(run.strike!==undefined)attrs.push(t('strike',run.strike?1:0));
    if(run.color)attrs.push(`<w:color w:val="${color(run.color)}"/>`);
    if(run.background)attrs.push(`<w:shd w:val="clear" w:color="auto" w:fill="${color(run.background)}"/>`);
    return attrs.length?`<w:rPr>${attrs.join('')}</w:rPr>`:'';
  };
  function runs(source){
    let out='';
    for(const run of source){
      const body=String(run.text||'').split(/(\t|\r\n|\r|\n)/u);
      const rpr=style(run);
      for(const part of body){
        if(!part)continue;
        const element=part==='\t'?'<w:tab/>':(/^(?:\r\n|\r|\n)$/u.test(part)?'<w:br/>':`<w:t xml:space="preserve">${esc(part)}</w:t>`);
        out+=`<w:r>${rpr}${element}</w:r>`;
      }
    }
    return out;
  }

  const listKey=list=>list?`${list.kind}:${list.id}`:'';
  function collectLists(blocks,groups){
    for(const b of blocks||[]){
      if(b.kind==='paragraph'&&b.list){
        const key=listKey(b.list);
        let group=groups.get(key);
        if(!group){group={key,kind:b.list.kind,id:b.list.id,levels:new Map()};groups.set(key,group);}
        if(!group.levels.has(b.list.level))group.levels.set(b.list.level,b.list);
        group.min=Math.min(group.min??Infinity,b.list.level||0);
      }else if(b.kind==='table'){
        for(const row of b.rows||[])for(const cell of row.cells||[])collectLists(cell.blocks,groups);
      }
    }
  }
  function numberingModel(source){
    const groups=new Map();
    collectLists(source.blocks,groups);collectLists(source.headers,groups);collectLists(source.footers,groups);
    let n=1;for(const g of groups.values()){g.abstractId=n-1;g.numId=n++;}
    return groups;
  }
  function lvlXml(level,list){
    const ilvl=Math.max(0,Math.min(8,level));
    const left=720*(ilvl+1),hanging=360;
    if(list.kind==='bullet'){
      const symbol=list.symbol||'•';
      return `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="${esc(symbol)}"/><w:lvlJc w:val="left"/>`+
        `<w:pPr><w:tabs><w:tab w:val="num" w:pos="${left}"/></w:tabs><w:ind w:left="${left}" w:hanging="${hanging}"/></w:pPr>`+
        `<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol"/></w:rPr></w:lvl>`;
    }
    const fmt=['decimal','lowerLetter','upperLetter','lowerRoman','upperRoman'].includes(list.format)?list.format:'decimal';
    const suffix=list.suffix===')'?')':'.';
    return `<w:lvl w:ilvl="${ilvl}"><w:start w:val="1"/><w:numFmt w:val="${fmt}"/><w:lvlText w:val="%${ilvl+1}${suffix}"/><w:lvlJc w:val="left"/>`+
      `<w:pPr><w:tabs><w:tab w:val="num" w:pos="${left}"/></w:tabs><w:ind w:left="${left}" w:hanging="${hanging}"/></w:pPr></w:lvl>`;
  }
  function numberingXml(groups){
    if(!groups.size)return '';
    let body='';
    for(const g of groups.values()){
      // UDF ListLevel may be 0- or 1-based; the lowest level of each list
      // becomes Word level 0 so a top-level UDF list is a top-level Word list.
      const base=Number.isFinite(g.min)?g.min:0;
      const max=Math.max(0,...[...g.levels.keys()].map(k=>k-base));
      const fallback=g.levels.get(base)||[...g.levels.values()][0]||{kind:g.kind,format:'decimal',suffix:'.',symbol:'•'};
      let levels='';
      for(let i=0;i<=max;i++)levels+=lvlXml(i,g.levels.get(i+base)||fallback);
      body+=`<w:abstractNum w:abstractNumId="${g.abstractId}"><w:multiLevelType w:val="multilevel"/>${levels}</w:abstractNum>`+
        `<w:num w:numId="${g.numId}"><w:abstractNumId w:val="${g.abstractId}"/></w:num>`;
    }
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:numbering xmlns:w="${w}">${body}</w:numbering>`;
  }
  function para(b,hasBreak,numbering){
    const ppr=[];
    if(b.alignment)ppr.push(`<w:jc w:val="${{left:'left',right:'right',center:'center',justify:'both'}[b.alignment]||'left'}"/>`);
    if([b.left,b.right,b.first].some(Number.isFinite)){
      const parts=[];
      if(Number.isFinite(b.left))parts.push(`w:left="${twips(b.left)}"`);
      if(Number.isFinite(b.right))parts.push(`w:right="${twips(b.right)}"`);
      if(Number.isFinite(b.first))parts.push(`${b.first<0?'w:hanging':'w:firstLine'}="${Math.abs(twips(b.first))}"`);
      ppr.push(`<w:ind ${parts.join(' ')}/>`);
    }
    if([b.above,b.below,b.line].some(Number.isFinite)){
      const parts=[];
      if(Number.isFinite(b.above))parts.push(`w:before="${twips(b.above)}"`);
      if(Number.isFinite(b.below))parts.push(`w:after="${twips(b.below)}"`);
      if(Number.isFinite(b.line))parts.push(`w:line="${Math.round(b.line*240)}" w:lineRule="auto"`);
      ppr.push(`<w:spacing ${parts.join(' ')}/>`);
    }
    if(b.tabStops?.length){
      const stops=b.tabStops.map(x=>`<w:tab w:val="${esc(x.align||'left')}" w:leader="${esc(x.leader||'none')}" w:pos="${twips(x.pos)}"/>`);
      ppr.push(`<w:tabs>${stops.join('')}</w:tabs>`);
    }
    if(b.list){
      const group=numbering?.get(listKey(b.list));
      if(group)ppr.push(`<w:numPr><w:ilvl w:val="${Math.max(0,Math.min(8,(b.list.level||0)-(Number.isFinite(group.min)?group.min:0)))}"/><w:numId w:val="${group.numId}"/></w:numPr>`);
    }
    if(hasBreak)ppr.push('<w:pageBreakBefore/>');
    return `<w:p>${ppr.length?`<w:pPr>${ppr.join('')}</w:pPr>`:''}${runs(b.runs)}</w:p>`;
  }
  function table(block,numbering){
    // UDF's borderNone table has no explicit column widths; Word auto-fits
    // the grid to its content instead of inventing fixed column dimensions.
    const borders=['top','left','bottom','right','insideH','insideV']
      .map(side=>`<w:${side} w:val="nil"/>`).join('');
    const borderPr=block.border==='none'?`<w:tblBorders>${borders}</w:tblBorders>`:'';
    const rows=block.rows.map(row=>{
      const height=Number.isFinite(row.height)&&row.height>0
        ?`<w:trPr><w:trHeight w:val="${twips(row.height)}" w:hRule="atLeast"/></w:trPr>`:'';
      const cells=row.cells.map(cell=>{
        const contents=paragraphs(cell.blocks,numbering);
        return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${contents||'<w:p/>'}</w:tc>`;
      }).join('');
      return `<w:tr>${height}${cells}</w:tr>`;
    }).join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="autofit"/>${borderPr}</w:tblPr>${rows}</w:tbl>`;
  }
  function paragraphs(blocks,numbering){
    let pending=false,output='';
    for(const b of blocks){
      if(b.kind==='page-break'){if(pending)output+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';pending=true;continue;}
      if(b.kind==='table'){
        if(pending)output+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        output+=table(b,numbering);pending=false;continue;
      }
      output+=para(b,pending,numbering);pending=false;
    }
    if(pending)output+='<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    return output;
  }
  async function create(source){
    const {options,blocks,headers,footers}=source;
    const numbering=numberingModel(source), numberingPart=numberingXml(numbering);
    const page=options.landscape?{w:16838,h:11906,orientation:'landscape'}:{w:11906,h:16838,orientation:'portrait'};
    const m=options.margins;
    const sect=`<w:sectPr>${headers.length?`<w:headerReference w:type="default" r:id="rId2"/>`:''}${footers.length?`<w:footerReference w:type="default" r:id="rId3"/>`:''}`+
      `<w:pgSz w:w="${page.w}" w:h="${page.h}" w:orient="${page.orientation}"/>`+
      `<w:pgMar w:top="${twips(m.top)}" w:right="${twips(m.right)}" w:bottom="${twips(m.bottom)}" w:left="${twips(m.left)}" `+
      `w:header="${twips(options.headerOffset??20)}" w:footer="${twips(options.footerOffset??20)}" w:gutter="0"/></w:sectPr>`;
    const document=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<w:document xmlns:w="${w}" xmlns:r="${r}"><w:body>${paragraphs(blocks,numbering)}${sect}</w:body></w:document>`;
    const styleXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<w:styles xmlns:w="${w}"><w:docDefaults><w:rPrDefault><w:rPr>`+
      `<w:rFonts w:ascii="${esc(options.font)}" w:hAnsi="${esc(options.font)}" w:cs="${esc(options.font)}"/>`+
      t('sz',Math.round(options.size*2))+
      `</w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Normal" w:default="1"><w:name w:val="Normal"/></w:style></w:styles>`;
    const relationships=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
      `<Relationship Id="rId1" Type="${r}/styles" Target="styles.xml"/>`+
      `${headers.length?`<Relationship Id="rId2" Type="${r}/header" Target="header1.xml"/>`:''}`+
      `${footers.length?`<Relationship Id="rId3" Type="${r}/footer" Target="footer1.xml"/>`:''}`+
      `${numberingPart?`<Relationship Id="rId4" Type="${r}/numbering" Target="numbering.xml"/>`:''}</Relationships>`;
    const types=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`+
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`+
      `<Default Extension="xml" ContentType="application/xml"/>`+
      `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`+
      `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`+
      `${headers.length?`<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>`:''}`+
      `${footers.length?`<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>`:''}`+
      `${numberingPart?`<Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>`:''}</Types>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
      `<Relationship Id="rId1" Type="${r}/officeDocument" Target="word/document.xml"/></Relationships>`;
    const files=[
      {name:'[Content_Types].xml',content:types},{name:'_rels/.rels',content:rootRels},
      {name:'word/document.xml',content:document},{name:'word/_rels/document.xml.rels',content:relationships},
      {name:'word/styles.xml',content:styleXml}];
    if(headers.length)files.push({name:'word/header1.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="${w}">${paragraphs(headers,numbering)}</w:hdr>`});
    if(footers.length)files.push({name:'word/footer1.xml',content:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="${w}">${paragraphs(footers,numbering)}</w:ftr>`});
    if(numberingPart)files.push({name:'word/numbering.xml',content:numberingPart});
    const bytes=await WordToUDFZip.makeZipFiles(files);
    const zip=WordToUDFZip.openZip(bytes);
    if(zip.names.length!==files.length)throw new Error('DOCX oluşturma bütünlük kontrolü başarısız.');
    for(const f of files){const original=new TextEncoder().encode(f.content),extracted=await zip.read(f.name);if(original.length!==extracted.length||original.some((n,i)=>n!==extracted[i]))throw new Error(`${f.name} DOCX doğrulaması başarısız.`);}
    return bytes;
  }
  globalThis.WordToUDFDocxWriter={create};
})();
