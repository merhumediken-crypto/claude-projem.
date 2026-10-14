# Word ↔ UDF / PDF — WordToUDF 1.6.0

**Sürüm:** 1.6.0 | **Çalışma biçimi:** Manifest V3 / çevrimdışı / sunucusuz / Chrome izni yok · ayrıca çevrimdışı web uygulaması (PWA)

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

**Doğrulanmayan:** Üretilen UDF'nin, özellikle yeni liste özniteliklerinin ve sekme hizasının **UYAP Doküman Editörü'nde açılışı ve görünümü test edilmemiştir.** Yapısal XML/ZIP/ofset doğrulaması ve Chromium testleri bunu garanti etmez. Lütfen ilk belgeleri UYAP'ta açarak `KABUL_TESTLERI.md` listesine göre kontrol edin.

## Kurulum

1. ZIP paketini bilgisayarınızda **klasörün tamamını koruyarak** çıkarın.
2. Masaüstü Chrome adres çubuğuna `chrome://extensions` yazın.
3. **Geliştirici modu**nu açın → **Paketlenmemiş öğe yükle**yi seçin.
4. ZIP'ten çıkan `WordToUDF-1.6.0` klasörünü seçin (içinde `manifest.json` bulunan klasör).
5. Araç çubuğundaki **Word ↔ UDF** simgesine tıklayın → dönüştürme yönünü seçin.
6. Word → UDF için DOCX dosyasını seçin; önizlemeyi, “Hukuk profilinin metin değişiklikleri” listesini ve varsa dönüşüm uyarılarını denetleyin. Gerekirse AÇIKLAMALAR bölümünün başlangıç/bitiş başlığını elle seçin.
7. **UDF oluştur ve indir** ile `.udf` dosyasını kaydedin. UDF → Word / PDF için UDF seçin; Word düğmesi `.docx` indirir, PDF düğmesi Chrome yazdır penceresini açar. PDF hedefini **PDF olarak kaydet** seçin.

Kurumsal Chrome politikaları paketlenmemiş eklenti yüklemeyi engelliyorsa eklenti yönetici tarafından izin verilmedikçe yüklenemeyebilir.

---

## 1.3.2 — yeni mahkeme ve taraf künyesi dizgisi

- `DOSYA NO` ve `KARAR NO` mevcutsa **aynı fiziksel paragrafta** gösterilir; her iki etiket kalın, değerleri normaldir.
- Taraf sıfatı/vekil sıfatı, tab durağı, kalın iki nokta + bir boşluk ve kalın olmayan unvan/ad **aynı fiziksel paragrafta** yer alır. Uzun unvanlar aynı paragrafta değer sütunundan alt satıra taşar.
- Vergi numarası, adres ve UETS için bilinen etiketler aynı kolon disipliniyle gösterilir. Bilinmeyen UETS/adres verisi otomatik üretilmez.
- Kişi adlarında soyadına büyük harf uygulanır; kurumsal unvanlar ve serbest metinler dönüştürülmez. Çok parçalı isimlerde ad/soyadı otomatik ayırma yüzde yüz güvenilir değildir; son kontrol kullanıcıdadır.
- `KONU` dar künye sütununa sıkıştırılmaz; tam paragraf genişliğinde kalır.
- **Word biçimini koru** profili bu semantik değişiklikleri yapmaz.

# v1.3.2 — Denetim ve güvenilirlik düzeltmeleri

- Künye birleştirmesi yeni alan etiketini yutmaz.
- Word biçimini koru profili kaynak paragraf geometrisini ve mevcut sayfa boşluklarını korur.
- Karar ve kanun atfı biçimleri Word run sınırlarından bağımsız uygulanır.
- İmza algılaması sonuç bölümü/kapanış konumuyla sınırlandırıldı.
- Asenkron dosya seçimi yarışları ve hatalı bölüm seçimi sonrası eski sonucu indirme riski giderildi.
- Kaynak DOCX/UDF okuma/aktarma bilinen kayıpları ve UYAP'ta son kontrol gerekliliği devam eder.

