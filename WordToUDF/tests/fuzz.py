"""Seeded robustness test: python tests/fuzz.py [iterations] [seed]

Runs inside Chromium with the real page scripts. Random petitions (odd
characters, huge paragraphs, XML/HTML specials, control characters), random
manual edits, random/broken pasted HTML and every template with empty or odd
fields go through the full pipeline including UDF write + XML verification +
ZIP round trip. Any exception or invalid UDF is a failure. The PRNG is seeded,
so a failure is reproducible with the printed seed.
"""
import os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0, str(Path(__file__).resolve().parent))
import e2e

FUZZ_JS = r"""
async ([iterations, seed]) => {
  let x = seed >>> 0;
  const rnd = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const LINES = ["ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE", 'Ankara 3. İş Mahkemesine', 'T.C.', 'MAZERET DİLEKÇESİDİR',
    'DOSYA NO\t:\t2026/1929 Esas', 'ESAS NO: 2026/1', 'KARAR NO: 2026/2', 'DAVALI: İsa ÇİFTÇİ', 'DAVACI:', 'Yapı ve Kredi Bankası Anonim Şirketi',
    'VEKİLİ: Av. Fatih Nakışlı', 'VEKİLİ: Av. Ali Kaya, Av. Su Ak', 'ADRES VE UETS: 11111-22222-33333', 'UETS: 1-2', 'KARŞI TARAF DAVALI: X',
    'KONU: Mazeret.', 'AÇIKLAMALAR', 'AÇIKLAMALAR: Satır içi açıklama.', 'I. BAŞLIK', 'HUKUKİ SEBEPLER: HMK m. 6, 7.', 'DELİLLER',
    'Mahkemenizin 14.10.2026 tarihli duruşmasına katılamayacağız.', 'Yargıtay 3. Hukuk Dairesi 2025/5112 E., 2026/3190 K. sayılı kararı.',
    'SONUÇ VE İSTEM', 'SONUÇ VE İSTEM: Yukarıda açıklanan nedenlerle; kabulüne, reddine, iptaline karar verilmesini talep ederiz. 01.01.2020',
    'Yukarıda arz edilen sebeplerle;', '1. Kabulüne,', '2) Reddine,', 'a) alt talep,', '- madde', 'Karar verilmesini talep ederim.', '14.10.2026',
    'Davalı İsa Çiftçi Vekili', 'Av. Fatih NAKIŞLI', 'EKLER', 'EK-1 Vekaletname', '1- Karar', '', '   ', '\t\t', ':', '::::', '31.02.2026',
    ']]>', '<script>alert(1)</script>', '&amp; &lt; "tırnak" \'tek\'', '\u0001\u0002 kontrol', '\u202Egizli yön\u202C', 'emoji 😀 ve \uD83D yarım',
    'ÇOK UZUN ' + 'kelime '.repeat(900), 'x'.repeat(5000), 'a\nb\r\nc', 'İİK m. 50/2-a ve 51'];
  const fails = [];
  const P = WordToUDFPipeline, E = WordToUDFEdits, S = WordToUDFSettings;
  const settings = S.sanitize({});
  for(let it = 0; it < iterations; it++){
    const n = 1 + Math.floor(rnd() * 40);
    const blocks = [];
    for(let i = 0; i < n; i++){
      const t = pick(LINES);
      if(rnd() < 0.05){ blocks.push({kind: 'page-break'}); continue; }
      const cut = Math.floor(rnd() * (t.length + 1));
      const runs = [{text: t.slice(0, cut), bold: rnd() < .3, italic: rnd() < .2, underline: rnd() < .2}, {text: t.slice(cut), bold: rnd() < .3}].filter(r => r.text);
      blocks.push({kind: 'paragraph', runs: runs.length ? runs : [{text: ''}], alignment: pick(['left', 'center', 'right', 'justify', undefined]), source: rnd() < .05 ? 'table' : undefined});
    }
    const opt = {...settings, listMode: pick(['text', 'auto']), splitRequests: rnd() < .5, lineSpacing: pick([1, 1.5]), dateToday: rnd() < .8};
    const profile = rnd() < .85 ? 'legal' : 'faithful';
    try{
      let t = P.typeset(blocks, {profile, settings: opt, now: new Date('2026-10-14T09:00:00Z')});
      const keys = E.blockKeys(t.blocks.map(b => ({...b, inserted: false}))).filter(Boolean);
      const edits = new Map();
      for(const k of keys) if(rnd() < .25) edits.set(k, E.sanitize({role: pick([...Object.keys(E.ROLES), undefined]), align: pick(['left', 'center', 'right', 'justify', undefined]),
        bold: pick([true, false, undefined]), size: pick([...E.SIZES, undefined]), left: pick([...E.INDENTS, undefined]), above: pick([...E.SPACES, undefined]),
        text: rnd() < .15 ? pick(LINES) : undefined, remove: rnd() < .1, mergeNext: rnd() < .1, blankBefore: rnd() < .1, breakBefore: rnd() < .05}));
      // Edits are keyed on the typeset text, so apply them through a second typeset.
      t = P.typeset(blocks, {profile, settings: opt, now: new Date('2026-10-14T09:00:00Z'), edits});
      const udf = await P.toUdf(t.blocks, {margins: t.norm.margins});
      if(!(udf.bytes.length > 100)) throw new Error('UDF çok küçük');
      // Text-mode list numbers must be consecutive per list.
      const counters = {};
      for(const b of t.blocks){ if(!b.listMarker || b.listLevel) continue; counters[b.listId] = (counters[b.listId] || 0) + 1; if(b.listMarker !== `${counters[b.listId]}.`) throw new Error(`liste numarası sırası bozuk: ${b.listMarker}`); }
      if(!Array.isArray(t.checks)) throw new Error('denetim sonucu yok');
    }catch(err){ if(String(err && err.message).startsWith('Belgede yazdırılacak paragraf kalmadı')) continue; fails.push({kind: 'petition', it, err: String(err && err.stack || err).slice(0, 400), lines: blocks.map(b => (b.runs || []).map(r => r.text).join('')).slice(0, 12)}); }
  }
  // Pasted HTML: random, nested, broken.
  const TAGS = ['p', 'div', 'b', 'i', 'u', 'span style="font-weight:700"', 'span style="mso-tab-count:1"', 'span style="mso-list:Ignore"', 'li', 'ul', 'ol', 'table', 'tr', 'td', 'br', 'h2', 'pre', 'script', 'style', 'img src=x', 'svg', 'center', 'font size=7'];
  for(let it = 0; it < Math.ceil(iterations / 2); it++){
    let html = '<meta charset="utf-8">' + (rnd() < .3 ? '<html xmlns:w="urn:schemas-microsoft-com:office:word">' : '');
    const depth = 1 + Math.floor(rnd() * 60);
    for(let d = 0; d < depth; d++){ const tag = pick(TAGS); html += `<${tag}>${rnd() < .6 ? pick(LINES).replace(/[<>]/g, '') : ''}`; if(rnd() < .4) html += `</${tag.split(' ')[0]}>`; }
    const text = rnd() < .5 ? html.replace(/<[^>]*>/g, '\n') : '';
    try{
      let parsed;
      try{ parsed = WordToUDFPaste.parse({html, text}); }
      catch(err){ if(/metin bulunamadı/u.test(err.message)) continue; throw err; }
      const asm = WordToUDFPaste.assemble(parsed.blocks, {court: pick(['', 'Ankara 1. Asliye Hukuk Mahkemesi']), caseNo: pick(['', '2026/1', 'abc']), client: pick(['', 'Ali VELİ', '<b>x</b>']), other: pick(['', 'Banka']), topic: pick(['', 'Konu.']), addHeadings: rnd() < .8, addSignature: rnd() < .8}, settings);
      const t = P.typeset(asm.blocks, {profile: 'legal', settings, now: new Date('2026-10-14T09:00:00Z')});
      await P.toUdf(t.blocks, {margins: t.norm.margins});
    }catch(err){ fails.push({kind: 'paste', it, err: String(err && err.stack || err).slice(0, 400), html: html.slice(0, 300)}); }
  }
  // Very deep HTML must not crash the page (falls back to plain text).
  try{ WordToUDFPaste.parse({html: '<div>'.repeat(20000) + 'derin metin', text: 'derin metin'}); }
  catch(err){ if(!/metin bulunamadı/u.test(err.message)) fails.push({kind: 'deep-html', err: String(err).slice(0, 300)}); }
  // Every template with empty and odd values.
  const T = WordToUDFTemplates;
  for(const tpl of T.TEMPLATES) for(const odd of [{}, {hearingDate: '<x>', client: ']]>', reason: 'yok', method: 'yok', witnesses: '\n\n', objections: 'a\tb', grounds: 'x'.repeat(3000), access: 'evet'}]){
    try{
      const lines = T.sourceLines({court: odd.client || '', caseNo: odd.hearingDate || '', role: 'DAVALI', client: odd.client || ''},
        {topic: tpl.topic(odd), body: tpl.body(odd), requests: tpl.requests(odd), closing: tpl.closing, attachments: tpl.attachments(odd)}, {attorneyName: 'Av. Fatih NAKIŞLI'});
      const t = P.typeset(T.toBlocks(lines), {profile: 'legal', settings, now: new Date('2026-10-14T09:00:00Z')});
      await P.toUdf(t.blocks, {margins: t.norm.margins});
    }catch(err){ fails.push({kind: 'template', id: tpl.id, err: String(err && err.stack || err).slice(0, 400)}); }
  }
  return fails;
}
"""

def main():
    iterations = int(sys.argv[1]) if len(sys.argv) > 1 else 300
    seed = int(sys.argv[2]) if len(sys.argv) > 2 else 20261014
    exe = os.environ.get('CHROMIUM', '/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else '/usr/bin/chromium')
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=exe, headless=True, args=['--no-sandbox', '--disable-dev-shm-usage'])
        page = browser.new_page()
        errors = []; page.on('pageerror', lambda e: errors.append(str(e)))
        e2e.load_page(page, 'workspace.html')
        fails = page.evaluate(FUZZ_JS, [iterations, seed])
        browser.close()
    for f in fails[:10]: print('FAIL', f)
    assert not errors, errors
    if fails:
        print(f'FUZZ {len(fails)} BAŞARISIZ (tohum {seed})'); sys.exit(1)
    print(f'FUZZ {iterations} dilekçe + {iterations // 2} yapıştırma + 16 şablon denemesi başarılı (tohum {seed})')

if __name__ == '__main__':
    main()
