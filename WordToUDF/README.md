# Word ↔ UDF / PDF — WordToUDF 1.11.0

**Sürüm:** 1.11.0 · **Çalışma biçimi:** Chrome uzantısı (Manifest V3) ve çevrimdışı web uygulaması (PWA) · sunucusuz · Chrome izni yok · internete bağlanmaz

Hukuk dilekçelerini UYAP Doküman Editörü'nün UDF biçimine çeviren, gönderimden önce denetleyen ve UDF'yi Word/PDF'ye geri çeviren araç. Bütün işlemler cihazda yapılır; dosyalar hiçbir sunucuya gönderilmez.

Sürüm geçmişi: [CHANGELOG.md](CHANGELOG.md) · UYAP kabul kontrol listesi: [KABUL_TESTLERI.md](KABUL_TESTLERI.md) · Güvenlik: [SECURITY.md](SECURITY.md) · Mimari: [ARCHITECTURE.md](ARCHITECTURE.md)

## Neler yapar

| Bölüm | Ne işe yarar |
|---|---|
| **Dönüştür** (`workspace.html`) | DOCX seçin ya da dilekçe metnini yapıştırın → hukuk dilekçesi standardına göre dizilir, denetlenir, önizlemede paragraf paragraf düzenlenir, UDF (ve istenirse düzenlenmiş Word) olarak indirilir. Birden çok DOCX seçilirse toplu dönüşüm (tek ZIP). |
| **Şablonlar** (`templates.html`) | 14 hazır dilekçe (mazeret, ek süre, ihtiyati tedbire ve bilirkişi raporuna itiraz, e-Duruşma, tanık listesi, vekaletname, genel beyan, ıslah, cevaba cevap / ikinci cevap, keşif, ihtiyati haciz, feragat, gider avansı / harç iadesi) ve kendi şablonlarınız birkaç alanla oluşturulur; şablonlar kategorili, aranabilir kart galerisindedir. |
| **Süre hesapla** (`sure.html`) | Tebliğ tarihinden son günü hesaplar: hafta sonu, resmî ve dini bayramlar, arife ve adli tatil dahil; isteğe bağlı e-Tebligat (+5 gün, Tebligat K. m. 7/a); adım adım açıklama, kalan gün göstergesi, ay takvimi ve takvime ekleme (.ics). Yardımcı hesaptır. |
| **UDF → Word / PDF** (`reverse.html`) | UDF salt okunur açılır; Word (.docx) indirilir veya Chrome yazdırma penceresiyle PDF olarak kaydedilir. |

**Öne çıkanlar**

- **Metni yapıştır:** Word gerekmez. Kaynak (Word, Google Dokümanlar, LibreOffice, UYAP editörü, PDF, yapay zekâ/Markdown, web, WhatsApp, e-posta) tanınır, kaynağın bozduğu biçim onarılır, eksik parçalar yalnız sizin verdiğiniz bilgilerle eklenir; **hiçbir bilgi uydurulmaz**.
- **Dilekçe denetimi:** mahkeme başlığı, DOSYA NO, UETS, imza–künye uyumu, KONU/SONUÇ, geçersiz veya geçmiş tarih, sözcük kaybı… Belgeyi değiştirmez; hatalar önce listelenir ve rapora yazılır.
- **Paragraf düzenleyici:** önizlemede paragrafa dokunun → tür, hizalama, yazı, girinti, aralık, metin; altına yeni paragraf ekle, yukarı/aşağı taşı, boş satır, sayfa sonu, birleştir, sil. Çoklu seçim, geri al (Ctrl+Z) ve yinele (Ctrl+Y); numaralar kendiliğinden düzelir.
- **Kelime ve cümle biçimi:** önizlemede bir sözcüğü ya da cümleyi seçin → kalın, italik, altı / üstü çizili, düz; Ctrl+B / I / U; “Cümle” ile cümlenin tamamı, “Tüm belgede” ile her geçişi. Telefonda paneldeki cümle düğmeleriyle.
- **Dosya kartları ve kendi şablonlarınız:** mahkeme, esas no ve tarafları bir kez kaydedin, şablon ve yapıştırma formunu tek seçimle doldurun. Herhangi bir dilekçeyi {MÜVEKKİL}, {ESAS NO}, {ALACAK TUTARI} gibi alanlı şablon olarak kaydedin.
- **Bul / değiştir ve öneriler:** Ctrl+F ile belgede arayın (Türkçe harf duyarlı), hepsini değiştirin ya da kalın / italik yapın. Fazla boşluk, noktalama ve tarih biçimi gibi hatalar “Öneri” olarak listelenir, tek tıkla düzelir.
- **PDF ve sayfa görünümü:** dilekçeyi doğrudan PDF olarak kaydedin; önizlemede yaklaşık sayfa sonları, sayfa sayısı ve imzanın son sayfada yalnız kalması uyarısı. “Değişiklikleri göster” aracın eklediği / değiştirdiği sözcükleri sarıyla işaretler.
- **Dosya adı kalıbı:** {TARİH} {MÜVEKKİL} {ESAS} {TÜR} {KAYNAK} ile indirilen dosyaların adını belirleyin.
- **Vekil profili:** VEKİLİ satırı ayarlardaki vekilden yazılır (varsayılan `Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)`). “Başka vekil var” kutucuğuyla ek vekil ve UETS; UETS boş bırakılırsa numara yazılmaz.
- **Arayüz (1.11):** lacivert / altın tasarım; açık / koyu / otomatik tema (üst çubuktaki düğme); Kaynak → Denetim → Önizleme → İndir adım çizelgesi; denetim halkası ve geri alınabilir otomatik düzeltmeler; **Ctrl+K** ile komut arama; telefonda alt sekme çubuğu, alt işlem çubuğu ve alttan açılan düzenleme paneli. Ayar veya panel değiştirince sayfa yerinden oynamaz.
- **Önizleme (1.11):** telefonda “Sığdır” metin sütununu ekran genişliğine sığdırır (boş kenarlar kesilir, satır sonları değişmez); **Tam ekran** düğmesi (telefonda alttaki “Önizleme”) sayfayı tek başına açar, − / + ve iki parmakla yakınlaştırılır, düzenleme tam ekranda da çalışır. UDF → Word / PDF sayfasında da aynı araçlar vardır. Önizleme yazı tipi Times New Roman'dır; cihazda yoksa aynı harf genişliklerindeki Tinos kullanılır (pakette gelir), böylece satır sonları telefonda da Word / UYAP'a yakındır.

