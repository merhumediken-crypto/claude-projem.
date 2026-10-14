/* Document-wide page settings and AÇIKLAMALAR-only paragraph formatting. */
(() => {
  'use strict';
  const PT_PER_CM = 72 / 2.54;
  // Single source of truth for the petition geometry. legal-typography.js reads
  // colonTabCm and explanationLine from here. explanationLine was 1.0 up to
  // v1.3.2; the agreed petition standard is 1.5 (configurable in the UI).
  const RULES = Object.freeze({marginCm:1.5, paragraphCm:0, explanationParagraphCm:0.15, explanationFirstCm:1.25, explanationLine:1.5, colonTabCm:6.0});
  const clean = s => String(s||'').replace(/\s+/g,' ').trim().toLocaleUpperCase('tr-TR');
  const flatten = b => (b.runs||[]).map(r=>r.text).join('');
  const headingText = b => clean(flatten(b)).replace(/[:：\s]+$/gu,'').trim();
  const normalizedHeadingText = b => headingText(b).replace(/^[IVXLCDM\d]+[.\-)\s]+/iu,'').trim();
  const START_RE=/^AÇIKLAMALAR(?:IMIZ|IM)?(?:\s*(?:VE|\/|İLE)\s+\S.{0,80})?$/u;
  // "AÇIKLAMALAR : metin" (label and text on one line) also opens the section.
  const inlineLabel = b => {const m=/^([^:：]{2,60})[:：]\s*\S/u.exec(clean(flatten(b)));return m?m[1].replace(/^[IVXLCDM\d]+[.\-)\s]+/iu,'').trim():'';};
  const isStart = b => b.kind==='paragraph' && b.source!=='table' && (START_RE.test(normalizedHeadingText(b))||START_RE.test(inlineLabel(b)));
  // The first subsequent major section heading closes AÇIKLAMALAR. Avoid
  // matching ordinary prose such as "Sonuç olarak ..." or "Deliller değerlendirildi".
  const isStop = b => {
    if(b.kind!=='paragraph'||b.source==='table')return false;
    return /^(?:HUKUK[İI]\s+(?:NEDENLER|SEBEPLER|DAYANAKLAR|DEL[İI]LLER|DEĞERLEND[İI]RME)|DEL[İI]LLER(?:[İI]M[İI]Z)?|DEL[İI]L\s+L[İI]STES[İI]|YASAL\s+DAYANAKLAR|SONUÇ(?:\s+VE\s+(?:[İI]STEM|TALEP))?|NET[İI]CE(?:\s+VE\s+(?:[İI]STEM|TALEP))?|[İI]STEM|TALEP(?:LER[İI]M[İI]Z)?|EKLER|EK\s+L[İI]STES[İI]|[İI]MZA)(?:\s*[:：.]|$)/u.test(headingText(b));
  };
  // Internal legal headings belong to the AÇIKLAMALAR section but must not
  // receive body first-line indentation/justification. v1.2.x treated these as
  // body paragraphs, which produced visibly wrong petition typography.
  const isInternalHeading = b => {
    if(b.kind!=='paragraph'||b.source==='table')return false;
    const raw=String(flatten(b)||'').replace(/\s+/gu,' ').trim();
    if(!/^(?:[IVXLCDM]+|\d+)\.\s+\S/iu.test(raw)||raw.length>220)return false;
    const letters=[...raw].filter(c=>/\p{L}/u.test(c));
    if(!letters.length)return false;
    const upper=letters.filter(c=>c===c.toLocaleUpperCase('tr-TR')).length;
    return upper/letters.length>.62;
  };
  // Caption/colon lines are often aligned with Word tab stops. Without an
  // explicit stop the UDF editor uses its own defaults, giving labels different
  // value columns. Assign one shared stop only to metadata lines containing a tab.
  const isFieldLine = b => {
    if(b.kind!=='paragraph'||b.source==='table')return false;
    const t=flatten(b);
    return /^[\s\u00a0]*[\p{L}\p{N}/(). -]{2,45}\t+[ \t]*:[^\n]*/u.test(t)
      && !/^\s*(?:SONUÇ|AÇIKLAMALAR|DELİLLER|HUKUKİ NEDENLER)[\s\t]*:/iu.test(t);
  };
  function setFieldTab(b){
    if(!isFieldLine(b))return b;
    const whole=flatten(b);
    const match=/^([\s\u00a0]*[\p{L}\p{N}/(). -]{2,45}?)([ \u00a0]*\t[ \u00a0\t]*)(:)/u.exec(whole);
    let normalized=b;
    if(match){
      const start=match[1].length,stop=start+match[2].length;
      const firstTab=whole.indexOf('\t',start);let cursor=0;
      const runs=b.runs.map(r=>{
        let data='';
        for(const ch of r.text){
          const index=cursor;cursor+=ch.length;
          if(index>=start&&index<stop){if(index===firstTab)data+='\t';}
          else data+=ch;
        }
        return {...r,text:data};
      }).filter(r=>r.text);
      normalized={...b,runs};
    }
    if(normalized.tabStops?.length)return normalized;
    return {...normalized,tabStops:[{pos:Math.round(RULES.colonTabCm*PT_PER_CM*100)/100,align:'left',leader:'none'}]};
  }
  function detection(blocks){
    const start=blocks.findIndex(isStart);
    const end=start<0?-1:blocks.findIndex((b,i)=>i>start&&isStop(b));
    return {start,end};
  }
  function apply(blocks,selection={},options={}){
    if(!Array.isArray(blocks))throw new Error('Dönüştürülecek paragraf bulunamadı.');
    if(options.preserveFormatting){
      const src=options.sourceMargins||{};
      const base=RULES.marginCm*PT_PER_CM;
      const margins=Object.fromEntries(['left','right','top','bottom'].map(key=>[key,Number.isFinite(src[key])&&src[key]>=0&&src[key]<=200?src[key]:base]));
      return {blocks:blocks.map(b=>({...b,runs:b.runs?.map(r=>({...r})),tabStops:b.tabStops?.map(t=>({...t}))})),selection:{start:-1,end:-1},bodyCount:0,headingCount:0,margins};
    }
    const auto=detection(blocks);
    const resolve=(v,autoV)=>v===undefined||v===null||v==='auto'?autoV:v==='none'?-1:Number(v);
    const start=resolve(selection.start,auto.start),end=resolve(selection.end,auto.end);
    if(!Number.isSafeInteger(start)||start<-1||start>=blocks.length)throw new Error('Açıklamalar başlangıcı geçersiz.');
    if(!Number.isSafeInteger(end)||end<-1||end>=blocks.length)throw new Error('Açıklamalar bitişi geçersiz.');
    if(end>=0&&start>=0&&end<=start)throw new Error('Açıklamalar bitişi başlangıçtan sonra olmalıdır.');
    const line=Number.isFinite(options.lineSpacing)&&options.lineSpacing>=1&&options.lineSpacing<=3?options.lineSpacing:RULES.explanationLine;
    let bodyCount=0,headingCount=0;
    const formatted=blocks.map((b,i)=>{
      if(b.kind!=='paragraph')return {...b};
      const inBody=start>=0&&i>start&&(end<0||i<end);
      const internalHeading=inBody&&isInternalHeading(b);
      // The AÇIKLAMALAR heading itself and the first following major heading are
      // headings. Internal roman/numeric legal headings keep heading geometry.
      const explanationParagraph=inBody&&!isStop(b)&&!internalHeading;
      const spacing=(explanationParagraph||internalHeading)?RULES.explanationParagraphCm*PT_PER_CM:RULES.paragraphCm*PT_PER_CM;
      const p={...setFieldTab(b),above:spacing,below:spacing};
      if(explanationParagraph&&b.source!=='table'&&flatten(b).trim()){
        p.alignment='justify';p.first=RULES.explanationFirstCm*PT_PER_CM;p.line=line;
        bodyCount++;
      } else if(internalHeading){
        p.first=0;p.left=0;p.alignment='left';p.line=line;headingCount++;
      }
      return p;
    });
    return {blocks:formatted,selection:{start,end},bodyCount,headingCount,lineSpacing:line,margins:{left:RULES.marginCm*PT_PER_CM,right:RULES.marginCm*PT_PER_CM,top:RULES.marginCm*PT_PER_CM,bottom:RULES.marginCm*PT_PER_CM}};
  }
  globalThis.WordToUDFNormalize={RULES,PT_PER_CM,detection,apply,flatten,isStart,isStop,isInternalHeading};
})();
