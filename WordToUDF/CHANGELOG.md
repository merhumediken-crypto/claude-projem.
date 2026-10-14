# Sürüm geçmişi

WordToUDF'nin bütün sürümleri, yeniden eskiye. Kullanım kılavuzu: [README.md](README.md).

## 1.8.0 — Kelime ve cümle biçimi, yeni paragraf, taşıma

### Kelime / cümle biçimlendirme
- **Önizlemede seçin, biçimleyin:** bir sözcüğü ya da cümleyi fareyle (telefonda parmakla) seçince küçük bir çubuk açılır: **K** (kalın), *İ* (italik), A (altı çizili), S (üstü çizili), **Düz** (biçimi kaldırır), **Cümle** (seçimi cümlenin tamamına genişletir), **Tüm belgede** (aynı metnin belgedeki her geçişine uygular). Masaüstünde çubuk seçimin üstünde, telefonda ekranın altında sabittir.
- **Klavye:** Ctrl+B / Ctrl+I / Ctrl+U önizlemedeki seçime ya da düzenleme panelinin metin kutusundaki seçime uygulanır.
- **Panelde cümleler:** paragrafın cümleleri düğme olarak listelenir; bir veya birkaç cümleye dokunup K / İ / A / S. Bu paragraftaki elle biçimler listelenir, her biri × ile kaldırılır.
- **Türkçe cümle bölme:** “HMK m. 127”, “2026/1929 E.”, “Av.”, “8. Asliye”, “3. HD”, “14.10.2026”, “T.C.”, “A. KAYA” cümleyi bölmez.
- **Güvenli saklama:** biçim, işaretlenen metnin kendisiyle saklanır ve her yeniden çizimde yeniden bulunur. Metin değişip işaretli sözcük kalmazsa biçim başka sözcüğe kaydırılmaz; denetimde “uygulanamadı” uyarısı çıkar.
- **Tüm belgede** aramada Türkçe büyük/küçük harf eşleşmesi (İ/i, I/ı) doğru yapılır. Paragrafa özgü biçim, belge geneli biçimden üstündür.
- **Metin düzeltme biçimi bozmuyor:** “Metni uygula” ile paragraf metnini değiştirince değiştirmediğiniz kısımların kalın/italik biçimi korunur (önceden hepsi sıfırlanıyordu). Yazılan yeni kısım, yerine geçtiği metnin biçimini alır.

### Paragraf ekleme ve taşıma
- **Altına yeni paragraf:** düzenleme panelinde “+ Altına yeni paragraf”. Tür varsayılan olarak üstteki gibidir (talep maddesinin altına yeni talep maddesi); gövde, düz paragraf, ara başlık, ek maddesi… seçilebilir. Eklenen paragraf yeşil çerçeveyle işaretlenir, diğerleri gibi düzenlenir, taşınır, silinir.
- **Yukarı / aşağı taşı:** paragraf (boş satırı ve sayfa sonuyla birlikte) bir sıra yukarı/aşağı taşınır; talep ve ek numaraları kendiliğinden yeniden verilir.
- **Yinele:** geri alınan düzenleme yeniden uygulanır (düğme ve Ctrl+Y / Ctrl+Shift+Z).

### Word karakter efektleri
- Word'deki **BÜYÜK HARF** (caps) biçimi gerçek büyük harfe çevrilir; **küçük büyük harf** (small caps) büyük harfe çevrilir.
- Karakter aralığı / genişlik, gölge, kabartma ve A4 dışı kâğıt bildirimleri artık “Bilgi” olarak listelenir ve indirmeden önce “inceledim” onayı istemez (metin kaybı yoktur). Örnek dilekçedeki “Özel Word karakter efektleri (7 bölüm)” uyarısı bu türdendi.

### Düzeltmeler
- Kısayollar (Ctrl+Z vb.) odak bir onay kutusundayken de çalışır; yalnız yazı alanlarında tarayıcının kendi geri alması kullanılır.
- Testler: 96 mantık testi (cümle bölme, biçim konumu ve kaybı, metin düzeltmede biçim koruma, Türkçe arama, yeni paragraf ve taşıma), yeni tarayıcı testi (`v18_marks`), zorlama testine rastgele biçim / ekleme / taşıma / belge geneli kurallar.

## 1.7.0 — Tasarım yenilemesi ve sürüm incelemesi

### Tasarım — profesyonel arayüz
- **Yeni tasarım sistemi** (`workspace.css` baştan yazıldı): renk, boşluk, köşe ve gölge belirteçleri; bütün düğme, form, kart, sekme, rozet ve liste biçimleri tek yerden.
- **Tema düğmesi:** Otomatik (cihaz) → Açık → Koyu. Seçim yalnız bu tarayıcıda saklanır (`theme.js`). Dilekçe kâğıdı her temada beyazdır.
- **Ortak üst çubuk:** marka, bölüm gezinmesi (bulunduğunuz sayfa işaretli), “Çevrimdışı” rozeti, tema düğmesi ve sürüm. Dört sayfa `tools/pages.py` ile aynı başlıktan ve aynı SVG simge setinden üretilir; sayfalar birbirinden kopamaz. Satır içi stil/betik yoktur, güvenlik kuralı (CSP) aynen korunur.
- **Dönüştür sayfası adım adım:** 1 Kaynak → 2 Denetim → 3 İndir. Adım numaraları görünen kartlara göre kendiliğinden verilir (denetim kartı henüz yokken 1 → 3 diye atlamaz).
- **Kaynak sekmeleri:** “Word dosyası | Metni yapıştır” (ok tuşlarıyla da geçilir). Sayfanın herhangi bir yerine yapıştırmak (yazı alanları hariç) metni doğrudan yapıştır sekmesine alır.
- **İndir kartı:** büyük birincil “UDF oluştur ve indir”, yanında Word (DOCX) ve Rapor.
- **Önizleme kartı:** başlık, araç çubuğu ve boş durum kartı; düzenleyici düğmeleri belge yüklenmeden görünmez. Yapıştırma alanı temizlenince boş durum kartı geri gelir.
- **Telefon:** altta sabit işlem çubuğu (Önizleme / UDF indir); düzenleme paneli alttan açılan, tutamaklı sayfa; gezinme etiketleri kısaltıldı (“UDF → Word”), artık kesik görünmüyor.
- **Açılır pencere** (araç çubuğu simgesi) ve **giriş sayfası** yeniden tasarlandı; giriş sayfasında “Bu sürümde” ve gizlilik özeti.
- **Erişilebilirlik:** belirgin klavye odak halkası, azaltılmış hareket tercihi, yüksek karşıtlık (forced-colors) desteği.