# Önceki sürümler

## v1.3.0 — Semantik hukuk dilekçesi tipografi mimarisi

Bu sürümde biçimlendirme tek tek kelime/başlık yamalarından ayrılarak dört katmana bölündü: **DOCX ayrıştırma → temel normalizasyon → semantik hukuk tipografisi → UDF yazıcı**. `legal-typography.js` belgeyi mahkeme başlığı, dilekçe türü, künye, ana/ara başlık, açıklama gövdesi, sonuç maddesi, gerçek imza bloğu ve ekler rollerine ayırır.

- Mahkeme/başsavcılık başlığı: ortalı, 14 punto, kalın; **altı çizilmez**.
- Dilekçe türü: ortalı ve kalın; mahkeme başlığıyla karışmaz.
- Künye: label/value satırları sabit sekme kolonu ile hizalanır; ayrı label + ilk değer satırı güvenli biçimde birleştirilebilir.
- `Av.` geçen her satır imza sayılmaz. İmza rolü yalnız kapanış cümlesinden sonra ve EKLER'den önce aranır.
- AÇIKLAMALAR gövdesi: 1,25 cm ilk satır, iki yana yaslı, 1,0 satır, önce/sonra 0,15 cm. Ara Roma/rakam başlıkları gövde girintisine sokulmaz.
- Yargıtay/BAM karar künyeleri kalın-italik; kanun/madde atıfları italik olarak işaretlenir.
- SONUÇ VE İSTEM numaralı maddeleri asılı girintiyle düzenlenir; belirgin usul talepleri seçici kalınlaştırılır.
- Kullanıcı isterse **Word biçimini koru** profilini seçip semantik tipografi müdahalesini kapatabilir.



Bu eklenti LexUDF'den bağımsızdır. LexUDF'yi değiştirmez, onun ayarlarını veya depolama alanını kullanmaz. DOCX ve UDF dosyaları yalnız yerel tarayıcıda işlenir. Ağ isteği, hesabınıza erişim, dış servis veya Chrome izni kullanılmaz.

## Word → UDF belge düzeni (1.3.2 ayarları; 1.4.0 farkları yukarıda)

- A4 sayfa, Word yatay/dikey yönü korunur; dört kenar boşluğu **1,5 cm** olarak ayarlanır.
- AÇIKLAMALAR bölümünden **önceki ve sonraki tüm paragraflarda** ve bölüm başlıklarında üst/alt boşluk **0 pt** olarak uygulanır. **Yalnızca AÇIKLAMALAR gövdesindeki** paragraflarda önce ve sonra **0,15 cm (yaklaşık 4,252 pt)** olarak uygulanır.
- Sadece **AÇIKLAMALAR** başlığından sonraki gövde paragraflarında **1,25 cm ilk satır girintisi, tek satır (1,0) aralık ve iki yana yaslama** uygulanır. Bölüm, HUKUKİ NEDENLER, DELİLLER, SONUÇ VE İSTEM gibi sonraki başlığa kadar sürer. Başlık adı farklıysa sınırlar arayüzde elle seçilebilir.
- Word metni, paragraf sınırları, temel başlık stilleri, kalın/italik/altı çizili, yazı tipi, punto, doğrudan RGB renkleri ve çözümlenebilen tema renkleri aktarılır.
- Basit tablolar **satır satır**, hücreleri sekmeyle ayrılmış düz metin olarak aktarılır. Izgara, kenarlık, hücre birleştirme ve sütun ölçüleri taşınmaz.
- Üstbilgi ve altbilgi **bilinçli olarak dışarıda bırakılır**.
- İçerik imzasız UDF olarak üretilir; Word'deki imza kriptografik olarak taşınmaz. Program **kendiliğinden** “e-imzalıdır” veya imza bildirimi eklemez.

## 1.0.2 — imza alanları ve satır sonları

