/* Golden-file regression tests: anonymised real-world petitions.
 *
 * Each tests/fixtures/*.json holds {name, source: [paragraph text…],
 * options, expected: [{role, text}…]}. The source runs through the same
 * pipeline as the browser (normalize → legal typography) and the result must
 * match `expected` exactly. After an INTENDED rule change, review the diff and
 * refresh with: node tests/golden.test.js --update
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(__dirname,'fixtures');
const ctx=vm.createContext({Intl,Date});
for(const n of ['normalize.js','settings.js','legal-rules.js','legal-typography.js','checks.js'])vm.runInContext(fs.readFileSync(path.join(root,n),'utf8'),ctx,{filename:n});
const update=process.argv.includes('--update');
let failed=0,count=0;
for(const file of fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
  const fx=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  const blocks=fx.source.map(text=>({kind:'paragraph',runs:[{text}]}));
  const n=ctx.WordToUDFNormalize.apply(blocks);
  const opts={listMode:'text',...fx.options,now:new Date(fx.options?.now||'2026-10-14T09:00:00Z')};
  const r=ctx.WordToUDFLegalTypography.apply(n.blocks,{selection:n.selection,...opts});
  const actual=r.blocks.filter(b=>b.kind==='paragraph').map(b=>({role:b.role,text:b.runs.map(x=>x.text).join('')}));
  const findings=ctx.WordToUDFChecks.run(r.blocks,r.statistics,{now:opts.now}).filter(c=>c.level==='error').map(c=>c.code);
  count++;
  if(update){fx.expected=actual;fx.expectedErrors=findings;fs.writeFileSync(path.join(dir,file),JSON.stringify(fx,null,2)+'\n');console.log('UPDATED',file);continue;}
  const exp=fx.expected||[];
  const diffs=[];
  for(let i=0;i<Math.max(exp.length,actual.length);i++){
    const a=actual[i],e=exp[i];
    if(!a||!e||a.role!==e.role||a.text!==e.text)diffs.push(`  #${i}\n    beklenen: ${e?`[${e.role}] ${JSON.stringify(e.text)}`:'(yok)'}\n    çıkan:    ${a?`[${a.role}] ${JSON.stringify(a.text)}`:'(yok)'}`);
  }
  if(JSON.stringify(findings)!==JSON.stringify(fx.expectedErrors||[]))diffs.push(`  denetim hataları: beklenen ${JSON.stringify(fx.expectedErrors||[])}, çıkan ${JSON.stringify(findings)}`);
  if(diffs.length){failed++;console.error(`FAIL ${file} (${fx.name})\n${diffs.slice(0,8).join('\n')}`);}
  else console.log(`PASS ${file} (${fx.name}): ${actual.length} paragraf`);
}
console.log(failed?`GOLDEN ${count-failed} başarılı, ${failed} BAŞARISIZ`:`GOLDEN ${count} örnek dilekçe başarılı`);
if(failed)process.exitCode=1;