### Düzeltilen: menüden seçince sayfanın/panelin yukarı kaçması
- **Düzenleme paneli:** panelde aşağıdaki bir seçeneği (ör. satır aralığı, “Önüne boş satır”) seçince panel en başa dönüyor ve odak kayboluyordu. Neden: her değişiklikte panel yeniden kuruluyor, kaydırma konumu sıfırlanıyordu. Artık panelin kaydırma konumu ve odaktaki düğme korunuyor (ölçüm: 619 → 0 iken şimdi 750 → 750).
- **Ayarlar:** tipografi profili, talepleri ayırma, liste numarası, satır aralığı, vekil gibi bir ayar değişince üstteki rapor ve denetim listeleri yeniden kuruluyor, tarayıcı kaydırma çapasını kaybediyor ve değiştirdiğiniz kontrol ekranda 166–342 px kayıyordu. Artık değiştirilen kontrol ekranda aynı yerde kalır.
- Kalıcı test: `tests/e2e.py` → `v17_no_jump` (telefon ve masaüstü; düzeltme kaldırılınca testin başarısız olduğu doğrulandı).

### Sürüm incelemesi
- Bütün sürümler gözden geçirildi; README'ye dağılmış ve sırası karışmış sürüm notları bu dosyada yeniden eskiye toplandı. README artık yalnız kullanım kılavuzu.
- Eskimiş sürüm ibareleri düzeltildi: depo kökündeki README (v1.4.1 yazıyordu), `SECURITY.md` (1.6.0), mimari belgesi (1.4.0).
- README'nin andığı ama bulunmayan `KABUL_TESTLERI.md` eklendi: UDF'yi UYAP Doküman Editörü'nde açarak yapılacak kabul kontrol listesi.
- Özellik davranışı değişmedi: 91 mantık, 5 altın çıktı, 25 tarayıcı testi ve 600 rastgele girdili zorlama testi geçiyor.

## 1.6.1 — Baştan sona denetim düzeltmeleri

Bütün kaynak kod satır satır okundu; uç girdilerle zorlama testi, güvenlik kuralı (CSP) açık sayfa testi, erişilebilirlik ve tarayıcı uyumluluğu taraması yapıldı. Bulunan ve düzeltilenler:

- **Yapıştırırken güvenlik kuralı ihlalleri:** Word/Google içeriğindeki satır içi stiller sayfa CSP'sine takılıp onlarca hata kaydı üretiyordu (Chrome'un eklenti “Hatalar” sayfasında görünür). Stiller artık ayrıştırmadan önce zararsız hâle getiriliyor; ihlal sıfır.
- **Künye sırası:** yapıştırılan metinde eksik DOSYA NO en üste, VEKİLİ müvekkilin satırının (ve adresinin) hemen altına, karşı taraf KONU'dan önce ekleniyor; daha önce hepsi künyenin sonuna gidiyordu.
- **Kapanışsız talep listesi:** “1. … 2. …” ile biten ama “talep ederim” cümlesi olmayan metinde de SONUÇ VE İSTEM başlığı yerine konuyor.
- **Yanlış uyarılar:** “… tarihli duruşmada verilen karar” gibi geçmiş duruşmaya atıflar artık “geçmiş duruşma” uyarısı vermiyor; sözcük kaybı denetimi elle tutulan liste yerine kayıtlı değişikliklerle açıklanan sözcükleri düşüyor.
- **Gövdede yanlış sekme:** satır içindeki 4+ boşluk yalnız etiket ile iki nokta arasında sekmeye çevriliyor; gövde metninde tek boşluğa iniyor.
- **Kaynak tanıma:** yalnız “- ” madde işaretli düz dilekçe artık “yapay zekâ metni” sanılmıyor.
- **Paragraf silme:** silinen paragrafın “önüne sayfa sonu / boş satır” eklentileri de siliniyor; bütün paragraflar silinirse anlaşılır mesaj (“Geri al ile geri getirin”).
- **Yapıştırma sırasında olası çökme** (yalnız biçimli pano içeriği) ve **elle seçilmiş AÇIKLAMALAR sınırının kayması** giderildi.
- Yapıştırma kutusuna ekran okuyucu etiketi; bütün sayfalara simge bağlantısı; kaynakta görünmez karakterler kaçış dizisine çevrildi.
- Yeni kalıcı testler: güvenlik kuralı açık sayfa testi, tohumlu zorlama testi (`tests/fuzz.py`: her seferinde yüzlerce rastgele dilekçe, düzenleme, bozuk HTML ve şablon; testin hata yakaladığı kasıtlı bozmayla doğrulandı).

