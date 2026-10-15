/* Print / save as PDF (v1.10) for the converter and template pages.
 *
 * The final block model is rendered once more into an off-screen sheet
 * (#docPrint) at the printable width, so tab stops are measured exactly as in
 * the preview. Page size and margins come from the document through a
 * constructed stylesheet (no inline <style>, the CSP stays strict). While
 * printing, only that sheet is visible (body.print-doc, see workspace.css).
 */
(() => {
  'use strict';
  const PX = 96 / 72;
  let pending = false; // a print waiting for fonts: a second press is ignored
  function printBlocks(blocks, {margins = {}, landscape = false, font, size, title} = {}){
    if(!Array.isArray(blocks) || !blocks.some(b => b.kind === 'paragraph')) throw new Error('Yazdırılacak paragraf yok.');
    if(pending) return;
    const m = {top: margins.top ?? 42.52, right: margins.right ?? 42.52, bottom: margins.bottom ?? 42.52, left: margins.left ?? 42.52};
    let surface = document.getElementById('docPrint');
    if(!surface){ surface = document.createElement('div'); surface.id = 'docPrint'; surface.setAttribute('aria-hidden', 'true'); document.body.append(surface); }
    const paper = document.createElement('article'); paper.className = 'paper print-paper';
    surface.replaceChildren(paper);
    WordToUDFPreview.render(paper, blocks, {margins: {top: 0, right: 0, bottom: 0, left: 0}, landscape, font, size, guides: false});
    // Printable width = A4 minus the side margins (tabs are measured on it).
    paper.style.width = `${(landscape ? 1123 : 794) - (m.left + m.right) * PX}px`;
    paper.style.minHeight = '0';
    WordToUDFPreview.positionTabs(paper);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: ${m.top}pt ${m.right}pt ${m.bottom}pt ${m.left}pt; }`);
    // A copy: adoptedStyleSheets is a live array.
    const before = [...document.adoptedStyleSheets], oldTitle = document.title;
    document.adoptedStyleSheets = [...before, sheet];
    // Chrome suggests the page title as the PDF file name.
    if(title) document.title = title;
    document.body.classList.add('print-doc');
    const done = () => {
      pending = false;
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('print-doc');
      document.adoptedStyleSheets = before; document.title = oldTitle;
      surface.replaceChildren();
    };
    window.addEventListener('afterprint', done);
    // Without Times New Roman the bundled Tinos is used; if it is still
    // loading, measure the tab stops again once it is there.
    if(document.fonts?.status === 'loading'){
      pending = true;
      document.fonts.ready.then(() => { if(!surface.contains(paper)){ pending = false; return; } WordToUDFPreview.positionTabs(paper); window.print(); });
    } else window.print();
  }
  globalThis.WordToUDFPrint = {printBlocks};
})();
