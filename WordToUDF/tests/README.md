# Tekrarlanabilir kalite denetimi

Kaynak kökünde:

```sh
node tests/logic.test.js
node tests/golden.test.js          # --update: bilinçli kural değişikliğinden sonra
python tests/e2e.py          # CHROMIUM=/yol/chrome ile tarayıcı yolu verilebilir
python tests/fuzz.py 600 [tohum]   # rastgele girdilerle zorlama testi
```

`logic.test.js`: 102 test (v1.10.0: Türkçe sayı okunuşu ve tutar düzeltmesi, süre hesabı ve .ics, dosya adı kalıbı ve vurgu; v1.9.0: düzeltme önerileri ve kuralları, dosya kartı, kendi şablonu; v1.8.0 testleri: cümle bölme, biçimin konumu ve kaybı, metin düzeltmede biçim koruma, Türkçe arama ve bul-değiştir, yeni paragraf ve taşıma; v1.6.1 denetim testi: künye yerleşimi, kapanışsız liste, madde işaretli düz metin; v1.6.0'ın 4 yapıştırma testi: kaynak tanıma, PDF onarımı, Markdown/WhatsApp/e-posta temizliği, dağınık metinden dilekçe kurma; v1.5.0'ın 9 testi: ayarlar, talep ayırma, paragraf düzenleyici (tür/yazı, numara kayması, metin/birleştirme/boş satır), denetim, şablonlar, kesme işaretli mahkeme başlığı, kural dosyası; v1.4.1'in 5 düzeltme testi; v1.3.2'nin 23 regresyonu, 7'si yeni standarda göre bilinçli olarak revize edildi ve adında REVİZE yazar; 49 WTU kural testi).

`e2e.py`: Chromium içinde DOCX→UDF (hukuk ve Word biçimini koru profilleri), Dumanbey tipi tam dilekçe (ortak sekme, tek DOSYA NO, UETS, satır içi bölümler, gerçek listeler, tarih, imza, önizlemede iki nokta x-konumu eşitliği), UDF→DOCX geri dönüşte gerçek Word listeleri, ZIP/DTD/CRC saldırı reddi ve 1.500 paragraflık belge.

`e2e.py` için Python `playwright`, `python-docx`, `lxml` ve erişilebilir Chromium gerekir. Tarayıcı güvenlik politikası nedeniyle bu ortamdaki Chromium URL gezinmelerini engellediğinden test sayfaları `set_content` ile yüklenip kaynak JS dosyaları aynı sırayla çalıştırılır. Bu yöntem iş mantığı, dönüştürme/indirme ve zip/xml testini yapar; MV3 uzantısının gerçekten yüklenmesini veya UYAP Doküman Editörü kabulünü doğrulamaz. Test, sayfa CSP meta etiketini yalnız test çalışma ortamında kaldırır; dağıtımda CSP korunur.

Örnek Word/PDF uyumsuzlukları ve görsel tablo kaybı farklı test kapsamıdır.

`golden.test.js`: `fixtures/` içindeki 5 isimleri değiştirilmiş dilekçe (mazeret, maddeli mazeret, ihtiyati hacze itiraz, cevap, istinaf) satır satır beklenen çıktıyla karşılaştırılır.

`e2e.py` (1.5.0 ek): 390 px telefon görünümü ve karanlık mod, paragraf düzenleyici (sil + numara kayması, geri al, çoklu seçim, metin), düzenlenmiş DOCX, ayar dışa/içe aktarma, toplu dönüşüm (hatalı dosya dahil), 8 şablonun tamamı, PWA önbellek listesi.

`e2e.py` (1.6.0 ek): gerçek pano olayıyla yapıştırma — Word HTML'i (sekme, liste numarası, kalın, görsel), Google Dokümanlar HTML'i, PDF metni, yapay zekâ/Markdown, eksikleri formdan tamamlanan dağınık metin.

`e2e.py` (1.6.1 ek): sayfalar gerçek HTTP sunucusundan **CSP açık** yüklenir; yapıştırma, düzenleyici, indirme ve şablon akışında güvenlik kuralı ihlali veya konsol hatası testi başarısız sayar (diğer e2e adımları CSP'yi kaldırarak çalışır).

`fuzz.py`: tohumlu (tekrarlanabilir) zorlama testi. Rastgele dilekçeler (tuhaf karakterler, dev paragraflar, `]]>`, kontrol karakterleri), rastgele elle düzenlemeler, bozuk/iç içe yapıştırılmış HTML ve bütün şablonlar boş/tuhaf alanlarla tam hattan (UDF yazma + XML doğrulama + ZIP) geçirilir; liste numaralarının ardışıklığı da denetlenir.

`e2e.py` (1.7.0 ek): kaydırma sıçraması testi — telefon ve masaüstünde tipografi profili, talepleri ayırma, liste ve satır aralığı değişince kontrolün ekrandaki yeri ±4 px içinde kalır; düzenleme panelinde bir seçenek seçilince panelin kaydırma konumu ve odak korunur.

`e2e.py` (1.8.0 ek): `v18_marks` — önizlemede seçim → biçim çubuğu (kalın, Ctrl+I, cümleye genişlet, tüm belgede), geri al / yinele, paneldeki cümle düğmeleri ve biçim listesi, yeni talep ekleyip taşıma (UDF'de sıra ve numara), UDF'de biçim öznitelikleri ve raporda kayıt, telefonda alta sabit çubuk, Word büyük harf / küçük büyük harf / karakter aralığı (onay istemeden indirme).

`fuzz.py` (1.8.0 ek): rastgele biçimler (bulunmayan metin ve anlamsız ofset dahil), eklenen paragraflar, taşımalar ve belge geneli bul-değiştir / biçim kuralları.

`e2e.py` (1.9.0 ek): `v19_library` — öneri “Düzelt” düğmeleri, Ctrl+F bul / değiştir (sayı, vurgu, hepsi kalın, kural kaldırma ve geri alma), dosya kartı ve şablon kaydı, dışa aktarılan ayar dosyasında kütüphane, kayıtlı kartla yapıştırma formunu doldurma ve şablon sayfasında kendi şablonunu kullanma / kaydetme / silme. Test sayfaları `set_content` ile açıldığından yerel depolama yoktur; `load_page` bunun yerine bellekte bir depolama kurar ve `dump_storage` ile sonraki sayfaya taşır.

`e2e.py` (1.10.0 ek): `v110_tools` — sayfa hesabı (sentetik yüksekliklerle yalnız kalan imza), değişiklikleri göster, PDF (yazdırma yüzeyi, `@page`, sonrasında eski hâle dönüş), dosya adı kalıbının indirilen dosyaya uygulanması, deneysel vurgunun UDF `background` özniteliği ve deneme dosyası, süre sayfası (adli tatil, icra, ay sonu, .ics), cevaba cevap / ikinci cevap şablonu. CSP açık sayfa testi PDF düğmesini ve `sure.html`'i de dener.