## 1.6.0 — Word'süz: metni yapıştır, dilekçe kurulsun

Word → UDF sayfasındaki **“…ya da metni yapıştırın”** kutusuna dilekçeyi yapıştırmanız yeterli; Word dosyası gerekmez.

**Kaynak tanıma.** Panodaki biçimli (HTML) ve düz metin birlikte okunur; nereden kopyalandığı tanınır ve o kaynağın bozduğu şeyler onarılır:

| Kaynak | Ne yapılır |
|---|---|
| Microsoft Word | Kalın/italik/altı çizili, hizalama, Word sekmeleri ve liste numaraları korunur; görseller bildirilir. |
| Google Dokümanlar | Google'ın dış “kalın” sarmalayıcısı yok sayılır; gerçek kalın/italik okunur. |
| LibreOffice, UYAP editörü (Java), web sayfası | Biçimli içerik okunur; tablolar sekmeli satırlara çevrilir. |
| PDF | Cümle ortasında kırılan satırlar birleştirilir, heceleme tireleri ve sayfa numaraları atılır. |
| Yapay zekâ / Markdown | `**`, `#`, tablo çizgileri temizlenir; kalın ve başlıklar korunur. |
| WhatsApp, e-posta | Tarih/saat/gönderen önekleri, e-posta başlıkları ve `>` alıntı işaretleri atılır. |

**Dilekçeyi baştan kurma.** “Dilekçenin parçaları” panelinde mahkeme, dosya no, taraflar, vekil, KONU, AÇIKLAMALAR, SONUÇ VE İSTEM ve imza ✓ / ✗ olarak gösterilir. Eksikler için yalnız o alanlar sorulur:
- Küçük harfle yazılmış mahkeme satırı büyük harfe çevrilir; hiç yoksa formdan eklenir.
- Dosya no, müvekkil, karşı taraf, KONU formdan; vekil satırı ve imza bloğu ayarlardaki vekil profilinden eklenir.
- AÇIKLAMALAR başlığı ilk gövde paragrafının önüne, SONUÇ VE İSTEM son “… talep ederim/ederiz” cümlesinin (ve önündeki maddelerin) önüne konur.
- Boş bırakılan bilgi **eklenmez, uydurulmaz**. Zaten tam olan dilekçeye hiçbir şey eklenmez.

Sonra her şey Word'den gelen belgeyle aynı: hukuk dilekçesi kuralları, dilekçe denetimi, paragraf düzenleyici, UDF / düzenlenmiş Word indirme ve rapor (rapor yapıştırma kaynağını ve eklenen parçaları da yazar).

**Sınır:** Araç çevrimdışı çalışır ve metin cihazdan çıkmaz; bu yüzden serbest anlatılmış bir olaydan hukuki metni kendisi *yazmaz*. Metindeki yapıyı tanır, eksik çerçeveyi sizin verdiğiniz bilgilerle tamamlar ve standarda göre dizer.

Ayrıca: SONUÇ girişinden (“Yukarıda açıklanan nedenlerle; …”) ayrılan ilk talep artık büyük harfle başlar.

## 1.5.0 — Geliştirme planının tamamı

**Telefon ve görünüm**
- Önizleme ekran genişliğine **sığdırılır** (“Sığdır / Gerçek boyut” düğmesi); telefonda sayfa artık sağdan kesilmez.
- Kâğıt telefon/tarayıcı **karanlık modda da beyaz** kalır (`color-scheme: only light`).
- Masaüstünde önizleme sayfa kaydırılırken yerinde kalır.

**Ayarlar (koddan çıkarıldı)**
- Vekil adı/UETS, başka vekiller, liste biçimi, satır aralığı, tarih ve talep ayırma seçenekleri tek bir ayar modelinde (`settings.js`) tutulur; yalnız bu tarayıcıda saklanır.
- **Ayarları dışa / içe aktar:** JSON dosyasıyla telefon ↔ bilgisayar arasında taşınır.

**Dilekçe denetimi (gönderim öncesi, belgeyi değiştirmez)**
- Mahkeme başlığı yok / yönelme eki eksik, DOSYA NO yok veya `yıl/sıra` biçiminde değil.
- UETS numarası hatalı biçimde ya da VEKİLİ satırında yok.
- İmzadaki avukat künyede yok; imzadaki taraf adı (“Davalı İsa Çiftçi Vekili”) künyedeki değerle uyuşmuyor; imza bloğu yok.
- KONU / SONUÇ VE İSTEM / talep maddesi yok; kapanış cümlesi eklendi bilgisi.
- Geçersiz tarih (31.02.2026), **geçmiş duruşma tarihi**, iki yıldan uzak tarih.
- UYAP'ta kayma riski olan “iki yana yaslı + sekme” paragrafı; açıklanmayan sözcük kaybı.
- Hatalar önce, sonra uyarılar ve bilgiler listelenir; rapora da yazılır.

**Talepleri maddelere ayırma (onaylı)**
- Tek maddeye yazılmış birden çok talep (`…kabulüne, …bırakılmasına, …kaldırılmasına, …`) algılanır ve **önerilir**; “Maddelere ayır” ile numaralı maddelere bölünür. Kendiliğinden bölünmez. Her yeni madde büyük harfle başlar.