- Word `Shift+Enter` (`w:br`, `w:cr`) satır sonları UDF içinde ayrı paragraf olarak üretilir; boş ara satırlar korunur.
- UDF paragrafının bitiş `\n` karakteri bağımsız içerik etiketi olarak değil, **son biçimlendirilmiş metin parçasının içinde** yazılır. Paragraf sonları XML doğrulamasında ayrıca denetlenir.
- Tablo hücrelerinde birden çok paragraf veya satır sonu bulunan imza blokları tek satıra birleştirilmez. Yalnız sağa/ortaya hizalı dolu hücreler kendi hizasını korur.
- Satır sonlarının Word paragrafına dönüştürülmesi, o paragrafın Word içi satır aralığı/öncesi-sonrası davranışını sadeleştirebilir; çıktıda bölüm bazlı paragraf aralığı kuralı uygulanır.

## Word → UDF destek sınırları

Word'deki karmaşık liste düzenleri, görseller, yorumlar, izlenen değişiklikler, dış kaynaklar, gömülü nesneler, denklemler ve alan kodları birebir karşılık bulmayabilir. Eksikler önizlemedeki dönüşüm raporunda gösterilir. Kayıpları incelemeden dönüşüm düğmesi etkinleşmez. DIPNOT/SONNOT ve görsel konumları ana gövdede yer tutucuyla belirtilir; belge sonunda bunların içerikleri otomatik olarak eklenmez.

- Girdi: yalnız `.docx`, en fazla 24 MB ZIP; sıkıştırılmış arşiv üst sınırı ve açılan veri sınırı uygulanır.
- Çıktı: ZIP içinde `content.xml` taşıyan `.udf`, `format_id="1.8"`.
- Destek: Chrome 103 veya sonrası; `CompressionStream('deflate-raw')` gerekir.
- Biçim kayıpları/UYAP'taki olası yazı tipi farkları için son kontrol **UYAP Doküman Editörü**nde yapılmalıdır. İndirilen UDF'nin sistem tarafından kabul edildiğine dair çevrimdışı yapısal doğrulama tek başına garanti oluşturmaz.
- Eklenti sayfasının görünümü UDF için sayfa taşmalarını birebir tahmin etmez. Baskı ve sayfa sonu akışı UYAP'ta yeniden kontrol edilmelidir.

## UDF → Word / UDF → PDF — 1.1.0

- UDF dosyası **salt okunur** biçimde açılır; kaynak UDF diskte veya bellekte yeniden yazılmaz. Word → UDF yönünün **AÇIKLAMALAR**, künye, satır aralığı, girinti ya da diğer otomatik biçimlendirme kuralları bu yönde **uygulanmaz**.
- UDF `content.xml` metni ile paragraf/karakter ofsetleri doğrulanır; desteklenen UDF 1.8 öznitelikleri doğrudan Word OOXML karşılığına yazılır: metin, font, punto, kalın/italik/alt çizgi/üstü çizili, RGB renk, paragraf hizası, girinti, aralık, özel sekme durakları, sayfa sonları ve A4 sayfa boşlukları. UDF üstbilgi/altbilgisi varsa Word'e ayrı bölüm olarak aktarılır.
- **UDF → Word:** çıktı `.docx` düzenlenebilir; içerik ekleyen, kırpan veya hukukî bölüm biçimlendirmesi yapan bir adım yoktur. DOCX ZIP girişleri CRC32 ile doğrulanır.
- **UDF → PDF:** UDF önizlemesi doğrudan **Chrome'un yerel yazdırma sistemiyle** PDF'ye çıkarılır; önce DOCX üretilmez. Yazdırma ekranında hedefi **PDF olarak kaydet** seçmek gerekir. Bu bir otomatik `.pdf` indirme düğmesi değildir.
- Desteklenen basit UDF tabloları Word tablosuna ve PDF tablo düzenine aktarılır. Desteklenmeyen karmaşık tablo/görsel/özel UDF nesnesi tespit edilirse **uyarı olarak raporlanır; dışa aktarma engellenmez**. Okunabilen metin ve desteklenen biçimler Word/PDF’ye aktarılır; desteklenmeyen biçim özellikleri kaybolabilir. Bozuk ZIP, uyumsuz metin ofsetleri, DTD/ENTITY ve desteklenmeyen UDF sürümleri reddedilir.
- Word ve UYAP ile Chrome farklı dizgi/ölçüm motorları kullanır. Kaynağa bilinçli müdahale yapılmaz ancak aynı sayfa kırılımı, yazı tipi eşdeğeri ve piksel düzeyinde görünüm **garanti edilemez**. UDF'deki görünür e-imza ibareleri metindir; **kriptografik imza geçerliliği** PDF/DOCX'e aktarılmaz.
- UDF içinde elle hazırlanmış 1.8 dışındaki sürümler; karmaşık yerel tablolar, ek medya, özel UDF öğeleri ve UDF'nin tüm üretici varyasyonları bu sürümde desteklenmemektedir.

