/* Pre-submission petition checks (v1.4.2).
 *
 * Runs on the FINAL block model (after legal typography and manual
 * overrides) and returns findings; it never changes the document. Each
 * finding is {level: 'error'|'warn'|'info', code, message}. "error" means the
 * petition is very likely wrong (e.g. no case number), "warn" means look at
 * it, "info" is a hint. The checks are deliberately conservative: they report
 * what the text shows, they do not judge the legal merits.
 */
(() => {
  'use strict';
  const L = () => globalThis.WordToUDFLegalTypography;
  const flatten = b => (b?.runs || []).map(r => r.text || '').join('');
  const clean = s => String(s || '').replace(/\s+/gu, ' ').trim();
  const upper = s => clean(s).toLocaleUpperCase('tr-TR');
  const UETS_ANY_RE = /\bUETS\b\s*[:：]?\s*([\d\s-]{5,25})/giu;
  const UETS_RE = /^\d{5}-\d{5}-\d{5}$/u;
  const DATE_RE = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/gu;
  // Parties a signature line can name: "Davalı İsa Çiftçi Vekili".
  const PARTY_WORDS = ['DAVACI', 'DAVALI', 'DAVACILAR', 'DAVALILAR', 'SANIK', 'ŞÜPHELİ', 'MÜŞTEKİ', 'KATILAN', 'BORÇLU', 'ALACAKLI', 'İTİRAZ EDEN', 'TALEP EDEN', 'BAŞVURUCU', 'KARŞI DAVACI', 'KARŞI DAVALI', 'İSTİNAF EDEN', 'TEMYİZ EDEN'];

  function fieldValue(block){
    const t = flatten(block), i = t.indexOf(':');
    return i >= 0 ? clean(t.slice(i + 1)) : '';
  }
  function words(s){ return upper(s).replace(/^(?:AV\.|AVUKAT)\s*/u, '').replace(/\(.*?\)/gu, ' ').replace(/[^\p{L}\s]/gu, ' ').split(/\s+/u).filter(w => w.length > 1); }
  function sameName(a, b){
    const x = words(a), y = new Set(words(b));
    return x.length > 0 && x.every(w => y.has(w));
  }
  function parseDate(d, m, y){
    const dt = new Date(Date.UTC(+y, +m - 1, +d));
    return dt.getUTCFullYear() === +y && dt.getUTCMonth() === +m - 1 && dt.getUTCDate() === +d ? dt : null;
  }
  function todayUtc(now, timeZone){
    const s = L()?.todayTR?.(now, timeZone) || '';
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/u.exec(s);
    return m ? Date.UTC(+m[3], +m[2] - 1, +m[1]) : Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }

  function run(blocks, statistics = {}, options = {}){
    const out = [];
    const add = (level, code, message) => out.push({level, code, message});
    const paras = (blocks || []).filter(b => b.kind === 'paragraph');
    const byRole = role => paras.filter(b => b.role === role);
    const field = label => paras.find(b => b.fieldLabel === label);
    const now = options.now instanceof Date ? options.now : new Date(options.now ?? Date.now());
    const enabled = statistics?.enabled !== false;
    if(!enabled){
      add('info', 'profile', 'Word biçimini koru profili: dilekçe denetimleri yalnız hukuk dilekçesi profilinde çalışır.');
      return out;
    }

    // 1. Court / authority heading.
    const court = byRole('court-heading')[0];
    if(!court) add('error', 'court-missing', 'Mahkeme / makam başlığı bulunamadı. İlk satırların "… MAHKEMESİ\'NE" biçiminde olduğunu kontrol edin.');
    else {
      const c = upper(flatten(court));
      if(/MAHKEMESİ$/u.test(c) || /HÂKİMLİĞİ$|HAKİMLİĞİ$/u.test(c)) add('warn', 'court-suffix', `Mahkeme başlığı yönelme ekiyle bitmiyor: "${clean(flatten(court))}". Genellikle "…MAHKEMESİ'NE" yazılır.`);
    }

    // 2. Case number.
    const caseRow = field('DOSYA NO');
    if(!caseRow) add('warn', 'case-missing', 'DOSYA NO satırı yok. Yeni dava değilse esas numarasını ekleyin.');
    else if(!/\d{4}\s*\/\s*\d+/u.test(fieldValue(caseRow))) add('error', 'case-format', `DOSYA NO "yıl/sıra" biçiminde değil: "${fieldValue(caseRow)}".`);

    // 3. Attorney rows and UETS.
    const attorneys = paras.filter(b => b.fieldKind === 'attorney');
    for(const a of attorneys){
      const v = fieldValue(a);
      let m, any = false;
      UETS_ANY_RE.lastIndex = 0;
      while((m = UETS_ANY_RE.exec(v))){
        any = true;
        for(const n of m[1].split(/[,\s]+(?=\d{5}-)/u).map(x => x.replace(/\s+/gu, '')).filter(Boolean)) if(!UETS_RE.test(n)) add('error', 'uets-format', `UETS numarası hatalı biçimde: "${n}" (beklenen 12345-12345-12345).`);
      }
      if(!any) add('info', 'uets-empty', `VEKİLİ satırında UETS numarası yok: "${v}". Gerekirse ayarlardan ekleyin.`);
    }

    // 4. Signature ↔ künye consistency.
    const sigs = byRole('signature').concat(paras.filter(b => b.role === 'edit-signature'));
    const sigText = sigs.map(b => clean(flatten(b)));
    const attorneyNames = attorneys.map(a => fieldValue(a).split(/\s*,\s*(?=Av\.|Avukat)/u)).flat().map(s => s.replace(/\(.*$/u, '').trim()).filter(Boolean);
    const sigAttorney = sigText.filter(t => /^(?:Av\.|Avukat)\s/u.test(t));
    if(!sigs.length) add('warn', 'signature-missing', 'İmza bloğu algılanmadı. Gerekirse önizlemede paragrafa dokunup "İmza" olarak işaretleyin.');
    for(const s of sigAttorney){
      if(attorneyNames.length && !attorneyNames.some(n => sameName(n, s) || sameName(s, n))) add('warn', 'signature-attorney', `İmzadaki avukat (${s}) künyedeki VEKİLİ satırında yok.`);
    }
    for(const t of sigText){
      const m = /^(.+?)\s+(?:Vekili|Vekilleri|Müdafii|Müdafi)$/iu.exec(t);
      if(!m) continue;
      const u = upper(m[1]);
      const party = PARTY_WORDS.find(p => u.startsWith(p + ' ') || u === p);
      const person = party ? clean(m[1].slice(party.length)) : '';
      if(party){
        const row = paras.find(b => b.fieldLabel === party || (party === 'İTİRAZ EDEN' && b.fieldLabel === 'İTİRAZ EDEN'));
        if(!row) add('warn', 'signature-party', `İmzada "${party.toLocaleLowerCase('tr-TR')}" sıfatı var ama künyede ${party} satırı yok.`);
        else if(person && !sameName(person, fieldValue(row))) add('warn', 'signature-party-name', `İmzadaki taraf adı (${person}) künyedeki ${party} değeriyle (${fieldValue(row)}) uyuşmuyor.`);
      }
    }

    // 5. Required sections.
    if(!paras.some(b => b.fieldLabel === 'KONU')) add('warn', 'topic-missing', 'KONU satırı yok.');
    if(!byRole('result-heading').length) add('error', 'result-missing', 'SONUÇ VE İSTEM bölümü bulunamadı.');
    else if(!byRole('result-item').length) add('warn', 'result-empty', 'SONUÇ VE İSTEM altında talep maddesi yok.');
    if(statistics.splittableRequests > 1) add('info', 'request-split', `Tek maddede ${statistics.splittableRequests} ayrı talep görünüyor. "Talepleri maddelere ayır" seçeneğiyle numaralı maddelere bölebilirsiniz.`);
    if(statistics.changes?.some(c => c.type === 'closing-added')) add('info', 'closing-added', 'Kaynakta kapanış cümlesi yoktu; "Karar verilmesini vekâleten talep ederim." eklendi.');

    // 6. Dates: impossible dates and hearing dates already past.
    const today = todayUtc(now, options.timeZone);
    const seenDates = new Set();
    for(const b of paras){
      const t = flatten(b);
      let m; DATE_RE.lastIndex = 0;
      while((m = DATE_RE.exec(t))){
        const dt = parseDate(m[1], m[2], m[3]);
        if(!dt){ if(!seenDates.has(m[0])){ seenDates.add(m[0]); add('error', 'date-invalid', `Geçersiz tarih: ${m[0]}.`); } continue; }
        const after = t.slice(m.index + m[0].length, m.index + m[0].length + 40).toLocaleLowerCase('tr-TR');
        if(/^\s*tarihli\s+(?:ön\s+inceleme\s+|tahkikat\s+|sözlü\s+yargılama\s+)?duruşma/u.test(after) && dt.getTime() < today && !seenDates.has('h' + m[0])){
          seenDates.add('h' + m[0]);
          add('warn', 'hearing-past', `${m[0]} tarihli duruşma bugünden önce görünüyor; tarihi kontrol edin.`);
        }
        if(dt.getTime() > today + 2 * 365 * 864e5 && !seenDates.has('f' + m[0])){ seenDates.add('f' + m[0]); add('warn', 'date-far', `${m[0]} tarihi iki yıldan uzak bir gelecekte.`); }
      }
    }

    // 7. UYAP layout risk: a tab inside a justified paragraph is drawn as a
    // fixed gap by the UDF editor, so the text after it does not line up.
    const risky = paras.filter(b => b.alignment === 'justify' && !b.listMarker && !b.list && flatten(b).includes('\t'));
    if(risky.length) add('warn', 'uyap-tab-justify', `${risky.length} iki yana yaslı paragrafta sekme var; UYAP'ta sekmeden sonraki metin kayabilir (ör. "${clean(flatten(risky[0])).slice(0, 50)}").`);

    // 8. Text integrity: words that disappeared without a recorded reason.
    const removed = statistics.integrity?.removed || [];
    const expected = /^(?:ihtiyati|haciz|hacze|tebligat|adres|ilgili|dosyası|karar|ve|uets|yukarıda|açıklanan|nedenlerle|arz|edilen|sebeplerle|esas|no|numarası)(?: ×\d+)?$/u;
    const odd = removed.filter(w => !expected.test(w));
    if(odd.length) add('warn', 'integrity', `Çıktıda azalan sözcükler: ${odd.slice(0, 12).join(', ')}${odd.length > 12 ? '…' : ''}. Dönüşüm raporundaki değişikliklerle karşılaştırın.`);

    if(!out.some(f => f.level !== 'info')) add('info', 'ok', 'Belirgin bir tutarsızlık bulunmadı.');
    const order = {error: 0, warn: 1, info: 2};
    return out.sort((a, b) => order[a.level] - order[b.level]);
  }
  globalThis.WordToUDFChecks = {run};
})();
