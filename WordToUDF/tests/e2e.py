"""Run: python tests/e2e.py. Requires installed Chromium, Playwright and python-docx."""
from pathlib import Path
import io, os, tempfile, zipfile, re
from lxml import etree
from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parent.parent
def page_scripts(name):
    return re.findall(r'<script\s+src="([^"]+)"\s*></script>',(ROOT/name).read_text(encoding='utf-8'))

def load_page(page,name,scripts=None):
    # Scripts are taken from the page itself so the test never drifts from
    # the shipped HTML (an explicit list is still accepted).
    scripts=scripts or page_scripts(name)
    # Browser administration policy blocks URL navigation in this environment.
    # The actual extension HTML and JS are nevertheless executed in Chromium
    # after removing only external script tags and CSP (opaque test origin).
    html=(ROOT/name).read_text(encoding='utf-8')
    html=re.sub(r'<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>', '', html)
    html=re.sub(r'<script\s+src="[^"]+"\s*></script>', '', html)
    html=re.sub(r'<link\s+rel="stylesheet"[^>]*>', '', html)
    page.set_content(html,wait_until='load')
    for css_name in (['workspace.css','reverse.css'] if name=='reverse.html' else ['workspace.css']):
        page.add_style_tag(content=(ROOT/css_name).read_text(encoding='utf-8'))
    for script in scripts:page.add_script_tag(content=(ROOT/script).read_text(encoding='utf-8'))

def write_source(p):
    d=Document()
    for sec in d.sections:
        sec.left_margin=Cm(2.3);sec.right_margin=Cm(2.4)
        sec.top_margin=Cm(2.1);sec.bottom_margin=Cm(2.2)
    d.add_paragraph('T.C.')
    h=d.add_paragraph()
    r=h.add_run('ŞANLIURFA 1. ASLİYE HUKUK MAHKEMESİNE');r.underline=True;r.bold=False
    d.add_paragraph('DAVACI:')
    d.add_paragraph('Ali Veli')
    d.add_paragraph('DAVALI: Karşı taraf')
    d.add_paragraph('VEKİLİ: Av. Fatih Nakışlı')
    d.add_paragraph('AÇIKLAMALAR')
    d.add_paragraph('I. TEMEL AÇIKLAMALAR')
    v=d.add_paragraph();v.alignment=WD_ALIGN_PARAGRAPH.CENTER
    v.paragraph_format.line_spacing=1.5
    v.paragraph_format.space_before=Pt(13)
    v.add_run('HMK ');r=v.add_run('m. 119');r.bold=True;v.add_run(' hükmü uygulanmalıdır.')
    cite=d.add_paragraph();cite.add_run('Yargıtay 3.');cite.add_run(' Hukuk Dairesi 2025/5112 E., ');cite.add_run('2026/3190 K.')
    d.add_paragraph('SONUÇ VE İSTEM')
    d.add_paragraph('1. Davanın KABULÜNE karar verilmesini talep ederim.')
    d.add_paragraph('Av. Fatih Nakışlı')
    d.add_paragraph('EKLER')
    d.add_paragraph('EK-1 Örnek belge')
    d.save(p)

def write_petition(p):
    """Dumanbey-type petition: separate label lines, Word auto-numbered requests."""
    d=Document()
    for t in ['T.C.','İSTANBUL 22. ASLİYE TİCARET MAHKEMESİNE','İHTİYATİ HACİZ KARARINA İTİRAZ VE İVEDİ İNCELEME TALEPLİDİR.',
              'DOSYA NO: 2026/713 E.','KARAR NO: 2026/708','İHTİYATİ HACZE İTİRAZ EDEN:',
              'Dumanbey Rezistans Isı Sistemleri ve Sanayi Ticaret Limited Şirketi','ADRES: Başpınar OSB, Şehitkamil/Gaziantep',
              'VEKİLİ: Av. Ayşe Nur Geyik Öztürkmen','ADRES VE UETS: 16615-16448-62422',
              'İHTİYATİ HACİZ TALEP EDEN: Pimar Plastik Kimya Tekstil Makina Sanayi ve Ticaret Limited Şirketi',
              'VEKİLİ: Av. Emin Kablama','İLGİLİ İCRA DOSYASI: İstanbul Anadolu 10. İcra Dairesi, 2026/18304 E.',
              'KONU: İhtiyati haciz kararına itiraz edilmesi istemidir.','AÇIKLAMALAR:','Mahkemenizce verilen karara itiraz ediyoruz.',
              'I. MAHKEMENİN YETKİSİNE İTİRAZ EDİLMEKTEDİR.','Müvekkil şirketin merkezi Gaziantep’tir.',
              'HUKUKİ SEBEPLER: İİK m. 50, 257, 258, 259 ve 265; HMK m. 6.','HUKUKİ DELİLLER: Çek, imza sirküleri, ticaret sicili kayıtları.',
              'SONUÇ VE İSTEM:','Yukarıda arz edilen sebeplerle;']:
        d.add_paragraph(t)
    for t in ['Yetki itirazının kabulüne,','İhtiyati haciz kararının kaldırılmasına,','Yargılama giderlerinin karşı tarafa yükletilmesine,']:
        d.add_paragraph(t,style='List Number')
    for t in ['Karar verilmesini vekâleten talep ederim.','14.10.2025','İtiraz Eden Vekili','Av. Ayşe Nur Geyik Öztürkmen','EKLER:','1- İhtiyati haciz kararı örneği.','2- Çek örneği.']:
        d.add_paragraph(t)
    d.save(p)

def data_xml(p):
    with zipfile.ZipFile(p) as z:
        assert z.testzip() is None
        return etree.fromstring(z.read('content.xml'))

def one(el,tag):
    return el.xpath(f'./{tag}')[0]

def udf_text(root):
    return ''.join(one(root,'content').itertext())