## Güvenlik ve veri işleme

UDF oluşturma ve doğrulama tarayıcı içindedir. Her belge bellekte işlenir, eklenti kalıcı dosya arşivi tutmaz. `host_permissions`, `permissions`, dış JavaScript, CDN, `eval` veya ağ isteği yoktur. DOCX arşiv yolu, tekrarlanan giriş, boyut, ZIP CRC32, XML sözdizimi ve DTD/ENTITY kontrolleri uygulanır. Metin önizlemesi DOM `textContent` ile oluşturulur; DOCX içeriği HTML olarak yürütülmez.

Açık kaynak örneklerden ve LexUDF'nin mevcut UDF çıktılarından yalnız biçim uyumluluğu konusunda yararlanılmıştır; eklentinin kendi dönüştürme kaynakları ayrıdır.

## 1.0.2 — dilekçe künyesi ve sekme durakları

- Paragrafların öncesi ve sonrasındaki otomatik ek boşluk sıfırlandı. Word'deki boş paragraflar korunur.
- Word'un `w:tabs` özel sekme durakları stil kalıtımı ve temizleme talimatıyla okunur, `TabSet` olarak UDF paragrafına yazılır.
- Dilekçe künyesindeki etiket–iki nokta satırlarında Word özel durak belirlememişse 220 pt'lik ortak durak atanır.
- Sekme artık yalnız düz metin karakteri değildir: `<tab>` UDF öğesi olarak yazılır; kalın/italik/alt çizgi/renk özellikleri sekme öğesine de işlenir.
- Temel metin renkleri, açıklama paragrafları, imza ve sayfa kenar boşluğu kuralları korunur.
- Tablo ızgarası hâlâ aktarılmaz; Word'ün sütun ölçülerini ve gelişmiş sekme öncülerini UYAP ile birebir eşitleme garantisi verilmez.

## 1.0.3 — AÇIKLAMALAR paragraf aralığı

- Künye, metnin AÇIKLAMALAR öncesi ve tüm bölüm başlıkları için 0 pt önce/sonra korunur.
- AÇIKLAMALAR başlığından sonraki paragraf metinleri için 0,15 cm önce ve 0,15 cm sonra uygulanır; UDF `SpaceAbove` ve `SpaceBelow` niteliklerinde birimler punto olduğundan değer 4,252 pt yazılır.
- Bölümün ilk satır girintisi 1,25 cm, satır aralığı 1,0 ve hizalaması iki yana yaslı kalır. Word yazı tipi, punto ve renkleri korunur.
- Bölüm sınırı sonraki başlıkta kapanır; **bu başlığın kendisinde ve sonrasındaki paragraflarda önce/sonra 0 pt uygulanır**. Başlangıç/bitiş yanlış tanınırsa arayüzden elle seçim yapılabilir.
- Önizlemede üst ve alt boşluklar bitişik paragraflar arasında birleşmez; belgeyi UYAP'ta açarak son kontrol yapın.

