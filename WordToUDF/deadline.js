/* Deadline calculator (v1.10) — "Süre hesapla" page.
 *
 * HMK m. 92: a period in days starts the day after notification; a period in
 * weeks / months / years ends on the corresponding day of the last week /
 * month / year (the last day of that month if it has no such day).
 * HMK m. 93: official holidays count; if the last day is a holiday the period
 * ends on the next working day. Saturday is treated as a holiday by default
 * (courthouses are closed; the user can switch it off).
 * HMK m. 102–104: judicial recess 20 July – 31 August; a period that ends in
 * the recess is extended by one week from its end (7 September).
 * Half-day holidays (eves) do NOT move the deadline; they are reported.
 *
 * Religious holidays are taken from the Diyanet calendar for 2025–2027; for
 * other years the result says so. The result is a helper, not legal advice.
 */
(() => {
  'use strict';
  const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
  const key = d => d.toISOString().slice(0, 10);
  const addDays = (d, n) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
  function addMonths(d, n){
    const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return new Date(Date.UTC(y, m, Math.min(day, last)));
  }
  const FIXED = {'01-01': 'Yılbaşı', '04-23': 'Ulusal Egemenlik ve Çocuk Bayramı', '05-01': 'Emek ve Dayanışma Günü', '05-19': "Atatürk'ü Anma, Gençlik ve Spor Bayramı",
    '07-15': 'Demokrasi ve Millî Birlik Günü', '08-30': 'Zafer Bayramı', '10-29': 'Cumhuriyet Bayramı'};
  const FIXED_HALF = {'10-28': 'Cumhuriyet Bayramı arifesi (yarım gün)'};
  // Diyanet: [eve, first day, number of days]
  const RELIGIOUS = {
    2025: [['Ramazan Bayramı', '2025-03-29', '2025-03-30', 3], ['Kurban Bayramı', '2025-06-05', '2025-06-06', 4]],
    2026: [['Ramazan Bayramı', '2026-03-19', '2026-03-20', 3], ['Kurban Bayramı', '2026-05-26', '2026-05-27', 4]],
    2027: [['Ramazan Bayramı', '2027-03-08', '2027-03-09', 3], ['Kurban Bayramı', '2027-05-15', '2027-05-16', 4]]
  };
  const KNOWN_YEARS = Object.keys(RELIGIOUS).map(Number);
  function holidays(year){
    const full = new Map(), half = new Map();
    for(const [md, name] of Object.entries(FIXED)) full.set(`${year}-${md}`, name);
    for(const [md, name] of Object.entries(FIXED_HALF)) half.set(`${year}-${md}`, name);
    for(const [name, eve, first, days] of RELIGIOUS[year] || []){
      half.set(eve, `${name} arifesi (yarım gün)`);
      const f = new Date(`${first}T00:00:00Z`);
      for(let i = 0; i < days; i++) full.set(key(addDays(f, i)), `${name} ${i + 1}. gün`);
    }
    return {full, half};
  }
  const cache = new Map();
  const yearInfo = y => { if(!cache.has(y)) cache.set(y, holidays(y)); return cache.get(y); };
  const DAY_NAMES = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const longDate = d => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${DAY_NAMES[d.getUTCDay()]}`;
  const trDate = d => `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

  // Why a day is not a working day ('' if it is one).
  function offReason(d, {saturday = true} = {}){
    const w = d.getUTCDay();
    const h = yearInfo(d.getUTCFullYear()).full.get(key(d));
    if(h) return h;
    if(w === 0) return 'Pazar';
    if(w === 6 && saturday) return 'Cumartesi';
    return '';
  }
  const inRecess = d => { const y = d.getUTCFullYear(); return d >= D(y, 7, 20) && d <= D(y, 8, 31); };

  const UNITS = {gun: 'gün', hafta: 'hafta', ay: 'ay', yil: 'yıl'};
  // Common periods. recess: is the judicial-recess extension applied by default.
  const PRESETS = [
    {group: 'Hukuk yargılaması (HMK)', items: [
      {id: 'cevap', label: 'Cevap dilekçesi', amount: 2, unit: 'hafta', law: 'HMK m. 127', recess: true},
      {id: 'replik', label: 'Cevaba cevap / ikinci cevap', amount: 2, unit: 'hafta', law: 'HMK m. 136', recess: true},
      {id: 'eksure', label: 'Cevap için ek süre (en çok bir ay)', amount: 1, unit: 'ay', law: 'HMK m. 127', recess: true, note: 'Ek süre, cevap süresinin bitiminden itibaren işler: başlangıç olarak cevap süresinin son gününü girin.'},
      {id: 'bilirkisi', label: 'Bilirkişi raporuna itiraz', amount: 2, unit: 'hafta', law: 'HMK m. 281', recess: true},
      {id: 'istinaf', label: 'İstinaf başvurusu', amount: 2, unit: 'hafta', law: 'HMK m. 345', recess: true},
      {id: 'temyiz', label: 'Temyiz başvurusu', amount: 2, unit: 'hafta', law: 'HMK m. 361', recess: true},
      {id: 'tedbir', label: 'İhtiyati tedbire itiraz', amount: 1, unit: 'hafta', law: 'HMK m. 394', recess: false, note: 'İhtiyati tedbir işleri adli tatilde de görülür (HMK m. 103); bu nedenle adli tatil uzatması varsayılan olarak uygulanmaz.'}
    ]},
    {group: 'İcra ve iflas (İİK)', items: [
      {id: 'odeme', label: 'Ödeme emrine itiraz (genel haciz)', amount: 7, unit: 'gun', law: 'İİK m. 62', recess: false},
      {id: 'kambiyo', label: 'Kambiyo senedine dayalı takipte itiraz', amount: 5, unit: 'gun', law: 'İİK m. 168', recess: false},
      {id: 'sikayet', label: 'İcra memuru işlemine şikâyet', amount: 7, unit: 'gun', law: 'İİK m. 16', recess: false},
      {id: 'ihtiyatihaciz', label: 'İhtiyati haciz kararına itiraz', amount: 7, unit: 'gun', law: 'İİK m. 265', recess: false}
    ]},
    {group: 'İdari yargı (İYUK)', items: [
      {id: 'iptal', label: 'İdari dava açma (idare mahkemesi)', amount: 60, unit: 'gun', law: 'İYUK m. 7', recess: true},
      {id: 'vergi', label: 'Vergi mahkemesinde dava açma', amount: 30, unit: 'gun', law: 'İYUK m. 7', recess: true},
      {id: 'idariIstinaf', label: 'İdari yargıda istinaf', amount: 30, unit: 'gun', law: 'İYUK m. 45', recess: true}
    ]},
    {group: 'Diğer', items: [{id: 'custom', label: 'Süreyi kendim gireceğim', amount: 7, unit: 'gun', law: '', recess: true}]}
  ];
  // Ten years in every unit: longer is never a procedural deadline and only invites typos.
  const MAX = {gun: 3650, hafta: 520, ay: 120, yil: 10};
  const preset = id => PRESETS.flatMap(g => g.items).find(p => p.id === id) || null;
  const ICRA_NOTE = 'İcra ve iflas işlerinde adli tatilin bu süreye etkisini kontrol edin; hesapta adli tatil uzatması varsayılan olarak uygulanmadı.';

  // start: Date (UTC midnight), amount: integer, unit: gun|hafta|ay|yil.
  // recessBasis names the rule in the steps (İYUK m. 8/3 for administrative courts).
  function compute(start, amount, unit, {recess = true, saturday = true, today, recessBasis = 'HMK m. 104'} = {}){
    if(!(start instanceof Date) || Number.isNaN(start.getTime())) throw new Error('Başlangıç tarihi geçersiz.');
    if(start.getUTCFullYear() < 1950 || start.getUTCFullYear() > 2100) throw new Error('Başlangıç tarihi 1950 ile 2100 yılları arasında olmalıdır.');
    if(!UNITS[unit]) throw new Error('Süre birimi geçersiz.');
    const n = Number(amount);
    if(!Number.isInteger(n) || n < 1 || n > MAX[unit]) throw new Error(`Süre 1 ile ${MAX[unit]} ${UNITS[unit]} arasında bir tam sayı olmalıdır.`);
    const steps = [], warnings = [];
    let end = unit === 'gun' ? addDays(start, n) : unit === 'hafta' ? addDays(start, 7 * n) : addMonths(start, unit === 'ay' ? n : 12 * n);
    steps.push(`Başlangıç: ${longDate(start)} (bu gün hesaba katılmaz).`);
    steps.push(`${n} ${UNITS[unit]} → ${longDate(end)}${unit !== 'gun' ? ' (son haftanın / ayın aynı günü)' : ''}.`);
    if(unit === 'ay' || unit === 'yil'){ const want = start.getUTCDate(); if(end.getUTCDate() !== want) steps.push(`O ayda ${want}. gün olmadığından ayın son günü alındı.`); }
    const shift = d => {
      let r;
      while((r = offReason(d, {saturday}))){ steps.push(`${longDate(d)}: ${r} → ertesi gün.`); d = addDays(d, 1); }
      return d;
    };
    // The recess test uses the period's own last day too: 30 August (holiday) →
    // 31 August (Sunday) → 1 September still "ends in the recess" and moves to 7 September.
    const raw = end;
    end = shift(end);
    if(recess && (inRecess(raw) || inRecess(end))){
      const hit = inRecess(raw) ? raw : end, y = hit.getUTCFullYear();
      steps.push(`${longDate(hit)} adli tatile (20 Temmuz – 31 Ağustos) rastlıyor → tatilin bitiminden itibaren bir hafta uzar (${recessBasis}).`);
      end = shift(addDays(D(y, 8, 31), 7));
      steps.push(`Uzatılmış son gün: ${longDate(end)}.`);
    }
    const half = yearInfo(end.getUTCFullYear()).half.get(key(end));
    if(half) warnings.push(`Son gün ${half}: süre uzamaz ve o gün mesai öğleden sonra bitebilir; işlemi sabahtan yapın.`);
    // Only the years the last day can fall in matter (the start year's holidays play no part).
    for(const y of new Set([raw.getUTCFullYear(), end.getUTCFullYear()])) if(!KNOWN_YEARS.includes(y)) warnings.push(`${y} yılının dini bayram tarihleri tabloda yok; Ramazan ve Kurban Bayramı tatillerini kendiniz kontrol edin.`);
    if(today instanceof Date){
      const left = Math.round((end - today) / 864e5);
      if(left < 0) warnings.push(`Bu süre ${-left} gün önce dolmuş görünüyor.`);
      return {end, steps, warnings, left};
    }
    return {end, steps, warnings};
  }

  // RFC 5545 §3.1: content lines are folded at 75 octets (CRLF + space), never inside a UTF-8 sequence.
  function fold(line){
    const out = [];
    let cur = '', size = 0;
    for(const ch of line){
      const cp = ch.codePointAt(0), n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if(size + n > 75){ out.push(cur); cur = ' '; size = 1; }
      cur += ch; size += n;
    }
    out.push(cur);
    return out.join('\r\n');
  }
  function ics({end, title, description}){
    const esc = s => String(s || '').replace(/[\\;,]/gu, m => `\\${m}`).replace(/\r?\n/gu, '\\n');
    const ymd = d => key(d).replace(/-/gu, '');
    const stamp = new Date().toISOString().replace(/[-:]/gu, '').replace(/\.\d+Z$/u, 'Z');
    const uid = `${ymd(end)}-${Math.random().toString(36).slice(2, 10)}@wordtoudf`;
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WordToUDF//Sure hesabi//TR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(end)}`, `DTEND;VALUE=DATE:${ymd(addDays(end, 1))}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(description)}`,
      'BEGIN:VALARM', 'TRIGGER:-P2D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }

  globalThis.WordToUDFDeadline = {PRESETS, preset, compute, ics, offReason, inRecess, longDate, trDate, holidays, KNOWN_YEARS, ICRA_NOTE};

  /* ------------------------------ page ------------------------------ */
  if(typeof document === 'undefined' || !document.getElementById('dKind')) return;
  const $ = id => document.getElementById(id);
  // formatToParts: the en-CA "YYYY-MM-DD" shape is not guaranteed by every ICU version.
  const todayUTC = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: 'Europe/Istanbul', year: 'numeric', month: 'numeric', day: 'numeric'}).formatToParts(new Date()).map(x => [x.type, x.value]));
    return D(Number(parts.year), Number(parts.month), Number(parts.day));
  };
  for(const g of PRESETS){ const og = document.createElement('optgroup'); og.label = g.group; for(const p of g.items) og.append(new Option(`${p.label}${p.law ? ` — ${p.amount} ${UNITS[p.unit]} (${p.law})` : ''}`, p.id)); $('dKind').append(og); }
  $('dStart').value = key(todayUTC());
  let last = null;
  function say(text, kind = ''){ $('status').textContent = text; $('status').className = `status ${kind}`; }
  function syncKind(){
    const p = preset($('dKind').value);
    $('dCustom').hidden = p.id !== 'custom';
    if(p.id !== 'custom'){ $('dAmount').value = String(p.amount); $('dUnit').value = p.unit; }
    $('dRecess').checked = p.recess;
    const icra = PRESETS[1].items.includes(p);
    $('dKindNote').textContent = [p.note, icra ? ICRA_NOTE : ''].filter(Boolean).join(' ');
    $('dKindNote').hidden = !$('dKindNote').textContent;
  }
  function update(){
    const p = preset($('dKind').value);
    const v = $('dStart').value;
    $('dAmount').max = String(MAX[$('dUnit').value] || MAX.gun);
    // A failed or empty input must not leave the previous result's steps, days left or "late" colour behind.
    const clear = () => { $('dDate').textContent = '—'; $('dLeft').textContent = ''; $('dSteps').replaceChildren(); $('dWarn').replaceChildren(); $('dWarn').hidden = true; $('dResult').classList.remove('late'); last = null; };
    if(!/^\d{4}-\d{2}-\d{2}$/u.test(v)){ clear(); say(''); return; }
    try{
      const raw = $('dAmount').value.trim();
      const r = compute(new Date(`${v}T00:00:00Z`), raw === '' ? NaN : Number(raw), $('dUnit').value, {recess: $('dRecess').checked, saturday: $('dSaturday').checked, today: todayUTC(),
        recessBasis: PRESETS[2].items.includes(p) ? 'İYUK m. 8/3' : 'HMK m. 104'});
      last = {...r, preset: p};
      $('dDate').textContent = longDate(r.end);
      $('dLeft').textContent = r.left > 0 ? `Bugünden itibaren ${r.left} gün kaldı.` : r.left === 0 ? 'Son gün bugün.' : '';
      $('dSteps').replaceChildren(...r.steps.map(t => Object.assign(document.createElement('li'), {textContent: t})));
      $('dWarn').replaceChildren(...r.warnings.map(t => Object.assign(document.createElement('li'), {textContent: t})));
      $('dWarn').hidden = !r.warnings.length;
      $('dResult').classList.toggle('late', r.left < 0);
      say('');
    }catch(err){ clear(); say(err.message, 'error'); }
  }
  const noteText = () => {
    if(!last) return '';
    const what = last.preset.id === 'custom' ? `${$('dAmount').value} ${UNITS[$('dUnit').value]} süre` : `${last.preset.label} (${last.preset.law})`;
    const label = $('dLabel').value.trim();
    return [`${label ? `${label} — ` : ''}${what}`, `Son gün: ${longDate(last.end)} (${trDate(last.end)})`, ...last.steps.map(s => `• ${s}`), ...last.warnings.map(s => `! ${s}`),
      'Yardımcı hesaptır; kanun metni, tebliğ kaydı ve güncel tatil takvimiyle kontrol edin.'].join('\n');
  };
  $('dKind').addEventListener('change', () => { syncKind(); update(); });
  for(const id of ['dStart', 'dAmount', 'dUnit', 'dRecess', 'dSaturday']) $(id).addEventListener('input', update);
  for(const id of ['dRecess', 'dSaturday', 'dUnit']) $(id).addEventListener('change', update);
  $('dIcs').addEventListener('click', () => {
    if(!last){ say('Önce geçerli bir başlangıç tarihi ve süre girin.', 'error'); return; }
    const label = $('dLabel').value.trim();
    const title = `Son gün: ${last.preset.id === 'custom' ? 'süre' : last.preset.label}${label ? ` – ${label}` : ''}`;
    const blob = new Blob([ics({end: last.end, title, description: noteText()})], {type: 'text/calendar;charset=utf-8'});
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `sure-${key(last.end)}.ics`; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    say('Takvim dosyası indirildi; açınca son gün iki gün önceden hatırlatmalı olarak takviminize eklenir.', 'success');
  });
  $('dCopy').addEventListener('click', async () => {
    if(!last){ say('Önce geçerli bir başlangıç tarihi ve süre girin.', 'error'); return; }
    try{ await navigator.clipboard.writeText(noteText()); say('Hesap notu panoya kopyalandı.', 'success'); }
    catch{ say('Pano kullanılamadı; notu aşağıdaki adımlardan elle kopyalayın.', 'error'); }
  });
  syncKind(); update();
})();