## Kurulum (Chrome uzantısı)

1. `WordToUDF-1.11.0.zip` paketini **klasörün tamamını koruyarak** çıkarın.
2. Masaüstü Chrome adres çubuğuna `chrome://extensions` yazın.
3. **Geliştirici modu**nu açın → **Paketlenmemiş öğe yükle**yi seçin.
4. ZIP'ten çıkan `WordToUDF-1.11.0` klasörünü seçin (içinde `manifest.json` bulunan klasör).
5. Araç çubuğundaki **Word ↔ UDF** simgesine tıklayın → bölümü seçin.

**Güncelleme (verileriniz kaybolmasın):** yeni ZIP'in içindeki dosyaları **ilk kurduğunuz klasörün üzerine** kopyalayın ve `chrome://extensions` sayfasında uzantı kartındaki **Yeniden yükle**'ye basın; ayarlar, dosya kartları ve kendi şablonlarınız aynen kalır. Chrome, paketlenmemiş uzantıyı klasör yolundan tanır: uzantıyı **kaldırırsanız** ya da **başka bir klasörden** yüklerseniz yeni bir uzantı sayılır ve bu veriler boş başlar. Böyle bir durumdan önce Word → UDF sayfasında **Ayarlar → Dışa aktar** ile yedek alın, yeni kurulumda **İçe aktar** ile geri yükleyin (yedek, dosya kartlarını ve şablonları da içerir).

Kurumsal Chrome politikaları paketlenmemiş eklenti yüklemeyi engelliyorsa eklenti yönetici izni olmadan yüklenemeyebilir.

**Telefonda (web uygulaması):** klasör bir web sunucusunda (ör. GitHub Pages) yayınlanırsa `index.html` tanıtım ve giriş sayfasıdır; tarayıcı menüsünden “Ana ekrana ekle” ile eklenen uygulama doğrudan Word → UDF sayfasını açar ve `sw.js` sayesinde çevrimdışı çalışır. Dosyalar yine cihazdan çıkmaz.

## Kullanım

**Word → UDF**
1. **Kaynak:** DOCX'i bırakın/seçin ya da “Metni yapıştır” sekmesine dilekçeyi yapıştırın (sayfada herhangi bir yere yapıştırmak da olur). Yapıştırılan metinde eksik parça varsa “Dilekçenin parçaları” kartı yalnız eksikleri sorar.
2. **Denetim:** hata ve uyarıları okuyun. “Maddelere ayır” gibi öneriler tek dokunuşla uygulanır.
3. **Önizleme:** gerekirse paragrafa dokunup düzeltin (rahat görmek için **Tam ekran**); bir sözcüğü/cümleyi seçip biçimleyin; yeni paragraf ekleyin veya taşıyın. Dönüşüm raporu, hukuk profilinin yaptığı her metin değişikliğini ve elle düzenlemeleri listeler.
4. **İndir:** UDF, Word (DOCX), PDF (yazdırma penceresi → “PDF olarak kaydet”) veya rapor. İçerik kaybı olabilecek bir öğe varsa (görsel, dipnot, yorum…) “inceledim” kutusunu işaretleyin → **UDF oluştur ve indir**. Yalnız görünümle ilgili bildirimler (karakter aralığı, A4 dışı kâğıt) “Bilgi” olarak listelenir, onay istemez. İsterseniz Word (DOCX) ve rapor da indirilir.

