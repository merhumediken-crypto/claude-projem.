/* Release packager: node tools/build.js [outDir]
 * Writes dist/WordToUDF-<version>.zip (folder WordToUDF-<version>/ inside, the
 * layout Chrome's "Load unpacked" expects) and a .sha256 file. No
 * dependencies: ZIP entries are deflated with node:zlib. Only allowlisted
 * files are shipped (see ALLOW); tests and tools are not. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const {version}=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const outDir=path.resolve(process.argv[2]||path.join(root,'dist'));
// Allowlist, never "everything in the folder": a client's DOCX or a stray
// note left next to the sources must not end up in a release. Shipped =
// the offline app (sw.js FILES), the extension popup and manifest, the docs.
const swFiles=JSON.parse(/const FILES = (\[[^\]]*\])/u.exec(fs.readFileSync(path.join(root,'sw.js'),'utf8'))[1].replace(/'/gu,'"'));
const ALLOW=new Set([...swFiles.filter(f=>f!=='./'),'sw.js','manifest.json','popup.html','popup.js','popup.css','README.md','ARCHITECTURE.md','SECURITY.md','CHANGELOG.md','KABUL_TESTLERI.md']);
const present=fs.readdirSync(root).filter(f=>!f.startsWith('.')&&fs.statSync(path.join(root,f)).isFile());
const files=[...ALLOW].sort();
for(const f of files)if(!present.includes(f))throw new Error(`eksik dosya: ${f}`);
const NOT_SHIPPED=new Set(['package.json']);
const left=present.filter(f=>!ALLOW.has(f)&&!NOT_SHIPPED.has(f));
if(left.length)console.warn(`Pakete alınmadı (izin listesinde yok): ${left.join(', ')}`);
const table=new Uint32Array(256);for(let i=0;i<256;i++){let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[i]=c>>>0;}
const crc32=b=>{let c=0xffffffff;for(const x of b)c=table[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const prefix=`WordToUDF-${version}/`,locals=[],central=[];let offset=0;
// Fixed timestamp → byte-identical archives for identical sources.
const DOS_TIME=0,DOS_DATE=((2026-1980)<<9)|(1<<5)|1;
for(const f of files){
  const data=fs.readFileSync(path.join(root,f)),name=Buffer.from(prefix+f,'utf8'),comp=zlib.deflateRawSync(data,{level:9}),crc=crc32(data);
  const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(DOS_TIME,10);h.writeUInt16LE(DOS_DATE,12);
  h.writeUInt32LE(crc,14);h.writeUInt32LE(comp.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(name.length,26);h.writeUInt16LE(0,28);
  locals.push(h,name,comp);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(DOS_TIME,12);c.writeUInt16LE(DOS_DATE,14);
  c.writeUInt32LE(crc,16);c.writeUInt32LE(comp.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);
  central.push(c,name);offset+=30+name.length+comp.length;
}
const cd=Buffer.concat(central),end=Buffer.alloc(22);
end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...locals,cd,end]);
fs.mkdirSync(outDir,{recursive:true});
const out=path.join(outDir,`WordToUDF-${version}.zip`);fs.writeFileSync(out,zip);
const sha=crypto.createHash('sha256').update(zip).digest('hex');fs.writeFileSync(out+'.sha256',`${sha}  WordToUDF-${version}.zip\n`);
console.log(`${out} · ${files.length} dosya · ${(zip.length/1024).toFixed(1)} KB · sha256 ${sha}`);