**Paragraf düzenleyici (önizlemede)**
- Önizlemedeki paragrafa dokunun → düzenleme paneli açılır (telefonda alttan, masaüstünde solda; düzenlenen paragraf görünür kalır).
- **Paragraf türü:** Otomatik (algılanan tür yazılı, ör. “Otomatik · imza satırı”), Gövde, Düz, Ara başlık, Ortalı başlık, **Talep maddesi**, **Ek maddesi**, Kapanış cümlesi, **Alıntı (karar / metin)**, İmza satırı.
- **Hizalama:** sola, ortala, sağa, iki yana. **Yazı:** kalın, italik, altı çizili, punto (10–16).
- **Girinti ve aralık:** ilk satır, sol ve sağ girinti (0–3 cm), önce/sonra boşluk (0–18 pt), satır aralığı (1 / 1,15 / 1,5 / 2).
- **Metin:** paragraf metnini düzeltin (“Metni uygula”, “Özgün metne dön”); kanun/karar atıfları yeniden biçimlenir, liste numarası korunur.
- **İşlemler:** önüne/arkasına boş satır, önüne sayfa sonu, sonraki paragrafla birleştir (Word'ün böldüğü satırlar için), paragrafı sil.
- **Numaralar kendiliğinden düzelir:** bir talep silinir, eklenir veya bir paragraf talep/ek maddesine çevrilirse 1., 2., 3. sırası yeniden verilir.
- **Çoklu seçim:** “Çoklu seçim” düğmesi (masaüstünde Ctrl/Shift + tıklama) → birden çok paragrafa aynı düzen tek seferde.
- **Geri al** (Ctrl+Z dahil, 100 adım), paragraf başına **Sıfırla**, **Düzenlemeleri sıfırla**. Düzenlenen paragraflar önizlemede işaretlidir; her düzenleme dönüşüm raporunda “Elle yapılan paragraf düzenlemeleri” başlığı altında yazılır.
- Düzenleyici hem Word → UDF sayfasında (iki profilde de) hem şablon sayfasında çalışır.

**Dilekçe şablonları (`templates.html`)**
- 8 şablon: duruşma mazeret dilekçesi; cevap süresi için ek süre (HMK m. 127); ihtiyati tedbire itiraz (HMK m. 394); bilirkişi raporuna itiraz (HMK m. 281); e-Duruşma / SEGBİS ile katılım (HMK m. 149); tanık listesi (HMK m. 240); vekaletname sunulması ve dosyaya erişim; genel beyan dilekçesi.
- Mahkeme, esas no, taraflar ve tarihler formdan; açıklama, talepler, kapanış ve ekler sayfada düzenlenebilir. Çıktı, Word'den dönüştürülen belgelerle **aynı kurallardan** geçer ve UDF veya Word olarak indirilir. Boş alanlar `…` olarak görünür, bilgi uydurulmaz.

**Toplu dönüşüm ve Word çıktısı**
- Birden çok DOCX seçilir (veya sürüklenir) → hepsi tek **ZIP** içinde UDF + toplu rapor. Hatalı dosya diğerlerini durdurmaz, raporda yazılır.
- “Düzenlenmiş Word (DOCX) indir”: UDF ile aynı düzende Word belgesi.

**Düzeltilen algılama hataları**
- `ŞANLIURFA 8. ASLİYE HUKUK MAHKEMESİ'NE` gibi **kesme işaretli** başlıklar mahkeme başlığı olarak tanınmıyordu; artık ortalı, kalın, 14 pt.
- `KARŞI TARAF DAVALI:` etiketi tanınmıyor ve bir önceki VEKİLİ satırının içine yutuluyordu. Bilinmeyen BÜYÜK HARFLİ `ETİKET:` satırları artık hiçbir değerin devamı sayılmaz.

**Yapı**
- `legal-rules.js`: etiket/bölüm sözlüğü, algılama kalıpları ve ad listesi (yalnız veri). `legal-typography.js` yalnız mantık.
- `pipeline.js`: tek sayfa, toplu dönüşüm ve şablonların ortak dönüşüm hattı. `preview.js`: ortak önizleme. `checks.js`: denetim.
- Testler: 84 mantık testi, 5 isimleri değiştirilmiş örnek dilekçeyle **altın çıktı** testi (`tests/golden.test.js`), genişletilmiş Chromium testleri.
- `npm test`, `npm run build` (yeniden üretilebilir sürüm ZIP'i + SHA-256), GitHub Actions iş akışı (`.github/workflows/wordtoudf.yml`).

**Çevrimdışı web uygulaması (PWA)**
- Klasör bir web sunucusunda (ör. GitHub Pages) yayınlanırsa `index.html` başlangıç sayfasıdır; telefonda “Ana ekrana ekle” ile uygulama gibi açılır ve `sw.js` sayesinde çevrimdışı çalışır. Dosyalar yine cihazdan çıkmaz. Chrome uzantısı bu dosyaları kullanmaz.

**Hâlâ doğrulanmayan:** UYAP Doküman Editörü'nde açılış ve görünüm bu ortamda test edilemez. İlk belgeleri UYAP'ta açarak kontrol edin.

## 1.4.1 — Kullanıcı geri bildirimi düzeltmeleri

- **Tek kapanış:** SONUÇ VE İSTEM'deki uzun son talep `... karar verilmesini saygıyla talep ederiz. 14.10.2026` ile bitiyorsa kapanış bu talepten ayrılır; ikinci bir `Karar verilmesini vekâleten talep ederim.` cümlesi **eklenmez**. Talep metnindeki eski tarih de kalkar; tarih yalnız kapanışın sonunda bir kez yazılır.
- **Liste numarası iç içe girmiyor:** bazı UDF görüntüleyicileri otomatik liste numarasını ilk sözcüğün üstüne çiziyordu (`114.10.2026`). Varsayılan artık **metin numarası + sekme** (`1.` ⇥ metin, 18 pt asılı girinti, 18 pt sekme durağı). Eski davranış “Liste numarası → UDF otomatik liste” seçeneğiyle kullanılabilir.
- **Yazı tipi Times New Roman:** hukuk dilekçesi profilinde bütün metin ve UDF varsayılan stili Times New Roman 12 pt'dir; Word tema yazı tipleri (Cambria, Calibri vb.) taşınmaz.
- **Kendi vekil profili:** varsayılan vekil `Av. Fatih NAKIŞLI`, UETS `16615-16448-62422`. VEKİLİ satırı: `VEKİLİ : Av. Fatih NAKIŞLI (UETS: 16615-16448-62422)`. Ad ve UETS arayüzden değiştirilebilir.
- **Başka vekil butonu:** “Başka vekil var” kutucuğu işaretlenince ad + UETS satırları ve “+ Başka vekil / UETS hesabı ekle” butonu açılır. UETS girilirse eklenir; **boş bırakılırsa VEKİLİ satırına numara yazılmaz** (artık numarasız `(UETS)` ibaresi de yazılmaz).
- **Kesintisiz alt çizgi:** etiketteki alt çizgi sekme boşluğunda kesilmez; `DOSYA NO`'dan iki noktaya kadar tek çizgi olarak devam eder (UDF `<tab underline="true">`). Değer altı çizgisiz kalır.
- **KONU iki nokta hizası:** iki yana yaslı KONU / HUKUKİ SEBEPLER satırlarında UDF sekmesi kayıyor, iki nokta ortak sütunun sağına düşüyordu. Etiketli satırlar artık sola yaslı; bütün iki noktalar aynı sütunda.

## 1.4.0 — Nihai hukuk dilekçesi standardı

Hukuk dilekçesi profili artık son kararlaştırılan dilekçe standardını uygular. **Word biçimini koru** profili bu kuralların hiçbirini uygulamaz.

- **Ortak iki nokta hizası:** DOSYA NO, bütün taraf/vekil/adres satırları, İCRA DOSYA NO, KONU, AÇIKLAMALAR, HUKUKİ SEBEPLER, HUKUKİ DELİLLER, SONUÇ VE İSTEM ve EKLER satırlarının iki noktası **tek bir gerçek sekme durağında (6,0 cm)** durur. Boşluk karakteriyle hizalama yapılmaz.
- **Etiket biçimi:** etiket ve iki nokta **kalın + altı çizili**; sekme boşluğu altı çizgisiz; iki noktadan sonra tek boşluk; değer normal yazılır.
- **Doğal satır sarma:** uzun değer alt satıra girintisiz geçer; asılı girinti veya ikinci sekme yoktur. Ayrı satırlara bölünmüş adres/unvan parçaları aynı paragrafta birleştirilir. Sütuna sığmayan uzun etiket (ör. İSTİNAF EDEN SANIK) iki satıra bölünür, iki nokta yerinde kalır.
- **Tek DOSYA NO:** `DOSYA NO : 2026/713 E. 2026/708 K.` Ayrı KARAR NO etiketi kalmaz. Kaynaktaki nitelendirme (ör. `D. İş`) korunur, E./K. uydurulmaz; yalnız ESAS NO / KARAR NO etiketinden gelen çıplak numaraya E. / K. eklenir.
- **Kısa sıfatlar:** İHTİYATİ HACZE İTİRAZ EDEN → İTİRAZ EDEN, İHTİYATİ HACİZ TALEP EDEN → TALEP EDEN, İLGİLİ İCRA DOSYASI → İCRA DOSYA NO, İLGİLİ İCRA HUKUK DOSYASI → İCRA HUKUK DOSYA NO, TEBLİGAT ADRESİ / ADRES → ADRESİ. Sanık, şüpheli, katılan, davacı gibi hukuki sıfatlar değiştirilmez.
- **Vekil ve UETS:** `VEKİLİ : Av. Ad SOYAD (UETS)`. Kaynakta UETS numarası varsa `(UETS: numara)`. Vekilin ayrı ADRES VE UETS / VEKİL ADRESİ / UETS satırları VEKİLİ satırına taşınır; ayrı satır açılmaz, bilgi tekrarlanmaz. **Bilinmeyen numara uydurulmaz.** İsteğe bağlı “Doğrulanmış vekil UETS listesi” yalnız bu tarayıcıda saklanır ve yalnız adı tam eşleşen vekile uygulanır.
- **Soyadı:** kişi adlarında soyadı büyük harfe çevrilir (Türkçe yerel ayar, yaygın ad listesiyle iki sözcüklü soyadı tanıma). Şirket ve kurum unvanlarına dokunulmaz; belirsiz durumda yalnız son sözcük büyütülür ve raporda belirtilir.
- **Bölümler:** KONU, HUKUKİ SEBEPLER, HUKUKİ DELİLLER değerleri başlık satırında başlar. AÇIKLAMALAR satırının karşısı boştur; aynı satırda metin varsa metin yeni paragrafa alınır.
- **SONUÇ VE İSTEM:** `SONUÇ VE İSTEM : Yukarıda arz edilen sebeplerle;` (parantezli ek açıklama yazılmaz). Talepler **gerçek otomatik numaralı liste** olarak yazılır (UDF `Numbered`, `NumberType`, `ListLevel`, `ListId`); metindeki elle yazılmış `1.`, `2-` numaraları kaldırılır. Kapanış cümlesi listenin dışındadır ve **oluşturulduğu günün tarihi (Türkiye saati, GG.AA.YYYY)** aynı paragrafta cümlenin sonuna yazılır. Son talebin içine yazılmış kapanış ayrı paragrafa alınır; kapanış hiç yoksa `Karar verilmesini vekâleten talep ederim.` eklenir.
- **EKLER:** yalnız kaynakta varsa; `EKLER :` satırı ve **ayrı** otomatik numaralı liste.
- **Satır aralığı:** AÇIKLAMALAR ve sonrasındaki gövde için varsayılan **1,5** (1.3.2'de 1,0 idi; arayüzden 1,0 seçilebilir). Gövde 12 punto.
- **Rapor:** yapılan her metin değişikliği (etiket kısaltma, birleşen satır, UETS, soyadı, SONUÇ girişi, kapanış, tarih, kaldırılan elle numara) önizleme panelinde ve indirilen raporda gösterilir; ayrıca sözcük düzeyinde metin bütünlüğü karşılaştırması yapılır.
- **UDF → Word:** yeni yazılan UDF listeleri Word'e gerçek numaralı liste olarak geri döner; talepler ve ekler iki ayrı listedir.

**Doğrulanmayan:** Üretilen UDF'nin, özellikle yeni liste özniteliklerinin ve sekme hizasının **UYAP Doküman Editörü'nde açılışı ve görünümü test edilmemiştir.** Yapısal XML/ZIP/ofset doğrulaması ve Chromium testleri bunu garanti etmez. Lütfen ilk belgeleri UYAP'ta açarak `KABUL_TESTLERI.md` listesine göre kontrol edin (liste 1.7.0'da eklendi).

## 1.3.2 — Mahkeme ve taraf künyesi dizgisi; denetim ve güvenilirlik düzeltmeleri

- `DOSYA NO` ve `KARAR NO` mevcutsa **aynı fiziksel paragrafta** gösterilir; her iki etiket kalın, değerleri normaldir.
- Taraf sıfatı/vekil sıfatı, tab durağı, kalın iki nokta + bir boşluk ve kalın olmayan unvan/ad **aynı fiziksel paragrafta** yer alır. Uzun unvanlar aynı paragrafta değer sütunundan alt satıra taşar.
- Vergi numarası, adres ve UETS için bilinen etiketler aynı kolon disipliniyle gösterilir. Bilinmeyen UETS/adres verisi otomatik üretilmez.
- Kişi adlarında soyadına büyük harf uygulanır; kurumsal unvanlar ve serbest metinler dönüştürülmez. Çok parçalı isimlerde ad/soyadı otomatik ayırma yüzde yüz güvenilir değildir; son kontrol kullanıcıdadır.
- `KONU` dar künye sütununa sıkıştırılmaz; tam paragraf genişliğinde kalır.
- **Word biçimini koru** profili bu semantik değişiklikleri yapmaz.

**Denetim ve güvenilirlik**

- Künye birleştirmesi yeni alan etiketini yutmaz.
- Word biçimini koru profili kaynak paragraf geometrisini ve mevcut sayfa boşluklarını korur.
- Karar ve kanun atfı biçimleri Word run sınırlarından bağımsız uygulanır.
- İmza algılaması sonuç bölümü/kapanış konumuyla sınırlandırıldı.
- Asenkron dosya seçimi yarışları ve hatalı bölüm seçimi sonrası eski sonucu indirme riski giderildi.
- Kaynak DOCX/UDF okuma/aktarma bilinen kayıpları ve UYAP'ta son kontrol gerekliliği devam eder.

**Belge düzeni (1.3.2 ayarları; 1.4.0 farkları yukarıda)**

- A4 sayfa, Word yatay/dikey yönü korunur; dört kenar boşluğu **1,5 cm** olarak ayarlanır.
- AÇIKLAMALAR bölümünden **önceki ve sonraki tüm paragraflarda** ve bölüm başlıklarında üst/alt boşluk **0 pt** olarak uygulanır. **Yalnızca AÇIKLAMALAR gövdesindeki** paragraflarda önce ve sonra **0,15 cm (yaklaşık 4,252 pt)** olarak uygulanır.
- Sadece **AÇIKLAMALAR** başlığından sonraki gövde paragraflarında **1,25 cm ilk satır girintisi, tek satır (1,0) aralık ve iki yana yaslama** uygulanır. Bölüm, HUKUKİ NEDENLER, DELİLLER, SONUÇ VE İSTEM gibi sonraki başlığa kadar sürer. Başlık adı farklıysa sınırlar arayüzde elle seçilebilir.
- Word metni, paragraf sınırları, temel başlık stilleri, kalın/italik/altı çizili, yazı tipi, punto, doğrudan RGB renkleri ve çözümlenebilen tema renkleri aktarılır.
- Basit tablolar **satır satır**, hücreleri sekmeyle ayrılmış düz metin olarak aktarılır. Izgara, kenarlık, hücre birleştirme ve sütun ölçüleri taşınmaz.
- Üstbilgi ve altbilgi **bilinçli olarak dışarıda bırakılır**.
- İçerik imzasız UDF olarak üretilir; Word'deki imza kriptografik olarak taşınmaz. Program **kendiliğinden** “e-imzalıdır” veya imza bildirimi eklemez.

## 1.3.0 — Semantik hukuk dilekçesi tipografi mimarisi

Bu sürümde biçimlendirme tek tek kelime/başlık yamalarından ayrılarak dört katmana bölündü: **DOCX ayrıştırma → temel normalizasyon → semantik hukuk tipografisi → UDF yazıcı**. `legal-typography.js` belgeyi mahkeme başlığı, dilekçe türü, künye, ana/ara başlık, açıklama gövdesi, sonuç maddesi, gerçek imza bloğu ve ekler rollerine ayırır.

- Mahkeme/başsavcılık başlığı: ortalı, 14 punto, kalın; **altı çizilmez**.
- Dilekçe türü: ortalı ve kalın; mahkeme başlığıyla karışmaz.
- Künye: label/value satırları sabit sekme kolonu ile hizalanır; ayrı label + ilk değer satırı güvenli biçimde birleştirilebilir.
- `Av.` geçen her satır imza sayılmaz. İmza rolü yalnız kapanış cümlesinden sonra ve EKLER'den önce aranır.
- AÇIKLAMALAR gövdesi: 1,25 cm ilk satır, iki yana yaslı, 1,0 satır, önce/sonra 0,15 cm. Ara Roma/rakam başlıkları gövde girintisine sokulmaz.
- Yargıtay/BAM karar künyeleri kalın-italik; kanun/madde atıfları italik olarak işaretlenir.
- SONUÇ VE İSTEM numaralı maddeleri asılı girintiyle düzenlenir; belirgin usul talepleri seçici kalınlaştırılır.
- Kullanıcı isterse **Word biçimini koru** profilini seçip semantik tipografi müdahalesini kapatabilir.

## 1.2.1 — Güvenlik sertleştirmesi

- Manifest V3 CSP açıkça sınırlandı; `connect-src 'none'` ile uzantı sayfalarının ağ bağlantısı kapatıldı.
- Manifestte gerekli olmayan izin ve host erişimi bulunmaz.
- ZIP giriş adlarında path traversal, kontrol karakteri ve yerel/merkez başlık uyuşmazlığı reddedilir.
- XML DTD/ENTITY kullanımı reddedilir; XML öğe sayısı ve iç içe geçme derinliği için DoS sınırları uygulanır.
- UDF paragraf, metin parçası ve tablo hücresi sayıları için ek yapısal limitler bulunur.
- İndirilen dosya adlarında Unicode bidi/görünmez yönlendirme karakterleri temizlenir.
- Önizleme metni HTML olarak enjekte edilmez; DOM'a `textContent` ile yazılır.
- Mevcut CRC32, ZIP boyut/açılmış veri, UDF ofset ve DOCX/UDF bütünlük kontrolleri korunur.

## 1.2.0 — UDF liste ve tipografi algılama

UDF → Word/PDF yönünde aşağıdaki UDF paragraf özellikleri artık yalnız uyarı değildir; okuyucu bunları anlamlandırır:

- `Numbered`, `NumberType`, `ListLevel`, `ListId`
- `Bulleted`, `BulletType`
- paragraf düzeyindeki `family` ve `size` (run düzeyi değerler yine önceliklidir)

Numaralı listeler DOCX içinde gerçek Word numbering yapısına (`numbering.xml` + `numPr`) çevrilir. PDF/önizlemede aynı liste türünden görünür işaret üretilir. Bilinen NUMBER_TYPE türleri decimal, harf ve Roma rakamı olarak eşlenir. Bilinmeyen liste türlerinde metin kaybedilmeden en yakın görünüm kullanılır ve uyarı gösterilir.

## 1.1.2 — Metin öncelikli UDF dışa aktarımı

- UDF→Word/PDF sırasında Numbered, NumberType, ListLevel, ListId, family, size ve benzeri birebir eşlenemeyen biçim öznitelikleri yalnız uyarı üretir.
- Bu uyarılar Word/PDF düğmelerini devre dışı bırakmaz. Okunabilen metin her durumda dışa aktarılmaya çalışılır.
- Bozuk ZIP, geçersiz XML, geçersiz UTF-16 ofsetleri ve açıklanamayan içerik çakışmaları yapısal hata olarak reddedilmeye devam eder.

## 1.1.1 — Gerçek UYAP metin öğeleri ve tablo düzeltmesi

- `<field>` (UYAP form alanı) ve `<space>` öğeleri kaynak `content.xml` ofsetlerinden **görünür metin olarak** aktarılır. Form alanlarının dinamik işlevi aktarılmaz; bunun için uyarı verilir.
- `<table border="borderNone">` / `row` / `cell` / `paragraph` içeriği kaybolmadan düzenlenebilir Word tablosuna ve basılabilir HTML tabloya aktarılır. Kaynakta hücre genişlikleri belirtilmemişse Word otomatik sütun genişliği kullanır; görüntü eşitliği garanti edilmez.
- `<paragraph resolver>` ve `<content resolver>` stil bağları çözümlenir; kaynağın punto, font ve renk bilgileri korunur.
- `documentproperties.xml` ve `sign.sgn` var diye metin okumak engellenmez. Kriptografik imza ve UYAP alan metaverisi aktarılamadığı açıkça bildirilir. İmza geçerliliği yoktur.
- Metin ofsetlerinde açıklanamayan görünür karakter kaybı ve çakışma dosyanın yapısal bozukluğu sayılır ve yine hata verir; yalnız desteklenmeyen biçim özellikleri dönüşümü durdurmaz.
- Kullanıcı UDF dosyasına dokunulmaz; özel AÇIKLAMALAR düzenlemesi UDF → Word/PDF yönünde uygulanmaz.

## 1.1.0 — UDF → Word / UDF → PDF

- UDF dosyası **salt okunur** biçimde açılır; kaynak UDF diskte veya bellekte yeniden yazılmaz. Word → UDF yönünün **AÇIKLAMALAR**, künye, satır aralığı, girinti ya da diğer otomatik biçimlendirme kuralları bu yönde **uygulanmaz**.
- UDF `content.xml` metni ile paragraf/karakter ofsetleri doğrulanır; desteklenen UDF 1.8 öznitelikleri doğrudan Word OOXML karşılığına yazılır: metin, font, punto, kalın/italik/alt çizgi/üstü çizili, RGB renk, paragraf hizası, girinti, aralık, özel sekme durakları, sayfa sonları ve A4 sayfa boşlukları. UDF üstbilgi/altbilgisi varsa Word'e ayrı bölüm olarak aktarılır.
- **UDF → Word:** çıktı `.docx` düzenlenebilir; içerik ekleyen, kırpan veya hukukî bölüm biçimlendirmesi yapan bir adım yoktur. DOCX ZIP girişleri CRC32 ile doğrulanır.
- **UDF → PDF:** UDF önizlemesi doğrudan **Chrome'un yerel yazdırma sistemiyle** PDF'ye çıkarılır; önce DOCX üretilmez. Yazdırma ekranında hedefi **PDF olarak kaydet** seçmek gerekir. Bu bir otomatik `.pdf` indirme düğmesi değildir.
- Desteklenen basit UDF tabloları Word tablosuna ve PDF tablo düzenine aktarılır. Desteklenmeyen karmaşık tablo/görsel/özel UDF nesnesi tespit edilirse **uyarı olarak raporlanır; dışa aktarma engellenmez**. Okunabilen metin ve desteklenen biçimler Word/PDF’ye aktarılır; desteklenmeyen biçim özellikleri kaybolabilir. Bozuk ZIP, uyumsuz metin ofsetleri, DTD/ENTITY ve desteklenmeyen UDF sürümleri reddedilir.
- Word ve UYAP ile Chrome farklı dizgi/ölçüm motorları kullanır. Kaynağa bilinçli müdahale yapılmaz ancak aynı sayfa kırılımı, yazı tipi eşdeğeri ve piksel düzeyinde görünüm **garanti edilemez**. UDF'deki görünür e-imza ibareleri metindir; **kriptografik imza geçerliliği** PDF/DOCX'e aktarılmaz.
- UDF içinde elle hazırlanmış 1.8 dışındaki sürümler; karmaşık yerel tablolar, ek medya, özel UDF öğeleri ve UDF'nin tüm üretici varyasyonları bu sürümde desteklenmemektedir.

## 1.0.3 — AÇIKLAMALAR paragraf aralığı

- Künye, metnin AÇIKLAMALAR öncesi ve tüm bölüm başlıkları için 0 pt önce/sonra korunur.
- AÇIKLAMALAR başlığından sonraki paragraf metinleri için 0,15 cm önce ve 0,15 cm sonra uygulanır; UDF `SpaceAbove` ve `SpaceBelow` niteliklerinde birimler punto olduğundan değer 4,252 pt yazılır.
- Bölümün ilk satır girintisi 1,25 cm, satır aralığı 1,0 ve hizalaması iki yana yaslı kalır. Word yazı tipi, punto ve renkleri korunur.
- Bölüm sınırı sonraki başlıkta kapanır; **bu başlığın kendisinde ve sonrasındaki paragraflarda önce/sonra 0 pt uygulanır**. Başlangıç/bitiş yanlış tanınırsa arayüzden elle seçim yapılabilir.
- Önizlemede üst ve alt boşluklar bitişik paragraflar arasında birleşmez; belgeyi UYAP'ta açarak son kontrol yapın.

## 1.0.2 — Dilekçe künyesi, sekme durakları, imza alanları ve satır sonları

- Paragrafların öncesi ve sonrasındaki otomatik ek boşluk sıfırlandı. Word'deki boş paragraflar korunur.
- Word'un `w:tabs` özel sekme durakları stil kalıtımı ve temizleme talimatıyla okunur, `TabSet` olarak UDF paragrafına yazılır.
- Dilekçe künyesindeki etiket–iki nokta satırlarında Word özel durak belirlememişse 220 pt'lik ortak durak atanır.
- Sekme artık yalnız düz metin karakteri değildir: `<tab>` UDF öğesi olarak yazılır; kalın/italik/alt çizgi/renk özellikleri sekme öğesine de işlenir.
- Temel metin renkleri, açıklama paragrafları, imza ve sayfa kenar boşluğu kuralları korunur.
- Tablo ızgarası hâlâ aktarılmaz; Word'ün sütun ölçülerini ve gelişmiş sekme öncülerini UYAP ile birebir eşitleme garantisi verilmez.

- Word `Shift+Enter` (`w:br`, `w:cr`) satır sonları UDF içinde ayrı paragraf olarak üretilir; boş ara satırlar korunur.
- UDF paragrafının bitiş `\n` karakteri bağımsız içerik etiketi olarak değil, **son biçimlendirilmiş metin parçasının içinde** yazılır. Paragraf sonları XML doğrulamasında ayrıca denetlenir.
- Tablo hücrelerinde birden çok paragraf veya satır sonu bulunan imza blokları tek satıra birleştirilmez. Yalnız sağa/ortaya hizalı dolu hücreler kendi hizasını korur.
- Satır sonlarının Word paragrafına dönüştürülmesi, o paragrafın Word içi satır aralığı/öncesi-sonrası davranışını sadeleştirebilir; çıktıda bölüm bazlı paragraf aralığı kuralı uygulanır.