Tipografi profili **Hukuk dilekçesi** (önerilen) aşağıdaki standardı uygular; **Word biçimini koru** profili belgenin kendi düzenine dokunmaz. AÇIKLAMALAR başlığı farklı adlandırılmışsa başlangıç/bitiş “Gelişmiş” kartından elle seçilir. Ayarlar JSON dosyasıyla başka cihaza taşınabilir.

**Şablonlar:** şablonu seçin, mahkeme/esas no/taraflar ve şablon alanlarını doldurun; metin, talepler, kapanış ve ekler düzenlenebilir. Boş alan `…` olarak kalır. Çıktı Word'den gelenlerle aynı kurallardan ve denetimden geçer.

**Süre hesapla:** tebliğ tarihini girin, süreyi seçin (hızlı düğmeler ya da listeden; kendi sürenizi de yazabilirsiniz); tebligat e-Tebligat ile geldiyse **e-Tebligat** anahtarını açın (ulaştığı günü izleyen 5. günün sonunda tebliğ sayılır); adli tatile tabi olup olmadığını ve Cumartesi'nin tatil sayılıp sayılmayacağını işaretleyin. Son gün, adımlarıyla birlikte gösterilir; “Takvime ekle” iki gün önceden hatırlatmalı takvim kaydı indirir. Dini bayramlar 2025–2027 için tanımlıdır; hesap yardımcıdır, kanun metni ve tebliğ kaydıyla kontrol edin.

**UDF → Word / PDF:** UDF'yi seçin; Word düğmesi `.docx` indirir, PDF düğmesi yazdırma penceresini açar — hedefi **PDF olarak kaydet** seçin.

## Hukuk dilekçesi standardı (hukuk profili)

- **Sayfa ve yazı:** A4, dört kenar 1,5 cm; bütün metin Times New Roman 12 pt. Mahkeme başlığı ortalı, kalın, 14 pt, altı çizilmez (kesme işaretli `…MAHKEMESİ'NE` dahil).
- **Künye ve bölüm etiketleri:** `ETİKET ⇥ : değer` tek paragraftır; bütün iki noktalar 6,0 cm'deki tek gerçek sekme durağında hizalanır (boşlukla hizalama yok). Etiket, sekme ve iki nokta kalın ve **kesintisiz** altı çizili; iki noktadan sonra tek boşluk, değer normal yazılır ve uzun değer girintisiz sarılır.
- **DOSYA NO** tek satırdır (`2026/713 E. 2026/708 K.`); kaynaktaki nitelendirme korunur, E./K. uydurulmaz. Uzun sıfatlar kısaltılır (İHTİYATİ HACZE İTİRAZ EDEN → İTİRAZ EDEN, TEBLİGAT ADRESİ → ADRESİ…); hukuki sıfatlar değiştirilmez. Kişi adlarında soyadı büyük harfe çevrilir, kurum unvanlarına dokunulmaz.
- **VEKİLİ:** `Av. Ad SOYAD (UETS: numara)`. Numara yalnız kaynakta veya ayarlarda kayıtlıysa yazılır; bilinmeyen numara uydurulmaz. Vekilin ayrı adres/UETS satırları VEKİLİ satırına taşınır.
- **Bölümler:** KONU, HUKUKİ SEBEPLER, HUKUKİ DELİLLER değerleri başlık satırında başlar; AÇIKLAMALAR satırının karşısı boştur.
- **AÇIKLAMALAR gövdesi:** 1,25 cm ilk satır girintisi, iki yana yaslı, 1,5 satır (1,0 seçilebilir), önce/sonra 0,15 cm. Ara başlıklara gövde girintisi uygulanmaz. Kanun atıfları italik, karar künyeleri kalın-italik.
- **SONUÇ VE İSTEM:** `Yukarıda arz edilen sebeplerle;` ardından numaralı talepler. Varsayılan numara **metin numarası + sekme** (`1.` ⇥ metin, 18 pt asılı girinti) — numara ilk sözcüğün üstüne binmez; istenirse UDF otomatik listesi seçilir. Tek maddeye yazılmış birden çok talep önerilir, onayla maddelere ayrılır.
- **Kapanış:** tek kapanış cümlesi, sonunda oluşturulduğu günün tarihi (Türkiye saati, GG.AA.YYYY). Kapanış son talebin içindeyse ayrılır, ikinci kapanış eklenmez; hiç yoksa `Karar verilmesini vekâleten talep ederim.` eklenir.
- **EKLER:** yalnız kaynakta varsa; ayrı numaralı liste.