def fetch_data(page,source):
    page.locator('#fileInput').set_input_files(str(source))
    page.wait_for_timeout(1200)
    print('UPLOAD STATUS',page.locator('#status').text_content())
    print('WARNINGS',page.locator('#warningList').all_text_contents())
    print('READY',page.locator('#download').is_enabled())
    if page.locator('#review').count() and not page.locator('#reviewLabel').is_hidden():page.locator('#review').check()
    page.wait_for_function("!document.getElementById('download').disabled",timeout=7000)

def save_download(page,button,path):
    with page.expect_download(timeout=20000) as info: page.locator(button).click()
    dl=info.value
    dl.save_as(str(path))
    assert path.exists() and path.stat().st_size>100
    return dl.suggested_filename

def main():
    with tempfile.TemporaryDirectory(prefix='wordtoudf-e2e-') as tmp, sync_playwright() as pw:
        tmp=Path(tmp);source=tmp/'sample.docx';write_source(source)
        browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM','/opt/pw-browsers/chromium' if os.path.exists('/opt/pw-browsers/chromium') else '/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
        context=browser.new_context(accept_downloads=True,viewport={'width':1500,'height':1000})
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        load_page(page,'workspace.html')
        fetch_data(page,source)
        assert page.locator('[data-role="court-heading"]').count()==1
        assert page.locator('[data-role="signature"]').count()==1
        assert page.locator('[data-role="section-heading"]').count()==1
        assert page.locator('[data-role="metadata"]').count()>=3
        assert not page.locator('[data-role="metadata"]').all_text_contents()[0].count('DAVALI')
        legal_xml=tmp/'legal.udf'
        fname=save_download(page,'#download',legal_xml)
        assert fname=='sample.udf',fname
        root=data_xml(legal_xml)
        full=udf_text(root)
        assert 'HMK m. 119' in full and '2026/3190 K.' in full
        assert 'DAVACI\t: Ali VELİ' in full
        assert 'VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)' in full
        assert b'Cambria' not in etree.tostring(root) and all(c.get('family') in (None,'Times New Roman') for c in root.iter('content'))
        assert full.count('ŞANLIURFA')==1
        paras=root.xpath('./elements/paragraph')
        court=[p for p in paras if any('ŞANLIURFA' in full[int(r.get('startOffset')):int(r.get('startOffset'))+int(r.get('length'))] for r in p)]
        assert len(court)==1 and court[0].get('Alignment')=='1'
        assert all(r.get('underline')=='false' for r in court[0] if r.tag=='content')
        assert abs(float(one(one(root,'properties'),'pageFormat').get('leftMargin'))-42.52)<.02
        print('PASS hukuk profili DOCX→UDF, metin, roller, kenar boşlukları, UDF ZIP/XML')
        # Avoid changing the paragraph's source formatting in faithful mode.
        page.locator('#typographyProfile').select_option('faithful')
        page.wait_for_function("document.getElementById('sectionPanel').hidden")
        assert page.locator('[data-role="court-heading"]').count()==0
        faithful=tmp/'faithful.udf';save_download(page,'#download',faithful)
        root2=data_xml(faithful)
        props=one(one(root2,'properties'),'pageFormat')
        assert abs(float(props.get('leftMargin'))-(2.3*72/2.54))<.03
        paras2=root2.xpath('./elements/paragraph')
        styles=[p for p in paras2 if p.get('Alignment')=='1' and p.get('SpaceAbove')=='13']
        assert len(styles)>=1,'Kaynak Word paragraf aralığı/hizalama korunmadı'
        assert 'DAVACI:\nAli Veli' in udf_text(root2)
        print('PASS Word biçimini koru: paragraf hizası/aralığı, kenar boşlukları')
        # Re-enter legal, upload complete DOCX with warning and verify explicit acknowledgement.
        page.locator('#typographyProfile').select_option('legal')
        assert page.locator('#download').is_enabled()
        # UDF→DOCX reverse converter end-to-end.
        reverse=context.new_page();reverse.on('pageerror',lambda e:errors.append(str(e)))
        load_page(reverse,'reverse.html',['zip.js','udf-reader.js','docx-writer.js','reverse.js'])
        reverse.locator('#fileInput').set_input_files(str(legal_xml))
        reverse.wait_for_function("!document.getElementById('downloadWord').disabled",timeout=20000)
        round_trip=tmp/'roundtrip.docx'
        with reverse.expect_download(timeout=20000) as info:reverse.locator('#downloadWord').click()
        info.value.save_as(str(round_trip))
        back=Document(round_trip)
        entire='\n'.join(p.text for p in back.paragraphs)
        assert 'ŞANLIURFA' in entire and 'Yargıtay 3. Hukuk Dairesi' in entire
        assert 'Av. Fatih NAKIŞLI' in entire
        print('PASS UDF→DOCX geriye dönüş, temel metin bütünlüğü')
        # Negative ZIP archive case: traversal entry must be rejected.
        traversal=tmp/'path-traversal.docx'
        with zipfile.ZipFile(source) as zin,zipfile.ZipFile(traversal,'w') as zout:
            for name in zin.namelist():zout.writestr(name,zin.read(name))
            zout.writestr('../disallowed.xml','malicious')
        page.locator('#fileInput').set_input_files(str(traversal))
        page.wait_for_function("document.querySelector('#status').classList.contains('error')",timeout=7000)
        assert 'geçersiz dosya yolu' in page.locator('#status').text_content()
        assert page.locator('#download').is_disabled()
        print('PASS kötü niyetli ZIP ../ yolu reddedildi')
        # XML entity/doctype must be rejected, including otherwise valid DOCX ZIP.
        dtd=tmp/'doctype.docx'
        with zipfile.ZipFile(source) as zin,zipfile.ZipFile(dtd,'w') as zout:
            for name in zin.namelist():
                data=zin.read(name)
                if name=='word/document.xml':
                    data=data.replace(b'<w:document',b'<!DOCTYPE w:document [<!ENTITY secret "test">]><w:document',1)
                zout.writestr(name,data)
        page.locator('#fileInput').set_input_files(str(dtd))
        page.wait_for_function("document.querySelector('#status').classList.contains('error')",timeout=7000)
        assert 'DTD' in page.locator('#status').text_content() or 'ENTITY' in page.locator('#status').text_content()
        assert page.locator('#download').is_disabled()
        print('PASS DOCX XML DTD/ENTITY reddedildi')
        # Simulate an untrusted UDF whose compressed payload fails CRC/inflate.
        corrupt=tmp/'corrupt.udf'
        blob=bytearray(legal_xml.read_bytes())
        blob[len(blob)//2]^=0x31
        corrupt.write_bytes(blob)
        reverse.locator('#fileInput').set_input_files(str(corrupt))
        reverse.wait_for_function("document.querySelector('#status').classList.contains('error')",timeout=7000)
        assert reverse.locator('#downloadWord').is_disabled()
        print('PASS bozuk UDF ZIP reddedildi')
        # A larger legal petition should finish synchronously without truncation.
        large=tmp/'large.docx'
        big=Document();big.add_paragraph('AÇIKLAMALAR')
        for i in range(1500):big.add_paragraph(f'Paragraf {i+1}: Deliller usulüne uygun değerlendirilmelidir.')
        big.add_paragraph('SONUÇ VE İSTEM');big.add_paragraph('1. Kabulüne karar verilmesini talep ederim.')
        big.save(large)
        page.locator('#fileInput').set_input_files(str(large))
        page.wait_for_function("document.getElementById('previewCount').textContent.includes('1503 paragraf')",timeout=25000)
        if not page.locator('#reviewLabel').is_hidden():page.locator('#review').check()
        output=tmp/'large.udf';save_download(page,'#download',output)
        root_large=data_xml(output)
        data=udf_text(root_large)
        assert 'Paragraf 1:' in data and 'Paragraf 1500:' in data
        # v1.4.0: "1. Kabulüne karar verilmesini talep ederim." becomes a list item
        # plus a separate dated closing paragraph, so 1503 source paragraphs → 1504.
        assert len(root_large.xpath('./elements/paragraph'))==1504
        print('PASS 1500 gövde paragrafı: 1504 UDF paragrafı (kapanış ayrıldı), metin kaybı yok')
        # v1.4.0 dilekçe standardı: ortak sekme, tek DOSYA NO, UETS, satır içi bölümler, gerçek listeler, tarih.
        petition=tmp/'petition.docx';write_petition(petition)
        page.locator('#listMode').select_option('auto')  # bu bölüm gerçek UDF listelerini denetler
        page.locator('#fileInput').set_input_files(str(petition))
        page.wait_for_function("document.getElementById('status').textContent.includes('petition.docx')",timeout=7000)
        if not page.locator('#reviewLabel').is_hidden():page.locator('#review').check()
        assert page.locator('#changeList li').count()>=10
        xs=page.evaluate("""()=>[...document.querySelectorAll('.paper .paragraph')].map(p=>{const t=p.querySelector('.tab-stop');const c=t&&t.nextElementSibling;return c&&c.textContent===':'?c.getBoundingClientRect().left:null}).filter(x=>x!==null)""")
        assert len(xs)==13 and max(xs)-min(xs)<0.5,xs
        if os.environ.get('SHOT'):page.locator('#paper').screenshot(path=os.environ['SHOT'])
        markers=page.locator('.list-marker').all_text_contents()
        assert markers==['1.','2.','3.','1.','2.'],markers
        out=tmp/'petition.udf';save_download(page,'#download',out)
        save_dir=os.environ.get('SAVE_DIR')
        if save_dir:
            import shutil
            shutil.copy(petition,Path(save_dir)/'ornek-dilekce-kaynak.docx');shutil.copy(out,Path(save_dir)/'ornek-dilekce.udf')
            save_download(page,'#reportDownload',Path(save_dir)/'ornek-dilekce-donusum-raporu.txt')
        root_p=data_xml(out);txt=udf_text(root_p)
        paras=root_p.xpath('./elements/paragraph')
        def ptext(p):return ''.join(txt[int(r.get('startOffset')):int(r.get('startOffset'))+int(r.get('length'))] for r in p)
        lines=[ptext(p).rstrip('\n') for p in paras]
        for expected in ['DOSYA NO\t: 2026/713 E. 2026/708 K.','İTİRAZ EDEN\t: Dumanbey Rezistans Isı Sistemleri ve Sanayi Ticaret Limited Şirketi',
                         'ADRESİ\t: Başpınar OSB, Şehitkamil/Gaziantep','VEKİLİ\t: Av. Ayşe Nur GEYİK ÖZTÜRKMEN (UETS: 16615-16448-62422)',
                         'TALEP EDEN\t: Pimar Plastik Kimya Tekstil Makina Sanayi ve Ticaret Limited Şirketi','VEKİLİ\t: Av. Emin KABLAMA',
                         'İCRA DOSYA NO\t: İstanbul Anadolu 10. İcra Dairesi, 2026/18304 E.','KONU\t: İhtiyati haciz kararına itiraz edilmesi istemidir.',
                         'AÇIKLAMALAR\t:','HUKUKİ SEBEPLER\t: İİK m. 50, 257, 258, 259 ve 265; HMK m. 6.','HUKUKİ DELİLLER\t: Çek, imza sirküleri, ticaret sicili kayıtları.',
                         'SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;','EKLER\t:']:
            assert expected in lines,(expected,lines)
        assert 'KARAR NO' not in txt and 'ADRES VE UETS' not in txt
        field=[p for p,l in zip(paras,lines) if '\t:' in l]
        assert len(field)==13
        stops={p.get('TabSet') for p in field};assert len(stops)==1,stops
        assert all(p.get('LeftIndent')=='0' and p.get('FirstLineIndent')=='0' for p in field)
        for p in field:
            kids=list(p)
            assert kids[1].tag=='tab' and kids[1].get('underline')=='true'
            assert kids[0].get('underline')=='true' and kids[0].get('bold')=='true'
            assert kids[2].get('underline')=='true' and txt[int(kids[2].get('startOffset'))]==':'
            for k in kids[3:]:assert k.get('underline')=='false'
        lists=[(p.get('ListId'),l) for p,l in zip(paras,lines) if p.get('Numbered')=='true']
        assert lists==[('1','Yetki itirazının kabulüne,'),('1','İhtiyati haciz kararının kaldırılmasına,'),('1','Yargılama giderlerinin karşı tarafa yükletilmesine,'),
                       ('2','İhtiyati haciz kararı örneği.'),('2','Çek örneği.')],lists
        import datetime,zoneinfo
        today=datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Istanbul')).strftime('%d.%m.%Y')
        assert f'Karar verilmesini vekâleten talep ederim. {today}' in lines and '14.10.2025' not in txt
        sig=[p for p,l in zip(paras,lines) if l in ('İtiraz Eden Vekili','Av. Ayşe Nur GEYİK ÖZTÜRKMEN')]
        assert len(sig)==2 and all(p.get('Alignment')=='2' for p in sig)
        body=[p for p,l in zip(paras,lines) if l.startswith('Mahkemenizce')][0]
        assert body.get('LineSpacing')=='0.5' and body.get('Alignment')=='3'
        print('PASS dilekçe standardı: ortak sekme, tek DOSYA NO, UETS, satır içi bölümler, otomatik listeler, tarih, imza')
        # v1.4.1 varsayılan: metin numarası + sekme (numara ilk sözcüğün üstüne binmez).
        page.locator('#listMode').select_option('text')
        out_t=tmp/'petition-text.udf';save_download(page,'#download',out_t)
        root_t=data_xml(out_t);txt_t=udf_text(root_t)
        paras_t=root_t.xpath('./elements/paragraph')
        lines_t=[''.join(txt_t[int(r.get('startOffset')):int(r.get('startOffset'))+int(r.get('length'))] for r in p).rstrip('\n') for p in paras_t]
        assert not any(p.get('Numbered') for p in paras_t)
        items_t=[(p,l) for p,l in zip(paras_t,lines_t) if re.match(r'^\d+\.\t',l)]
        assert [l for _,l in items_t]==['1.\tYetki itirazının kabulüne,','2.\tİhtiyati haciz kararının kaldırılmasına,','3.\tYargılama giderlerinin karşı tarafa yükletilmesine,','1.\tİhtiyati haciz kararı örneği.','2.\tÇek örneği.'],items_t
        assert all(p.get('LeftIndent')=='18' and p.get('FirstLineIndent')=='-18' and p.get('TabSet')=='18:0:0' and p[1].tag=='tab' for p,_ in items_t)
        print('PASS metin numaralı liste: 1.<TAB> asılı girinti, Numbered özniteliği yok')
        page.locator('#listMode').select_option('auto')
        # Word → UDF → Word: lists stay real Word lists with separate numbering.
        reverse.locator('#fileInput').set_input_files(str(out))
        reverse.wait_for_function("!document.getElementById('downloadWord').disabled",timeout=20000)
        rt=tmp/'petition-roundtrip.docx'
        with reverse.expect_download(timeout=20000) as info:reverse.locator('#downloadWord').click()
        info.value.save_as(str(rt))
        if save_dir:shutil.copy(rt,Path(save_dir)/'ornek-dilekce-udf-den-word.docx')
        with zipfile.ZipFile(rt) as z:
            assert 'word/numbering.xml' in z.namelist()
            docxml=etree.fromstring(z.read('word/document.xml'))
        W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
        numbered=[]
        for p in docxml.iter(W+'p'):
            num=p.find(f'./{W}pPr/{W}numPr')
            if num is not None:numbered.append((num.find(W+'numId').get(W+'val'),num.find(W+'ilvl').get(W+'val'),''.join(t.text or '' for t in p.iter(W+'t'))))
        assert [n[2] for n in numbered]==[l for _,l in lists],numbered
        assert len({n[0] for n in numbered[:3]})==1 and len({n[0] for n in numbered[3:]})==1 and numbered[0][0]!=numbered[3][0]
        assert all(n[1]=='0' for n in numbered)
        print('PASS Word→UDF→Word: talepler ve ekler iki ayrı gerçek Word listesi, düzey 0')
        assert not errors,errors
        print('PASS tarayıcı JS konsolu: hata yok')
        v15_checks(browser,tmp,petition,source)
        v16_paste(browser,tmp)
        browser.close()

def udf_lines(path):
    root=data_xml(path);txt=udf_text(root)
    return root,[''.join(txt[int(r.get('startOffset')):int(r.get('startOffset'))+int(r.get('length'))] for r in p).rstrip('\n') for p in root.xpath('./elements/paragraph')]

def v15_checks(browser,tmp,petition,sample):
    import datetime,zoneinfo
    today=datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Istanbul')).strftime('%d.%m.%Y')
    # --- Telefon: 390 px, karanlık mod; kağıt beyaz ve ekrana sığıyor.
    ctx=browser.new_context(accept_downloads=True,viewport={'width':390,'height':844},color_scheme='dark')
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    load_page(page,'workspace.html')
    fetch_data(page,petition)
    sw=page.evaluate("()=>[document.getElementById('previewViewport').scrollWidth,document.getElementById('previewViewport').clientWidth,document.documentElement.scrollWidth,innerWidth]")
    assert sw[0]<=sw[1]+1 and sw[2]<=sw[3]+1,sw
    bg=page.evaluate("()=>getComputedStyle(document.getElementById('paper')).backgroundColor")
    assert bg in ('rgb(255, 255, 255)','rgba(255, 255, 255, 1)'),bg
    assert 'Sığdır' in page.locator('#zoomToggle').text_content()
    page.locator('#zoomToggle').click()
    ov=page.evaluate("()=>{const v=document.getElementById('previewViewport');return [getComputedStyle(v).overflowX,v.scrollWidth>v.clientWidth]}")
    assert ov[0]=='auto' and ov[1],ov  # gerçek boyutta yana kaydırılabilir
    page.locator('#zoomToggle').click()
    print('PASS telefon görünümü: önizleme ekrana sığıyor, kağıt karanlık modda da beyaz')
    # --- Denetim paneli görünür ve hata sayısı yazılı.
    assert page.locator('#checksPanel').is_visible() and page.locator('#checkList li').count()>=1
    assert 'hata' in page.locator('#checkStats').text_content()
    # --- Elle düzeltme: imzaya dokun → düz paragraf → UDF'de sola yaslı.
    page.locator('#paper .paragraph[data-role="signature"]').last.click()
    sheet=page.locator('.edit-sheet')
    assert sheet.is_visible()
    box=sheet.bounding_box();assert box['y']+box['height']<=844+1 and box['width']>=380,box  # telefonda alttan açılan panel
    sheet.locator('.chip',has_text='Düz paragraf').click()
    assert page.locator('#paper .paragraph.edited').count()==1
    assert page.locator('#paper .paragraph.edited[data-role="edit-plain"]').count()==1
    page.locator('.edit-sheet .primary-btn',has_text='Tamam').click()
    assert page.locator('.edit-sheet').count()==0
    # Talep maddesi sil → numaralar kayar; geri al → geri gelir.
    items=page.locator('#paper .paragraph[data-role="result-item"]')
    assert items.count()==3
    items.nth(0).click();page.locator('.edit-sheet .chip',has_text='Paragrafı sil').click()
    nums=[re.match(r'^(\d+\.)',t).group(1) for t in page.locator('#paper .paragraph[data-role="result-item"]').all_inner_texts()]
    assert nums==['1.','2.'],nums
    assert page.locator('.edit-sheet').count()==0
    page.locator('#previewTools button',has_text='Geri al').click()
    assert page.locator('#paper .paragraph[data-role="result-item"]').count()==3
    # Çoklu seçim: iki gövde paragrafı ortala + kalın.
    page.locator('#previewTools button',has_text='Çoklu seçim').click()
    bodies=page.locator('#paper .paragraph[data-role="explanation-body"]')
    bodies.nth(0).click();bodies.nth(1).click()
    assert 'Seçilenleri düzenle' in page.locator('.select-bar').inner_text() and '2 paragraf' in page.locator('.select-bar').inner_text()
    page.locator('.select-bar button',has_text='Seçilenleri düzenle').click()
    page.locator('.edit-sheet .segmented .chip',has_text='Ortala').click()
    page.locator('.edit-sheet .chip',has_text='Kalın').click()
    al=page.evaluate("()=>[...document.querySelectorAll('#paper .paragraph.edited')].map(p=>p.style.textAlign)")
    assert al.count('center')==2,al
    page.locator('.edit-sheet .primary-btn',has_text='Tamam').click()
    page.locator('#previewTools button',has_text='Çoklu seçim').click()
    # Metin düzenleme (tek paragraf).
    page.locator('#paper .paragraph[data-role="topic"]').click()
    page.locator('.edit-sheet textarea').fill('KONU\t: İhtiyati haciz kararına itiraz ve ivedi inceleme istemidir.')
    page.locator('.edit-sheet button',has_text='Metni uygula').click()
    assert 'ivedi inceleme istemidir' in page.locator('#paper .paragraph.edited',has_text='KONU').inner_text()
    page.locator('.edit-sheet .primary-btn',has_text='Tamam').click()
    assert any('Elle düzenleme' in t for t in page.locator('#changeList li').all_text_contents())
    out=tmp/'override.udf';save_download(page,'#download',out)
    root,lines=udf_lines(out)
    paras=root.xpath('./elements/paragraph')
    sig=[p for p,l in zip(paras,lines) if l=='Av. Ayşe Nur GEYİK ÖZTÜRKMEN']
    assert len(sig)==1 and sig[0].get('Alignment')=='0',[(p.attrib,l) for p,l in zip(paras,lines)][-6:]
    assert [l for l in lines if re.match(r'^\d\.\t',l)][:3]==['1.\tYetki itirazının kabulüne,','2.\tİhtiyati haciz kararının kaldırılmasına,','3.\tYargılama giderlerinin karşı tarafa yükletilmesine,']
    centered=[p for p,l in zip(paras,lines) if p.get('Alignment')=='1' and l.startswith(('Mahkemenizce','Müvekkil'))]
    assert len(centered)==2 and all(c.get('bold')=='true' for p in centered for c in p if c.tag=='content'),[p.attrib for p in centered]
    assert 'KONU\t: İhtiyati haciz kararına itiraz ve ivedi inceleme istemidir.' in lines
    rp=tmp/'rapor.txt';save_download(page,'#reportDownload',rp);rt=rp.read_text(encoding='utf-8')
    assert 'Elle yapılan paragraf düzenlemeleri:' in rt and 'tür: Düz paragraf' in rt and 'metin değiştirildi' in rt,rt[-800:]
    print('PASS paragraf düzenleyici: tür, sil + numara kayması, geri al, çoklu seçim (ortala+kalın), metin; UDF ve raporda')
    # --- Düzenlenmiş DOCX indir.
    dx=tmp/'duzenlenmis.docx';save_download(page,'#downloadDocx',dx)
    d=Document(str(dx));texts=[p.text for p in d.paragraphs]
    assert 'VEKİLİ\t: Av. Ayşe Nur GEYİK ÖZTÜRKMEN (UETS: 16615-16448-62422)' in texts,texts[:12]
    assert any(t.startswith('Karar verilmesini vekâleten talep ederim. '+today) for t in texts)
    print('PASS düzenlenmiş Word (DOCX) indirme: UDF ile aynı metin')
    # --- Ayarlar dışa/içe aktarma.
    st=tmp/'ayarlar.json';save_download(page,'#exportSettings',st)
    import json
    data=json.loads(st.read_text(encoding='utf-8'));assert data['application']=='WordToUDF' and data['ownAttorney']['uets']=='16615-16448-62422'
    data['ownAttorney']={'name':'Av. Ayşe Nur GEYİK ÖZTÜRKMEN','uets':'99999-88888-77777'};st.write_text(json.dumps(data),encoding='utf-8')
    page.locator('#importSettings').set_input_files(str(st))
    page.wait_for_function("document.getElementById('ownUets').value==='99999-88888-77777'")
    assert page.locator('#paper .paragraph',has_text='UETS: 99999-88888-77777').count()==1
    print('PASS ayarlar dışa/içe aktarma: içe aktarılan vekil profili önizlemeye uygulandı')
    # --- Toplu dönüşüm: 2 geçerli + 1 hatalı dosya → ZIP + rapor.
    bad=tmp/'bozuk.docx';bad.write_bytes(b'PK'+b'0'*400)
    with page.expect_download(timeout=30000) as info:page.locator('#batchInput').set_input_files([str(petition),str(sample),str(bad)])
    zp=tmp/'toplu.zip';info.value.save_as(str(zp))
    with zipfile.ZipFile(zp) as z:
        names=sorted(z.namelist());assert names==['petition.udf','sample.udf','toplu-donusum-raporu.txt'],names
        rep=z.read('toplu-donusum-raporu.txt').decode('utf-8');assert '✘ bozuk.docx' in rep and '✔ petition.docx' in rep,rep
        inner=tmp/'p.udf';inner.write_bytes(z.read('petition.udf'));_,pl=udf_lines(inner);assert 'SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;' in pl
    page.wait_for_function("document.getElementById('status').textContent.includes('2/3')")
    print('PASS toplu dönüşüm: 2/3 dosya UDF, hatalı dosya raporda, ZIP doğrulandı')
    assert not errors,errors
    ctx.close()
    # --- Şablon sayfası: mazeret dilekçesi.
    ctx=browser.new_context(accept_downloads=True,viewport={'width':1400,'height':1000})
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    load_page(page,'templates.html')
    page.locator('#court').fill('Şanlıurfa 8. Asliye Hukuk Mahkemesi');page.locator('#caseNo').fill('2026/1929')
    page.locator('#client').fill('İsa ÇİFTÇİ');page.locator('#other').fill('Yapı ve Kredi Bankası Anonim Şirketi')
    page.locator('#f_hearingDate').fill('2026-10-20');page.locator('#f_reason').select_option('sehir')
    page.wait_for_timeout(400)
    assert page.locator('#paper [data-role="court-heading"]').text_content()=="ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE"
    tu=tmp/'sablon.udf';save_download(page,'#download',tu)
    root,lines=udf_lines(tu)
    for exp in ['DOSYA NO\t: 2026/1929 Esas','DAVALI\t: İsa ÇİFTÇİ','VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)','DAVACI\t: Yapı ve Kredi Bankası Anonim Şirketi',
                'KONU\t: 20.10.2026 tarihli duruşmaya ilişkin mesleki mazeretimizin sunulması ve kabulü talebidir.','SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;',
                '1.\t20.10.2026 tarihli duruşmaya ilişkin mesleki mazeretimizin kabulüne,',f'Karar verilmesini saygıyla talep ederiz. {today}','Davalı İsa ÇİFTÇİ Vekili','Av. Fatih NAKIŞLI']:
        assert exp in lines,(exp,lines)
    assert not any('…' in l for l in lines),lines
    # Kullanıcı düzenlemesi korunur ve şablon değişince sıfırlanır.
    page.locator('#requests').fill('Mazeretimizin kabulüne,\nDuruşmanın ertelenmesine,')
    page.wait_for_timeout(300)
    assert page.locator('#paper [data-role="result-item"]').count()==2
    page.locator('#tpl').select_option('tedbir');page.wait_for_timeout(300)
    assert 'HMK m. 394' in page.locator('#body').input_value()
    td=tmp/'sablon.docx';save_download(page,'#downloadDocx',td)
    assert any('ihtiyati tedbir kararının kaldırılmasına' in p.text for p in Document(str(td)).paragraphs)
    # Bütün şablonlar önizleme üretir; şablon önizlemesinde de paragraf düzenleyici çalışır.
    ids=page.evaluate("()=>[...document.getElementById('tpl').options].map(o=>o.value)")
    assert len(ids)==8,ids
    for tid in ids:
        page.locator('#tpl').select_option(tid);page.wait_for_timeout(250)
        assert page.locator('#paper [data-role="court-heading"]').count()==1,tid
        assert page.locator('#paper [data-role="result-item"]').count()>=1,tid
        assert page.locator('#paper [data-role="result-closing"]').count()==1,tid
    page.locator('#paper .paragraph[data-role="result-closing"]').click()
    page.locator('.edit-sheet .segmented .chip',has_text='Sağa').click()
    assert page.locator('#paper .paragraph.edited').evaluate("p=>p.style.textAlign")=='right'
    page.keyboard.press('Escape')
    assert not errors,errors
    print('PASS şablon sayfası: 8 şablon, mazeret ve tedbir itirazı → UDF/DOCX, boş alan kalmadı, düzenleme korunuyor, paragraf düzenleyici çalışıyor')
    ctx.close()
    # --- Başlangıç sayfası ve PWA dosyaları.
    import json as _j
    m=_j.loads((ROOT/'app.webmanifest').read_text(encoding='utf-8'));assert m['start_url']=='workspace.html'
    swsrc=(ROOT/'sw.js').read_text(encoding='utf-8')
    for f in re.findall(r"'([\w.-]+\.(?:js|html|css|png|webmanifest))'",swsrc):assert (ROOT/f).exists(),f
    for html in ['workspace.html','templates.html']:
        for src in page_scripts(html):assert src in swsrc,(html,src)
    print('PASS çevrimdışı web uygulaması: manifest ve önbellek listesi bütün dosyaları kapsıyor')

WORD_HTML="""<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><style>p.MsoNormal{margin:0}</style></head><body lang=TR><!--StartFragment-->
<p class=MsoNormal align=center style='text-align:center'><b><span style='font-size:12.0pt'>ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE<o:p></o:p></span></b></p>
<p class=MsoNormal><b><u>DOSYA NO</u></b><span style='mso-tab-count:2'>                    </span><b><u>:</u></b> 2026/1929 Esas</p>
<p class=MsoNormal><b><u>DAVALI</u></b><span style='mso-tab-count:2'>       </span><b><u>:</u></b> İsa ÇİFTÇİ</p>
<p class=MsoNormal><b><u>VEKİLİ</u></b><span style='mso-tab-count:2'> </span><b><u>:</u></b> Av. Fatih NAKIŞLI</p>
<p class=MsoNormal><b><u>DAVACI</u></b><span style='mso-tab-count:2'> </span><b><u>:</u></b> Yapı ve Kredi Bankası Anonim Şirketi</p>
<p class=MsoNormal><b><u>KONU</u></b><span style='mso-tab-count:2'> </span><b><u>:</u></b> Duruşmaya ilişkin mazeretimizin sunulmasıdır.</p>
<p class=MsoNormal><b><u>AÇIKLAMALAR</u></b><span style='mso-tab-count:1'> </span><b><u>:</u></b></p>
<p class=MsoNormal style='text-align:justify;text-indent:35.4pt'>Mahkemenizin dosyasının 20.10.2026 tarihli duruşmasına <b>ivedi</b> bir mazeretimiz nedeniyle katılamayacağız.</p>
<p class=MsoNormal><b><u>SONUÇ VE İSTEM</u></b><span style='mso-tab-count:1'> </span><b><u>:</u></b> Yukarıda arz edilen sebeplerle;</p>
<p class=MsoListParagraphCxSpFirst style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;&nbsp;</span></span><![endif]>Mazeretimizin kabulüne,</p>
<p class=MsoListParagraphCxSpLast style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;</span></span><![endif]>Duruşmanın ertelenmesine,</p>
<p class=MsoNormal>Karar verilmesini saygıyla talep ederiz. 14.10.2026</p>
<p class=MsoNormal align=right style='text-align:right'><b>Davalı İsa Çiftçi Vekili</b></p>
<p class=MsoNormal align=right style='text-align:right'><b>Av. Fatih NAKIŞLI</b></p><img src="x.png">
<!--EndFragment--></body></html>"""
GDOCS_HTML='<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1f2e"><p dir="ltr" style="text-align: center;"><span style="font-weight:700;">ANKARA 3. İŞ MAHKEMESİ\'NE</span></p><p dir="ltr"><span style="font-weight:700;text-decoration:underline;">DAVACI</span><span style="font-weight:400;">: Ali VELİ</span></p><p dir="ltr"><span style="font-weight:400;">Davacı ücret alacağı için </span><span style="font-weight:400;font-style:italic;">ayrıca</span><span style="font-weight:400;"> başvurmuştur.</span></p><p dir="ltr"><span>Yukarıda açıklanan nedenlerle davanın kabulüne karar verilmesini talep ederim.</span></p></b>'
PDF_TEXT="\n".join(['ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ\'NE','DOSYA NO : 2026/1929 Esas','DAVALI : İsa ÇİFTÇİ','AÇIKLAMALAR :',
  'Mahkemenizin yukarıda esas numarası belirtilen dosyasının 14.10.2026 tarihli','duruşmasına, şehir dışında bulunmamız ve önceden planlanmış diğer mesleki iş ve','işlemlerimiz nedeniyle katılım sağlayamayacağımızdan mesleki mazeretimizin','kabulünü talep etmekteyiz.','Sayfa 1 / 1',
  'SONUÇ VE İSTEM : Yukarıda arz edilen sebeplerle;','1. Mazeretimizin kabulüne,','Karar verilmesini saygıyla talep ederiz.'])

def paste_into(page,html,text):
    page.evaluate("""([html,text])=>{const dt=new DataTransfer();if(html)dt.setData('text/html',html);dt.setData('text/plain',text);
      document.getElementById('pasteBox').dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}""",[html,text])
    page.wait_for_timeout(250)

def v16_paste(browser,tmp):
    import datetime,zoneinfo
    today=datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Istanbul')).strftime('%d.%m.%Y')
    ctx=browser.new_context(accept_downloads=True,viewport={'width':1400,'height':1000})
    page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    load_page(page,'workspace.html')
    # 1) Word'den biçimli kopya: sekme, liste numarası, kalın, hizalama, görsel.
    paste_into(page,WORD_HTML,'DOSYA NO\t: 2026/1929 Esas')
    assert 'Microsoft Word' in page.locator('#pasteSource').text_content()
    notes=' '.join(page.locator('#pasteNotes li').all_text_contents());assert 'görsel aktarılmadı' in notes,notes
    assert page.locator('#pasteBox').input_value().startswith('DOSYA NO')
    out=tmp/'word-paste.udf';save_download(page,'#download',out)
    root,lines=udf_lines(out)
    for e in ["ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE",'DOSYA NO\t: 2026/1929 Esas','DAVALI\t: İsa ÇİFTÇİ','VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)',
              'KONU\t: Duruşmaya ilişkin mazeretimizin sunulmasıdır.','AÇIKLAMALAR\t:','1.\tMazeretimizin kabulüne,','2.\tDuruşmanın ertelenmesine,',f'Karar verilmesini saygıyla talep ederiz. {today}','Davalı İsa Çiftçi Vekili','Av. Fatih NAKIŞLI']:
        assert e in lines,(e,lines)
    txt=udf_text(root)
    ivedi=[c for c in root.iter('content') if c.get('startOffset') is not None and txt[int(c.get('startOffset')):int(c.get('startOffset'))+int(c.get('length'))]=='ivedi']
    assert ivedi and ivedi[0].get('bold')=='true','kalın sözcük korunur'
    assert page.locator('#partList li.missing').count()==0,page.locator('#partList li').all_text_contents()
    print('PASS yapıştır (Word): kaynak tanındı, sekme/numara/kalın korundu, görsel bildirildi, UDF standart')
    # 2) Google Dokümanlar: dış <b style=font-weight:normal> sarmalayıcısı kalın sayılmaz.
    paste_into(page,GDOCS_HTML,'x')
    assert 'Google' in page.locator('#pasteSource').text_content()
    body=page.locator('#paper .paragraph',has_text='ücret alacağı')
    assert body.locator('span',has_text='ayrıca').evaluate("s=>getComputedStyle(s).fontStyle")=='italic'
    assert body.locator('span',has_text='Davacı').evaluate("s=>getComputedStyle(s).fontWeight") in ('400','normal')
    assert page.locator('#paper [data-role="major-heading"]',has_text='AÇIKLAMALAR').count()==1,'eksik AÇIKLAMALAR eklendi'
    assert page.locator('#paper [data-role="result-heading"]').count()==1,'eksik SONUÇ VE İSTEM eklendi'
    print('PASS yapıştır (Google Dokümanlar): biçim doğru okundu, eksik bölüm başlıkları eklendi')
    # 3) PDF'den kopya: kırık satırlar birleşir.
    paste_into(page,'',PDF_TEXT)
    assert 'PDF' in page.locator('#pasteSource').text_content()
    assert page.locator('#paper .paragraph',has_text='14.10.2026 tarihli duruşmasına, şehir dışında').count()==1
    assert page.locator('#paper .paragraph',has_text='Sayfa 1').count()==0
    print('PASS yapıştır (PDF): satırlar birleşti, sayfa numarası atıldı')
    # 4) Yapay zekâ / Markdown yanıtı.
    paste_into(page,'','## MAZERET DİLEKÇESİ\n**ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ\'NE**\n**DAVALI:** İsa ÇİFTÇİ\n**KONU:** Mazeret.\n\nDuruşmaya katılamayacağız.\n\nYukarıda açıklanan nedenlerle mazeretimizin kabulüne karar verilmesini talep ederim.')
    assert 'Yapay zekâ' in page.locator('#pasteSource').text_content()
    assert '**' not in page.locator('#paper').inner_text()
    assert page.locator('#paper [data-role="court-heading"]').count()==1
    print('PASS yapıştır (yapay zekâ/Markdown): işaretler temizlendi, dilekçe kuruldu')
    # 5) Dağınık düz metin + eksikleri formdan tamamla.
    paste_into(page,'','Şanlıurfa 8. Asliye Hukuk Mahkemesine\n\nDuruşmaya şehir dışında olmamız nedeniyle katılamayacağız.\nYukarıda açıklanan nedenlerle mazeretimizin kabulüne karar verilmesini saygıyla talep ederiz.')
    assert page.locator('#completePanel').is_visible()
    assert page.locator('.cf[data-part="court"]').is_hidden(),'küçük harfli mahkeme satırı kendiliğinden düzeltildi'
    assert page.locator('.cf[data-part="caseNo"]').is_visible() and page.locator('.cf[data-part="topic"]').is_visible()
    page.locator('#pc_caseNo').fill('2026/1929');page.locator('#pc_caseNo').dispatch_event('change')
    page.locator('#pc_client').fill('İsa ÇİFTÇİ');page.locator('#pc_client').dispatch_event('change')
    page.locator('#pc_other').fill('Yapı ve Kredi Bankası Anonim Şirketi');page.locator('#pc_other').dispatch_event('change')
    page.locator('#pc_topic').fill('Duruşmaya ilişkin mazeretimizin sunulmasıdır.');page.locator('#pc_topic').dispatch_event('change')
    page.wait_for_timeout(200)
    out=tmp/'plain-paste.udf';save_download(page,'#download',out)
    _,lines=udf_lines(out)
    for e in ['ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİNE','DOSYA NO\t: 2026/1929 Esas','DAVALI\t: İsa ÇİFTÇİ','VEKİLİ\t: Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)','DAVACI\t: Yapı ve Kredi Bankası Anonim Şirketi',
              'KONU\t: Duruşmaya ilişkin mazeretimizin sunulmasıdır.','AÇIKLAMALAR\t:','SONUÇ VE İSTEM\t: Yukarıda arz edilen sebeplerle;','1.\tMazeretimizin kabulüne,',f'Karar verilmesini saygıyla talep ederiz. {today}','Davalı İsa ÇİFTÇİ Vekili','Av. Fatih NAKIŞLI']:
        assert e in lines,(e,lines)
    assert page.locator('#partList li.added').count()>=6,page.locator('#partList li').all_text_contents()
    # Paragraf düzenleyici yapıştırılan dilekçede de çalışır.
    page.locator('#paper .paragraph[data-role="explanation-body"]').first.click()
    page.locator('.edit-sheet .chip',has_text='Kalın').click();page.keyboard.press('Escape')
    assert page.locator('#paper .paragraph.edited').count()==1
    rp=tmp/'paste-rapor.txt';save_download(page,'#reportDownload',rp);rt=rp.read_text(encoding='utf-8')
    assert 'yapıştırılan metin (Düz metin)' in rt and 'Dilekçeye eklenen parçalar' in rt,rt[:400]
    # Kutudaki metni elle düzenleyip yeniden oluşturma.
    page.locator('#pasteBox').fill('DAVALI: Ali VELİ\nKısa açıklama.\nKabulüne karar verilmesini talep ederim.')
    page.locator('#pasteBuild').click();page.wait_for_timeout(200)
    assert 'Düz metin' in page.locator('#pasteSource').text_content() and page.locator('#paper .paragraph',has_text='Ali VELİ').count()==1
    assert not errors,errors
    print('PASS yapıştır (dağınık metin): eksikler formdan tamamlandı, dilekçe baştan kuruldu, düzenleyici ve rapor çalışıyor')
    ctx.close()

if __name__=='__main__':main()
