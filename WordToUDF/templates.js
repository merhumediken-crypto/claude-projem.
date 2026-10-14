/* Petition templates (v1.5.0).
 *
 * A template turns a few form fields into SOURCE paragraphs (plain text, as a
 * lawyer would type them in Word). Those paragraphs then go through exactly
 * the same pipeline as an uploaded DOCX, so a template petition gets the same
 * künye, list, closing, date and signature rules. Template wording is only a
 * starting draft: every generated paragraph and request is editable on the
 * page before anything is downloaded.
 */
(() => {
  'use strict';
  const clean = s => String(s ?? '').replace(/\s+/gu, ' ').trim();
  const upper = s => clean(s).toLocaleUpperCase('tr-TR');
  const cap = s => { const t = clean(s); return t ? t.charAt(0).toLocaleUpperCase('tr-TR') + t.slice(1) : ''; };
  const lowerFirst = s => { const t = clean(s); return t ? t.charAt(0).toLocaleLowerCase('tr-TR') + t.slice(1) : ''; };
  const or = (v, fallback) => clean(v) || fallback;

  // "Şanlıurfa 8. Asliye Hukuk Mahkemesi" → "ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE"
  function courtHeading(name){
    const u = upper(name).replace(/[’']\s*(?:NE|NA|NDE|NDA)$/u, '');
    if(!u) return '';
    if(/(?:MAHKEMESİ|HÂKİMLİĞİ|HAKİMLİĞİ|DAİRESİ|MÜDÜRLÜĞÜ)$/u.test(u)) return `${u}'NE`;
    if(/(?:BAŞSAVCILIĞI|BAŞKANLIĞI|SAVCILIĞI)$/u.test(u)) return `${u}'NA`;
    return u;
  }
  // "2026/1929" → "2026/1929 Esas"; anything else is kept as typed.
  function caseNumber(v){
    const t = clean(v);
    return /^\d{4}\s*\/\s*\d+$/u.test(t) ? `${t.replace(/\s+/gu, '')} Esas` : t;
  }
  // Opposite party for the usual pairs.
  const OPPOSITE = {DAVALI: 'DAVACI', DAVACI: 'DAVALI', BORÇLU: 'ALACAKLI', ALACAKLI: 'BORÇLU', 'İTİRAZ EDEN': 'KARŞI TARAF', 'TALEP EDEN': 'KARŞI TARAF', BAŞVURUCU: 'KARŞI TARAF'};
  const ROLES = ['DAVALI', 'DAVACI', 'BORÇLU', 'ALACAKLI', 'İTİRAZ EDEN', 'TALEP EDEN', 'BAŞVURUCU'];
  const roleWord = r => cap(String(r).toLocaleLowerCase('tr-TR')); // "DAVALI" → "Davalı"

  const D = '…'; // placeholder shown when a field is still empty

  /* Each template: id, title, fields (extra inputs), topic(f), body(f) → paragraphs,
   * requests(f) → lines, closing, attachments(f) → lines. */
  const TEMPLATES = [
    {
      id: 'mazeret', title: 'Duruşma mazeret dilekçesi',
      fields: [
        {id: 'hearingDate', label: 'Duruşma tarihi', type: 'date'},
        {id: 'reason', label: 'Mazeret nedeni', type: 'select', options: [
          ['sehir', 'şehir dışında bulunmamız ve önceden planlanmış diğer mesleki iş ve işlemlerimiz'],
          ['durusma', 'aynı gün ve saatte başka bir mahkemede görülecek duruşmamızın bulunması'],
          ['saglik', 'sağlık sorunumuz'],
          ['diger', '(serbest metin)']]},
        {id: 'reasonText', label: 'Serbest mazeret metni', type: 'text', showIf: f => f.reason === 'diger', placeholder: 'ör. ailevi bir mazeretimizin bulunması'},
        {id: 'otherCourt', label: 'Diğer duruşmanın mahkemesi ve esas no', type: 'text', showIf: f => f.reason === 'durusma', placeholder: 'ör. Şanlıurfa 2. Asliye Hukuk Mahkemesi 2026/100 E.'}
      ],
      topic: f => `${or(f.hearingDate, D)} tarihli duruşmaya ilişkin mesleki mazeretimizin sunulması ve kabulü talebidir.`,
      body: f => {
        const reason = f.reason === 'diger' ? or(f.reasonText, D) : f.reason === 'durusma'
          ? `aynı gün ve saatte ${or(f.otherCourt, D)} dosyasında görülecek duruşmamızın bulunması`
          : (TEMPLATES[0].fields[1].options.find(o => o[0] === f.reason) || TEMPLATES[0].fields[1].options[0])[1];
        const out = [`Mahkemenizin yukarıda esas numarası belirtilen dosyasının ${or(f.hearingDate, D)} tarihli duruşmasına, ${reason} nedeniyle katılım sağlayamayacağımızdan mesleki mazeretimizin kabulünü talep etmekteyiz.`];
        if(f.reason === 'durusma' || f.reason === 'saglik') out.push('Mazeretimizi gösterir belge dilekçemiz ekinde sunulmuştur.');
        return out;
      },
      requests: f => [`${or(f.hearingDate, D)} tarihli duruşmaya ilişkin mesleki mazeretimizin kabulüne,`, 'Duruşmanın ileri bir tarihe bırakılmasına,', 'Yeni duruşma gününün UYAP üzerinden tarafımıza bildirilmesine,'],
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: f => f.reason === 'durusma' ? ['Diğer dosyanın duruşma tutanağı / UYAP duruşma listesi'] : f.reason === 'saglik' ? ['Sağlık raporu'] : []
    },
    {
      id: 'eksure', title: 'Cevap süresi için ek süre talebi (HMK m. 127)',
      fields: [
        {id: 'serviceDate', label: 'Dava dilekçesinin tebliğ tarihi', type: 'date'},
        {id: 'why', label: 'Ek süre gerekçesi', type: 'textarea', placeholder: 'ör. uyuşmazlığa ilişkin belgelerin müvekkilden temin edilmesi ve incelenmesi zaman alacaktır.'}
      ],
      topic: () => 'HMK m. 127 uyarınca cevap dilekçesi sunulması için ek süre verilmesi talebidir.',
      body: f => [
        `Mahkemenizin yukarıda esas numarası belirtilen dosyasında dava dilekçesi müvekkile ${or(f.serviceDate, D)} tarihinde tebliğ edilmiş olup iki haftalık yasal cevap süresi henüz dolmamıştır.`,
        `${clean(f.why) ? cap(f.why).replace(/([^.!?])$/u, '$1.') : 'Uyuşmazlığa ilişkin bilgi ve belgelerin müvekkilden temin edilip incelenmesi zaman alacağından yasal süre içinde cevap dilekçesi hazırlanması mümkün değildir.'} Bu nedenle HMK m. 127 uyarınca cevap süresinin bitiminden itibaren bir aylık ek süre verilmesini talep etmekteyiz.`
      ],
      requests: () => ['HMK m. 127 uyarınca müvekkil yönünden cevap süresinin bitiminden itibaren bir aylık ek süre verilmesine,', 'Ek süre kararının UYAP üzerinden tarafımıza bildirilmesine,'],
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: () => []
    },
    {
      id: 'tedbir', title: 'İhtiyati tedbir kararına itiraz (HMK m. 394)',
      fields: [
        {id: 'orderDate', label: 'Tedbir kararının tarihi', type: 'date'},
        {id: 'learnDate', label: 'Kararın öğrenildiği / tebliğ tarihi', type: 'date'},
        {id: 'grounds', label: 'İtiraz gerekçeleri (her paragraf ayrı satırda)', type: 'textarea', placeholder: 'ör. Tedbir şartları oluşmamıştır; yaklaşık ispat koşulu sağlanmamıştır.'},
        {id: 'security', label: 'Teminat yönünden de itiraz edilsin', type: 'checkbox', value: true}
      ],
      topic: f => `Mahkemenizin ${or(f.orderDate, D)} tarihli ihtiyati tedbir kararına itirazlarımızın sunulmasıdır.`,
      body: f => {
        const out = [`Mahkemenizin ${or(f.orderDate, D)} tarihli ara kararıyla müvekkil aleyhine ihtiyati tedbir kararı verilmiş olup karar tarafımızca ${or(f.learnDate, D)} tarihinde öğrenilmiştir. HMK m. 394 uyarınca bir haftalık yasal süre içinde itirazlarımızı sunmaktayız.`];
        for(const g of String(f.grounds || '').split(/\r?\n/u).map(clean).filter(Boolean)) out.push(g);
        if(out.length === 1) out.push(`${D} (itiraz gerekçelerinizi yazın)`);
        if(f.security) out.push('Ayrıca tedbir kararı verilirken davacı tarafından yatırılması gereken teminat, müvekkilin uğrayabileceği zararı karşılamaktan uzaktır.');
        return out;
      },
      requests: f => ['İhtiyati tedbire yönelik itirazlarımızın kabulüne,', `Mahkemenizin ${or(f.orderDate, D)} tarihli ihtiyati tedbir kararının kaldırılmasına,`,
        ...(f.security ? ['Aksi hâlde tedbirin kapsamının daraltılmasına ve teminat miktarının artırılmasına,'] : []), 'Yargılama giderleri ile vekâlet ücretinin karşı tarafa yükletilmesine,'],
      closing: 'Karar verilmesini vekâleten saygıyla talep ederiz.',
      attachments: () => []
    },
    {
      id: 'bilirkisi', title: 'Bilirkişi raporuna itiraz (HMK m. 281)',
      fields: [
        {id: 'reportDate', label: 'Raporun tebliğ tarihi', type: 'date'},
        {id: 'objections', label: 'İtirazlar (her paragraf ayrı satırda)', type: 'textarea', placeholder: 'ör. Bilirkişi, müvekkilin ödeme belgelerini hesaba katmamıştır.'},
        {id: 'supplement', label: 'Aynı bilirkişiden ek rapor istensin', type: 'checkbox', value: true},
        {id: 'newExpert', label: 'Aksi hâlde yeni bilirkişi (heyeti) istensin', type: 'checkbox', value: true}
      ],
      topic: () => 'Bilirkişi raporuna karşı itirazlarımızın sunulmasıdır.',
      body: f => {
        const out = [`Mahkemenizin yukarıda esas numarası belirtilen dosyasına sunulan bilirkişi raporu tarafımıza ${or(f.reportDate, D)} tarihinde tebliğ edilmiş olup HMK m. 281 uyarınca iki haftalık süre içinde itirazlarımızı sunmaktayız.`];
        const lines = String(f.objections || '').split(/\r?\n/u).map(clean).filter(Boolean);
        out.push(...(lines.length ? lines : [`${D} (itirazlarınızı yazın)`]));
        return out;
      },
      requests: f => ['Bilirkişi raporuna yönelik itirazlarımızın kabulüne,',
        ...(f.supplement ? ['Raporda belirtilen eksikliklerin giderilmesi için aynı bilirkişiden ek rapor alınmasına,'] : []),
        ...(f.newExpert ? [f.supplement ? 'Aksi hâlde yeni bir bilirkişi (heyeti) atanarak yeniden inceleme yapılmasına,' : 'Yeni bir bilirkişi (heyeti) atanarak yeniden inceleme yapılmasına,'] : [])],
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: () => []
    },
    {
      id: 'segbis', title: 'e-Duruşma / SEGBİS ile katılım talebi (HMK m. 149)',
      fields: [
        {id: 'hearingDate', label: 'Duruşma tarihi', type: 'date'},
        {id: 'method', label: 'Katılım yolu', type: 'select', options: [['edurusma', 'UYAP Avukat Portal üzerinden e-Duruşma'], ['segbis', 'Başka bir adliyedeki SEGBİS']]},
        {id: 'place', label: 'SEGBİS bulunan adliye', type: 'text', showIf: f => f.method === 'segbis', placeholder: 'ör. Gaziantep Adliyesi'}
      ],
      topic: f => `${or(f.hearingDate, D)} tarihli duruşmaya ses ve görüntü nakli yoluyla (HMK m. 149) katılım talebimizdir.`,
      body: f => {
        const how = f.method === 'segbis' ? `${or(f.place, D)} SEGBİS sistemi üzerinden` : 'UYAP Avukat Portal üzerinden e-Duruşma yoluyla';
        return [`Mahkemenizin yukarıda esas numarası belirtilen dosyasının ${or(f.hearingDate, D)} tarihli duruşmasına, büromuzun mahkemenizden farklı bir yerde bulunması nedeniyle fiziken katılım sağlanması güçtür. HMK m. 149 uyarınca duruşmaya ${how} katılmamıza izin verilmesini talep etmekteyiz.`];
      },
      requests: f => {
        const how = f.method === 'segbis' ? `${or(f.place, D)} SEGBİS sistemi üzerinden` : 'e-Duruşma yoluyla';
        return [`${or(f.hearingDate, D)} tarihli duruşmaya ${how} katılmamıza izin verilmesine,`, 'Bağlantı / randevu bilgisinin UYAP üzerinden tarafımıza bildirilmesine,'];
      },
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: () => []
    },
    {
      id: 'tanik', title: 'Tanık listesinin sunulması (HMK m. 240)',
      fields: [
        {id: 'orderDate', label: 'Ara kararın tarihi', type: 'date'},
        {id: 'witnesses', label: 'Tanıklar (her satıra: Ad SOYAD – adres – dinletileceği husus)', type: 'textarea', placeholder: 'Ali VELİ – Atatürk Mah. 1. Sok. No:1 Şahinbey/Gaziantep – ödemenin yapıldığı hususu'},
        {id: 'advancePaid', label: 'Tanık gider avansı yatırıldı', type: 'checkbox', value: false}
      ],
      topic: () => 'Tanık listemizin sunulmasıdır.',
      body: f => {
        const out = [`Mahkemenizin ${or(f.orderDate, D)} tarihli ara kararı uyarınca HMK m. 240 gereğince tanık listemizi sunmaktayız. Tanıkların dinlenmesi için gerekli gider avansı ${f.advancePaid ? 'dosyaya yatırılmıştır' : 'süresi içinde dosyaya yatırılacaktır'}.`];
        const w = String(f.witnesses || '').split(/\r?\n/u).map(clean).filter(Boolean);
        (w.length ? w : [`${D} (tanık adı, adresi ve dinletileceği husus)`]).forEach((x, i) => out.push(`Tanık ${i + 1}: ${x}`));
        return out;
      },
      requests: () => ['Bildirilen tanıklarımızın davetiye ile çağrılarak gösterilen hususlarda dinlenmesine,'],
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: f => f.advancePaid ? ['Gider avansı makbuzu'] : []
    },
    {
      id: 'vekalet', title: 'Vekaletname sunulması ve dosyaya erişim talebi',
      fields: [
        {id: 'access', label: 'UYAP üzerinden dosyaya erişim yetkisi istensin', type: 'checkbox', value: true}
      ],
      topic: () => 'Vekaletnamemizin sunulması ve tebligatların tarafımıza yapılması talebimizdir.',
      body: f => [`Müvekkil ${or(f.client, D)} tarafından adımıza düzenlenen vekaletname dilekçemiz ekinde sunulmuştur. Bundan sonra yapılacak tebligatların vekil sıfatıyla tarafımıza yapılmasını${f.access ? ' ve UYAP üzerinden dosyaya erişim yetkisi tanınmasını' : ''} talep etmekteyiz.`],
      requests: f => ['Vekaletnamemizin dosyaya kabulüne,', 'Tebligatların vekil sıfatıyla tarafımıza yapılmasına,', ...(f.access ? ['UYAP üzerinden dosyaya erişim yetkisi tanınmasına,'] : [])],
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: () => ['Vekaletname örneği']
    },
    {
      id: 'beyan', title: 'Genel beyan / talep dilekçesi',
      fields: [
        {id: 'subject', label: 'Konu', type: 'text', placeholder: 'ör. bilirkişi raporuna karşı beyanlarımızın sunulmasıdır.'}
      ],
      topic: f => or(f.subject, `${D} hakkında beyanlarımızın sunulmasıdır.`),
      body: () => ['Mahkemenizin yukarıda esas numarası belirtilen dosyasında beyanlarımızı sunmaktayız.'],
      requests: () => ['Beyanlarımızın dikkate alınmasına,'],
      closing: 'Karar verilmesini saygıyla talep ederiz.',
      attachments: () => []
    }
  ];
  const byId = id => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];

  // Build the source paragraphs (plain strings) for the pipeline.
  // common: {court, caseNo, role, client, otherRole, other, otherAttorney}
  // text: {body: [..], requests: [..], attachments: [..], closing}
  function sourceLines(common, text, {attorneyName, signatureLines} = {}){
    const role = ROLES.includes(common.role) ? common.role : 'DAVALI';
    const otherRole = upper(common.otherRole) || OPPOSITE[role] || 'KARŞI TARAF';
    const lines = [];
    lines.push(courtHeading(common.court) || `${D} MAHKEMESİ'NE`);
    if(clean(common.caseNo)) lines.push(`DOSYA NO: ${caseNumber(common.caseNo)}`);
    lines.push(`${role}: ${or(common.client, D)}`);
    if(clean(attorneyName)) lines.push(`VEKİLİ: ${clean(attorneyName)}`);
    if(clean(common.other)) lines.push(`${otherRole}: ${clean(common.other)}`);
    if(clean(common.other) && clean(common.otherAttorney)) lines.push(`VEKİLİ: ${clean(common.otherAttorney)}`);
    lines.push(`KONU: ${clean(text.topic) || D}`);
    lines.push('AÇIKLAMALAR');
    const body = (text.body || []).map(clean).filter(Boolean);
    lines.push(...(body.length ? body : [D]));
    lines.push('SONUÇ VE İSTEM');
    lines.push('Yukarıda arz edilen sebeplerle;');
    (text.requests || []).map(clean).filter(Boolean).forEach((r, i) => lines.push(`${i + 1}. ${r}`));
    lines.push(clean(text.closing) || 'Karar verilmesini vekâleten talep ederim.');
    const sig = signatureLines || [`${roleWord(role)} ${clean(common.client)} Vekili`, clean(attorneyName)];
    lines.push(...sig.map(clean).filter(Boolean));
    const ekler = (text.attachments || []).map(clean).filter(Boolean);
    if(ekler.length){ lines.push('EKLER'); ekler.forEach((e, i) => lines.push(`${i + 1}- ${e}`)); }
    return lines;
  }
  const toBlocks = lines => lines.map(text => ({kind: 'paragraph', runs: [{text, font: 'Times New Roman', size: 12}]}));
  // "2026-10-14" (input type=date) → "14.10.2026"
  const trDate = v => { const m = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(String(v || '')); return m ? `${m[3]}.${m[2]}.${m[1]}` : clean(v); };

  globalThis.WordToUDFTemplates = {TEMPLATES, ROLES, OPPOSITE, byId, courtHeading, caseNumber, sourceLines, toBlocks, trDate, roleWord};
})();