## 1.1.1 — gerçek UYAP metin öğeleri ve tablo düzeltmesi

- `<field>` (UYAP form alanı) ve `<space>` öğeleri kaynak `content.xml` ofsetlerinden **görünür metin olarak** aktarılır. Form alanlarının dinamik işlevi aktarılmaz; bunun için uyarı verilir.
- `<table border="borderNone">` / `row` / `cell` / `paragraph` içeriği kaybolmadan düzenlenebilir Word tablosuna ve basılabilir HTML tabloya aktarılır. Kaynakta hücre genişlikleri belirtilmemişse Word otomatik sütun genişliği kullanır; görüntü eşitliği garanti edilmez.
- `<paragraph resolver>` ve `<content resolver>` stil bağları çözümlenir; kaynağın punto, font ve renk bilgileri korunur.
- `documentproperties.xml` ve `sign.sgn` var diye metin okumak engellenmez. Kriptografik imza ve UYAP alan metaverisi aktarılamadığı açıkça bildirilir. İmza geçerliliği yoktur.
- Metin ofsetlerinde açıklanamayan görünür karakter kaybı ve çakışma dosyanın yapısal bozukluğu sayılır ve yine hata verir; yalnız desteklenmeyen biçim özellikleri dönüşümü durdurmaz.
- Kullanıcı UDF dosyasına dokunulmaz; özel AÇIKLAMALAR düzenlemesi UDF → Word/PDF yönünde uygulanmaz.


## v1.1.2 — Metin öncelikli UDF dışa aktarımı

- UDF→Word/PDF sırasında Numbered, NumberType, ListLevel, ListId, family, size ve benzeri birebir eşlenemeyen biçim öznitelikleri yalnız uyarı üretir.
- Bu uyarılar Word/PDF düğmelerini devre dışı bırakmaz. Okunabilen metin her durumda dışa aktarılmaya çalışılır.
- Bozuk ZIP, geçersiz XML, geçersiz UTF-16 ofsetleri ve açıklanamayan içerik çakışmaları yapısal hata olarak reddedilmeye devam eder.


## v1.2.1 — güvenlik sertleştirmesi

- Manifest V3 CSP açıkça sınırlandı; `connect-src 'none'` ile uzantı sayfalarının ağ bağlantısı kapatıldı.
- Manifestte gerekli olmayan izin ve host erişimi bulunmaz.
- ZIP giriş adlarında path traversal, kontrol karakteri ve yerel/merkez başlık uyuşmazlığı reddedilir.
- XML DTD/ENTITY kullanımı reddedilir; XML öğe sayısı ve iç içe geçme derinliği için DoS sınırları uygulanır.
- UDF paragraf, metin parçası ve tablo hücresi sayıları için ek yapısal limitler bulunur.
- İndirilen dosya adlarında Unicode bidi/görünmez yönlendirme karakterleri temizlenir.
- Önizleme metni HTML olarak enjekte edilmez; DOM'a `textContent` ile yazılır.
- Mevcut CRC32, ZIP boyut/açılmış veri, UDF ofset ve DOCX/UDF bütünlük kontrolleri korunur.

## v1.2.0 — UDF liste ve tipografi algılama

UDF → Word/PDF yönünde aşağıdaki UDF paragraf özellikleri artık yalnız uyarı değildir; okuyucu bunları anlamlandırır:

- `Numbered`, `NumberType`, `ListLevel`, `ListId`
- `Bulleted`, `BulletType`
- paragraf düzeyindeki `family` ve `size` (run düzeyi değerler yine önceliklidir)

Numaralı listeler DOCX içinde gerçek Word numbering yapısına (`numbering.xml` + `numPr`) çevrilir. PDF/önizlemede aynı liste türünden görünür işaret üretilir. Bilinen NUMBER_TYPE türleri decimal, harf ve Roma rakamı olarak eşlenir. Bilinmeyen liste türlerinde metin kaybedilmeden en yakın görünüm kullanılır ve uyarı gösterilir.
