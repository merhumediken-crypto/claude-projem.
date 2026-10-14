/* One conversion pipeline shared by the single-file page, batch conversion
 * and the petition templates, so the three can never drift apart:
 *
 *   source blocks → normalize.js → legal-typography.js → manual overrides
 *                 → checks.js → udf.js (write + verify) → zip.js
 */
(() => {
  'use strict';
  const LEGAL_FONT = 'Times New Roman';
  const LEGAL_SIZE = 12;

  // Typography options from the saved settings object (settings.js shape).
  function legalOptions(settings){
    const S = globalThis.WordToUDFSettings;
    const s = S ? S.sanitize(settings) : (settings || {});
    return {
      lineSpacing: s.lineSpacing ?? 1.5,
      dateMode: s.dateToday === false ? 'keep' : 'today',
      markUets: s.markUets !== false,
      listMode: s.listMode === 'auto' ? 'auto' : 'text',
      splitRequests: !!s.splitRequests,
      font: LEGAL_FONT,
      ownAttorney: s.ownAttorney?.name ? s.ownAttorney : null,
      uetsRegistry: S ? S.registry(s) : []
    };
  }

  function typeset(sourceBlocks, {profile = 'legal', selection = {start: 'auto', end: 'auto'}, settings, now = new Date(), edits, overrides, sourceMargins} = {}){
    const legal = profile !== 'faithful';
    const opts = legalOptions(settings);
    const norm = WordToUDFNormalize.apply(sourceBlocks, selection, {preserveFormatting: !legal, sourceMargins, lineSpacing: opts.lineSpacing});
    const typo = WordToUDFLegalTypography.apply(norm.blocks, {enabled: legal, selection: norm.selection, now, ...opts});
    // Manual paragraph edits (edits.js) run in both profiles, after the
    // automatic rules; every paragraph is tagged with its edit key.
    let blocks = typo.blocks, applied = 0, editLog = [];
    if(globalThis.WordToUDFEdits){ const r = WordToUDFEdits.apply(blocks, edits || overrides, opts); blocks = r.blocks; applied = r.applied; editLog = r.log; }
    const checks = globalThis.WordToUDFChecks ? WordToUDFChecks.run(blocks, typo.statistics, {now}) : [];
    if(applied && legal) checks.push({level: 'info', code: 'manual-edits', message: `${applied} paragraf elle düzenlendi; ayrıntılar dönüşüm raporunda.`});
    return {norm, blocks, typography: {...typo.statistics, overrides: applied, edits: editLog}, checks, legal};
  }

  const EMPTY_DOC = 'Belgede yazdırılacak paragraf kalmadı (hepsi silinmiş olabilir); silinenleri "Geri al" ile geri getirin.';
  function assertHasText(blocks){
    if(!Array.isArray(blocks) || !blocks.some(b => b.kind === 'paragraph')) throw new Error(EMPTY_DOC);
  }
  // Serialise, verify, zip, re-open and verify again. Throws on any mismatch.
  async function toUdf(blocks, {margins, landscape, font, size} = {}){
    assertHasText(blocks);
    const writer = WordToUDFWriter.write(blocks, {margins, font: font || LEGAL_FONT, size: size || LEGAL_SIZE, landscape});
    const checked = WordToUDFWriter.verify(writer.xml, writer.fullText);
    const bytes = await WordToUDFZip.makeZip('content.xml', writer.xml);
    const zip = WordToUDFZip.openZip(bytes);
    if(zip.names.length !== 1 || !zip.has('content.xml')) throw new Error('UDF ZIP dosya listesi doğrulanamadı.');
    WordToUDFWriter.verify(await zip.text('content.xml'), writer.fullText);
    return {bytes, paragraphs: writer.paragraphs, breaks: writer.breaks, lists: checked.lists};
  }

  function safeName(s, ext = /\.docx$/iu){
    return String(s || 'Belge').replace(ext, '').normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/gu, '')
      .replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/gu, '_').replace(/\s+/gu, ' ').trim().replace(/[. ]+$/u, '').slice(0, 90) || 'Belge';
  }

  // Batch: every DOCX goes through the same pipeline; a failing file does not
  // stop the others and is listed in the batch report instead.
  async function batch(files, {settings, profile = 'legal', now = new Date(), onProgress} = {}){
    const entries = [], report = [], names = new Set();
    let i = 0;
    for(const file of files){
      i++; onProgress?.(i, files.length, file.name);
      try{
        if(!/\.docx$/iu.test(file.name)) throw new Error('yalnız .docx desteklenir');
        if(file.size < 100 || file.size > 24 * 1024 * 1024) throw new Error('dosya boş, hasarlı veya 24 MB sınırını aşıyor');
        const source = await WordToUDFDocx.readDocx(await file.arrayBuffer());
        const t = typeset(source.blocks, {profile, settings, now, sourceMargins: source.options.margins});
        const legal = t.legal;
        const udf = await toUdf(t.blocks, {margins: t.norm.margins, landscape: source.options.landscape, font: legal ? LEGAL_FONT : source.options.font, size: legal ? LEGAL_SIZE : source.options.size});
        let name = safeName(file.name) + '.udf', n = 2;
        while(names.has(name.toLocaleLowerCase('tr-TR'))) name = `${safeName(file.name)} (${n++}).udf`;
        names.add(name.toLocaleLowerCase('tr-TR'));
        entries.push({name, content: udf.bytes});
        const issues = t.checks.filter(c => c.level !== 'info');
        report.push(`✔ ${file.name} → ${name} (${udf.paragraphs} paragraf${source.warnings.length ? `, ${source.warnings.length} dönüşüm uyarısı` : ''})`);
        for(const c of issues) report.push(`    ${c.level === 'error' ? 'HATA' : 'uyarı'}: ${c.message}`);
        for(const w of source.warnings) report.push(`    dönüşüm: ${w.message}`);
      }catch(err){
        report.push(`✘ ${file.name}: ${err.message}`);
      }
    }
    if(!entries.length) throw new Error('Hiçbir dosya dönüştürülemedi.\n' + report.join('\n'));
    entries.push({name: 'toplu-donusum-raporu.txt', content: new TextEncoder().encode(['WORD → UDF TOPLU DÖNÜŞÜM RAPORU', `Tarih: ${WordToUDFLegalTypography.todayTR(now)}`, '', ...report, '', 'UDF dosyalarını UYAP Doküman Editörü\'nde açarak son kontrolü yapın.'].join('\n'))});
    const bytes = await WordToUDFZip.makeZipFiles(entries);
    return {bytes, converted: entries.length - 1, total: files.length, report};
  }

  globalThis.WordToUDFPipeline = {LEGAL_FONT, LEGAL_SIZE, EMPTY_DOC, assertHasText, legalOptions, typeset, toUdf, batch, safeName};
})();
