/* Standalone ZIP32 reader/writer: no network, no dependencies. */
(() => {
  'use strict';
  const utf8 = new TextDecoder('utf-8', {fatal:true});
  const cp1252 = new TextDecoder('windows-1252',{fatal:false});
  const encoder = new TextEncoder();
  const MAX_ARCHIVE=24*1024*1024, MAX_ENTRIES=1500, MAX_EXPANDED_TOTAL=60*1024*1024, MAX_ENTRY=8*1024*1024, MAX_NAME_BYTES=1024;
  const table = new Uint32Array(256);
  for (let i=0;i<256;i++) { let x=i; for(let j=0;j<8;j++) x=(x>>>1)^((x&1)?0xedb88320:0); table[i]=x>>>0; }
  function crc32(bytes) { let c=0xffffffff; for(const b of bytes)c=table[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
  function check(condition,message) { if(!condition) throw new Error(message); }
  function uint16(view,offset) {check(offset>=0&&offset+2<=view.byteLength,'ZIP okunamadı (alan sınırı).'); return view.getUint16(offset,true);}
  function uint32(view,offset) {check(offset>=0&&offset+4<=view.byteLength,'ZIP okunamadı (alan sınırı).'); return view.getUint32(offset,true);}
  function decodeName(raw,flags){
    try{return (flags&0x800)?utf8.decode(raw):cp1252.decode(raw);}catch(_){throw new Error('ZIP giriş adı okunamadı.');}
  }
  function safeEntryName(name,byteLength){
    check(byteLength>0&&byteLength<=MAX_NAME_BYTES,'ZIP giriş adı uzunluğu geçersiz.');
    check(!/[\u0000-\u001f\u007f]/u.test(name),'ZIP giriş adı kontrol karakteri içeriyor.');
    check(!name.includes('\\')&&!name.startsWith('/')&&!/^[A-Za-z]:/.test(name)&&!name.split('/').includes('..'),'ZIP içinde geçersiz dosya yolu.');
    return true;
  }
  async function expand(data,limit) {
    check(typeof DecompressionStream!=='undefined','Tarayıcı ZIP sıkıştırmasını desteklemiyor. Chrome 103+ kullanın.');
    const reader=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const parts=[]; let size=0;
    try {
      while(true) {
        const {done,value}=await reader.read(); if(done)break;
        size+=value.byteLength;
        if(size>limit) { await reader.cancel().catch(()=>{}); throw new Error('ZIP açılan veri boyutu sınırı aşıyor.'); }
        parts.push(value);
      }
    } finally {reader.releaseLock();}
    const result=new Uint8Array(size); let n=0;
    for(const p of parts){result.set(p,n);n+=p.byteLength;}
    return result;
  }
  function openZip(buffer) {
    const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
    check(bytes.length>=22 && bytes.length<=MAX_ARCHIVE,'Dosya 24 MB sınırını aşıyor veya geçerli ZIP değil.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    let end=-1;
    for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--){
      if(uint32(view,p)===0x06054b50&&p+22+uint16(view,p+20)===bytes.length){end=p;break;}
    }
    check(end>=0,'Geçerli ZIP son kaydı bulunamadı.');
    check(uint16(view,end+4)===0&&uint16(view,end+6)===0,'Çok parçalı ZIP desteklenmiyor.');
    const count=uint16(view,end+10), diskCount=uint16(view,end+8);
    const size=uint32(view,end+12), start=uint32(view,end+16);
    check(count===diskCount && count<=MAX_ENTRIES && size!==0xffffffff && start!==0xffffffff && start+size<=end,'ZIP merkez dizini geçersiz veya sınır aşıldı.');
    const index=new Map(); let p=start; let declaredTotal=0;
    for(let i=0;i<count;i++){
      check(p+46<=start+size&&uint32(view,p)===0x02014b50,'ZIP merkez dizini hasarlı.');
      const flags=uint16(view,p+8), method=uint16(view,p+10), nameLen=uint16(view,p+28), extra=uint16(view,p+30), comment=uint16(view,p+32);
      const next=p+46+nameLen+extra+comment;
      check(next<=start+size,'ZIP giriş başlığı hasarlı.');
      const rawName=bytes.subarray(p+46,p+46+nameLen);
      const name=decodeName(rawName,flags);
      safeEntryName(name,nameLen);
      check(!index.has(name),'ZIP içinde yinelenen giriş bulundu.');
      check(!(flags&1)&&!(flags&0x40)&&!(flags&0x20),'Şifreli veya özel sıkıştırılmış ZIP desteklenmiyor.');
      const compressed=uint32(view,p+20),expanded=uint32(view,p+24),offset=uint32(view,p+42),crc=uint32(view,p+16);
      check(compressed!==0xffffffff&&expanded!==0xffffffff&&offset!==0xffffffff,'ZIP64 desteklenmiyor.');
      declaredTotal+=expanded;
      check(declaredTotal<=MAX_EXPANDED_TOTAL,'ZIP açılmış toplam içerik 60 MB sınırını aşıyor.');
      index.set(name,{name,flags,method,compressed,expanded,offset,crc});
      p=next;
    }
    check(p===start+size,'ZIP merkez dizini boyutu uyuşmuyor.');
    return {
      names:[...index.keys()],
      has:(name)=>index.has(name),
      async read(name,limit=MAX_ENTRY){
        const entry=index.get(name);
        if(!entry)throw new Error(`DOCX içinde ${name} bulunamadı.`);
        check(entry.expanded<=limit,`${name} izin verilen boyutu aşıyor.`);
        check(entry.method===0||entry.method===8,'Gerekli XML desteklenmeyen sıkıştırma kullanıyor.');
        const off=entry.offset;
        check(off+30<=start&&uint32(view,off)===0x04034b50,'ZIP yerel başlığı geçersiz.');
        const localFlags=uint16(view,off+6),localMethod=uint16(view,off+8);
        check((localFlags&1)===0&&localMethod===entry.method,'ZIP yerel ve merkezi başlığı uyuşmuyor.');
        check((localFlags&0x849)===(entry.flags&0x849),'ZIP yerel/merkez bayrakları uyuşmuyor.');
        const localNameLen=uint16(view,off+26),localExtra=uint16(view,off+28);
        check(localNameLen>0&&localNameLen<=MAX_NAME_BYTES,'ZIP yerel giriş adı uzunluğu geçersiz.');
        check(off+30+localNameLen+localExtra<=start,'ZIP yerel başlık aralığı geçersiz.');
        const localName=decodeName(bytes.subarray(off+30,off+30+localNameLen),localFlags);
        safeEntryName(localName,localNameLen);
        check(localName===entry.name,'ZIP yerel ve merkez giriş adları uyuşmuyor.');
        const dataStart=off+30+localNameLen+localExtra;
        check(dataStart+entry.compressed<=start,'ZIP giriş verisi aralığı geçersiz.');
        const compressedBytes=bytes.subarray(dataStart,dataStart+entry.compressed);
        const raw=entry.method===0?compressedBytes:await expand(compressedBytes,limit);
        check(raw.length===entry.expanded,'ZIP açılmış içerik boyutu uyuşmuyor.');
        check(crc32(raw)===entry.crc,'ZIP CRC32 bütünlük kontrolü başarısız.');
        return raw;
      },
      async text(name,limit){return utf8.decode(await this.read(name,limit));}
    };
  }
  async function makeZip(fileName,content){
    const data=typeof content==='string'?encoder.encode(content):content;
    check(data.length<0xffffffff,'ZIP giriş boyutu çok büyük.');
    const name=encoder.encode(fileName);
    check(name.length<=65535,'ZIP dosya adı çok uzun.');
    const compressed=await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer();
    const coded=new Uint8Array(compressed);
    const len=30+name.length+coded.length+46+name.length+22;
    const result=new Uint8Array(len),dv=new DataView(result.buffer);
    let pos=0;
    const w16=v=>{dv.setUint16(pos,v,true);pos+=2;};
    const w32=v=>{dv.setUint32(pos,v>>>0,true);pos+=4;};
    const checksum=crc32(data);
    w32(0x04034b50);w16(20);w16(0x800);w16(8);w16(0);w16(0);w32(checksum);w32(coded.length);w32(data.length);w16(name.length);w16(0);
    result.set(name,pos);pos+=name.length;result.set(coded,pos);pos+=coded.length;
    const dir=pos;
    w32(0x02014b50);w16(20);w16(20);w16(0x800);w16(8);w16(0);w16(0);w32(checksum);w32(coded.length);w32(data.length);w16(name.length);
    w16(0);w16(0);w16(0);w16(0);w32(0);w32(0);
    result.set(name,pos);pos+=name.length;
    const dirlen=pos-dir;
    w32(0x06054b50);w16(0);w16(0);w16(1);w16(1);w32(dirlen);w32(dir);w16(0);
    check(pos===len,'ZIP üretim uzunluğu uyuşmuyor.');
    return result;
  }
  // Multi-entry ZIP for OOXML DOCX; stored entries retain full CRC32 integrity.
  async function makeZipFiles(files){
    check(Array.isArray(files)&&files.length>0&&files.length<=200,'DOCX paket dosyası sayısı geçersiz.');
    const entries=[],names=new Set();let total=22;
    for(const item of files){
      const name=String(item.name||'');
      check(name&& !name.includes('\\')&&!name.startsWith('/')&&!name.split('/').includes('..')&&!names.has(name),'DOCX paket yolu geçersiz.');
      names.add(name);
      const nameBytes=encoder.encode(name);
      const bytes=typeof item.content==='string'?encoder.encode(item.content):item.content;
      check(bytes instanceof Uint8Array && bytes.length<0xffffffff && nameBytes.length<65536,'DOCX paket içeriği geçersiz.');
      entries.push({nameBytes,bytes,crc:crc32(bytes)});
      total+=30+nameBytes.length+bytes.length+46+nameBytes.length;
      check(total<=40*1024*1024,'DOCX paket boyutu sınırı aşıyor.');
    }
    const out=new Uint8Array(total),dv=new DataView(out.buffer);let pos=0;
    const w16=x=>{dv.setUint16(pos,x,true);pos+=2;},w32=x=>{dv.setUint32(pos,x>>>0,true);pos+=4;};
    for(const e of entries){
      e.offset=pos;
      w32(0x04034b50);w16(20);w16(0x800);w16(0);w16(0);w16(0);
      w32(e.crc);w32(e.bytes.length);w32(e.bytes.length);w16(e.nameBytes.length);w16(0);
      out.set(e.nameBytes,pos);pos+=e.nameBytes.length;out.set(e.bytes,pos);pos+=e.bytes.length;
    }
    const start=pos;
    for(const e of entries){
      w32(0x02014b50);w16(20);w16(20);w16(0x800);w16(0);w16(0);w16(0);
      w32(e.crc);w32(e.bytes.length);w32(e.bytes.length);w16(e.nameBytes.length);
      w16(0);w16(0);w16(0);w16(0);w32(0);w32(e.offset);
      out.set(e.nameBytes,pos);pos+=e.nameBytes.length;
    }
    const len=pos-start;
    w32(0x06054b50);w16(0);w16(0);w16(entries.length);w16(entries.length);w32(len);w32(start);w16(0);
    check(pos===total,'DOCX paket uzunluğu uyuşmuyor.');
    return out;
  }
  globalThis.WordToUDFZip={openZip,makeZip,makeZipFiles,crc32};
})();