## Sınırlar

- **UYAP'ta son kontrol sizdedir.** Üretilen UDF'nin UYAP Doküman Editörü'nde açılışı ve görünümü bu ortamda test edilemez; yapısal XML/ZIP/ofset doğrulaması ve tarayıcı testleri bunu garanti etmez. İlk belgeleri [KABUL_TESTLERI.md](KABUL_TESTLERI.md) listesine göre kontrol edin. Önizleme yaklaşık yerleşimdir; sayfa kırılımı birebir garanti edilmez.
- **Word → UDF:** girdi yalnız `.docx`, en fazla 24 MB. Karmaşık listeler, görseller, yorumlar, izlenen değişiklikler, gömülü nesneler, denklemler ve alan kodları birebir aktarılmayabilir; kayıplar raporda gösterilir ve incelenmeden indirme açılmaz. Basit tablolar satır satır, hücreleri sekmeyle ayrılmış metin olarak aktarılır. Üstbilgi/altbilgi bilinçli olarak dışarıda bırakılır. UDF imzasız üretilir; program kendiliğinden “e-imzalıdır” ibaresi eklemez.
- **Metni yapıştır:** araç çevrimdışı çalışır ve metin cihazdan çıkmaz; bu yüzden serbest anlatılmış bir olaydan hukuki metni kendisi *yazmaz*. Metindeki yapıyı tanır, eksik çerçeveyi sizin verdiğiniz bilgilerle tamamlar ve standarda göre dizer.
- **UDF → Word / PDF:** UDF salt okunur açılır, kaynak dosya değiştirilmez ve Word → UDF kuralları bu yönde uygulanmaz. Metin, yazı tipi, punto, kalın/italik/alt çizgi, renk, hizalama, girinti, aralık, sekme durakları, numaralı/madde işaretli listeler, basit tablolar, sayfa sonları ve üstbilgi/altbilgi aktarılır. Birebir karşılığı olmayan biçimler yalnız uyarı üretir, dışa aktarmayı durdurmaz. Kriptografik e-imza geçerliliği aktarılmaz. Yalnız UDF 1.8 desteklenir.
- **Tarayıcı:** Chrome 103 veya sonrası (`CompressionStream('deflate-raw')` gerekir).

## Güvenlik ve veri işleme

Manifest V3; `permissions` ve `host_permissions` boştur, ağ bağlantısı kapalıdır (`connect-src 'none'`), dış betik/CDN/`eval` yoktur; yazı tipleri de pakettedir, internetten yüklenmez. Belgeler yalnız bellekte işlenir; DOCX/UDF dosyaları saklanmaz. Bu tarayıcının yerel depolamasında yalnız şunlar durur ve hiçbir yere gönderilmez: vekil/UETS ayarları ve tema seçimi; kaydettiğiniz **dosya kartları** (mahkeme, esas no, taraf ve müvekkil adları); **kendi şablonlarınız**; Şablonlar sayfasının **son taslağı**. Kartlar, şablonlar ve taslak Word → UDF sayfasındaki “Dosya kartları ve şablonlar” kartından tek düğmeyle silinir; ortak kullanılan bir bilgisayarda işiniz bitince silmeniz önerilir. ZIP yolu, boyut, CRC32, XML sözdizimi ve DTD/ENTITY kontrolleri uygulanır; kullanıcı metni sayfaya yalnız `textContent`/`value` ile yazılır. Ayrıntılar: [SECURITY.md](SECURITY.md).

Bu eklenti LexUDF'den bağımsızdır; LexUDF'yi değiştirmez, onun ayarlarını veya depolama alanını kullanmaz. Açık kaynak örneklerden ve LexUDF'nin UDF çıktılarından yalnız biçim uyumluluğu konusunda yararlanılmıştır.

## Geliştirme

```sh
npm test                # mantık + altın çıktı testleri (Node)
npm run test:e2e        # Chromium testleri (Python playwright)
npm run test:fuzz       # tohumlu zorlama testi
npm run build           # dist/WordToUDF-<sürüm>.zip + SHA-256
python3 tools/pages.py  # beş HTML sayfasını ortak başlık ve simge setinden yeniden üretir
```

Sayfa gövdeleri `tools/pages/*.body.html` içindedir; `workspace.html`, `templates.html`, `reverse.html`, `sure.html` ve `index.html` elle düzenlenmez, `tools/pages.py` ile üretilir. Paket (`npm run build`) yalnız izin listesindeki dosyaları alır (`sw.js` dosya listesi, açılır pencere, manifest, belgeler); klasöre bırakılmış başka bir dosya pakete girmez. Test katmanları için [tests/README.md](tests/README.md), modül düzeni için [ARCHITECTURE.md](ARCHITECTURE.md).
