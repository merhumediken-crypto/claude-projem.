# WordToUDF 1.4.0 – Mimari

## Dönüşüm hattı

1. **zip.js – Paket sınırı:** DOCX/UDF ZIP güvenliği, boyut/CRC/path traversal kontrolleri.
2. **docx.js – Kaynak gerçekliği:** WordprocessingML metni, doğrudan run biçimleri, paragraf özellikleri, stil kalıtımı, sekmeler ve numaralandırma okunur. Bu katman hukuki anlam tahmini yapmaz.
3. **normalize.js – Kullanıcı kuralları:** A4/1,5 cm kenar; AÇIKLAMALAR gövdesinde 1,25 cm ilk satır, 1,5 satır (ayarlanabilir), iki yana yaslama, 0,15 cm önce/sonra. `RULES` ortak sekme durağının (6,0 cm) ve satır aralığının tek kaynağıdır. Ara Roma/rakam başlıkları gövde paragrafından ayrılır.
4. **legal-typography.js – Semantik rol motoru:** Mahkeme başlığı, dilekçe türü, künye, ana başlık, ara başlık, açıklama gövdesi, sonuç maddesi, imza bloğu ve ekler ayrı rollere ayrılır. Rol motoru kapatılabilir.
5. **udf.js – Seri hale getirme:** Rol/biçim bilgisi UDF 1.8 XML özelliklerine dönüştürülür; ofsetler doğrulanır. UYAP örnekleriyle uyumlu olarak `resolver="hvl-default"` yazılır.
6. **workspace.js – Önizleme/denetim:** Kullanıcı profil seçer, rol istatistiklerini ve dönüşüm uyarılarını görür, ardından UDF üretilir.

## Temel tasarım ilkeleri

- **Kaynağı önce koru:** DOCX ayrıştırıcı biçimi tahmin ederek değiştirmez.
- **Semantik müdahaleyi ayrı tut:** Dilekçe tipolojisi ayrı ve kapatılabilir katmandır.
- **Bağlama göre imza tespiti:** `Av.` veya `Vekili` tek başına imza bloğu sayılmaz. İmza yalnız kapanış cümlesinden sonra ve EKLER'den önce aranır.
- **Mahkeme başlığında alt çizgi yok:** Hukuk profili kaynakta yanlışlıkla altı çizili olsa bile mahkeme/başsavcılık başlığında alt çizgiyi kaldırır.
- **Ortak etiket satırı (1.4.0):** Künye ve bölüm etiketleri `ETİKET<TAB>: değer` biçiminde tek paragraftır; bütün iki noktalar `RULES.colonTabCm` sekme durağındadır. Etiket ve iki nokta kalın-altı çizili, sekme altı çizgisiz, değer normal; uzun değer girintisiz sarılır.
- **AÇIKLAMALAR ara başlıkları gövde değildir:** 1,25 cm ilk satır girintisi ara başlıklara uygulanmaz; yalnız gövdeye uygulanır.
- **Karar ve kanun atıfları paragraf geometrisinden bağımsızdır:** Run düzeyinde karar künyesi kalın-italik, kanun/madde atfı italik olabilir.
- **UDF yazıcı semantik bilmez:** Yalnız verilen belge modelini güvenli UDF'ye çevirir; böylece katmanlar ayrı test edilir.

## Regresyon kabul kriterleri

- Mahkeme adı: center + bold + 14 pt + underline=false.
- Künye içindeki avukat adı: sağa hizalanmaz.
- Gerçek son imza bloğundaki avukat adı: sağa hizalı + kalın.
- AÇIKLAMALAR gövdesi: justify + 35.433 pt first-line + 4.252 pt before/after + line 1.5 (1,0 seçilebilir).
- AÇIKLAMALAR içindeki `I.`, `II.` vb. başlık: left + first-line 0; body girintisi uygulanmaz.
- SONUÇ VE İSTEM maddeleri: gerçek UDF listesi (ListId 1), 18 pt asılı girinti; seçili kritik talepler kalın. EKLER ayrı liste (ListId 2).
- UDF `startOffset/length` zinciri görünür içeriğin tamamını kesintisiz kapsar.

## 1.3.2 ek kalite kuralları

- Word biçimini koru seçeneğinde normalize katmanı kaynak paragraf özelliklerini değiştirmez; Word sayfa boşlukları varsa kullanılır.
- Künye birleştirme ardışık farklı alan etiketlerini birleştirmez. Hukuk profilinde değerler daima normal ağırlıklı gösterilir; diğer kaynak yazı tipi özellikleri olabildiğince korunur. DOSYA/KARAR eşleşmesi bilinçli tek satır çiftidir.
- Atıf vurgulama bütün paragrafta arama yapar; Word run sınırını koruyarak eşleşen alt parçaları biçimlendirir.
- İmza tespiti sonuç/kapanış alanıyla, satır uzunluğuyla ve noktalama denetimiyle sınırlandırılır.
- Eşzamanlı dosya açılması ve geçersiz bölüm seçimi durumunda eski sonuç indirilemez.
- Birim testleri ve gerçek Chromium motorunda dönüştürme testleri `tests/` içindedir.

## 1.4.0 semantik dilekçe modeli

`legal-typography.js` üç aşamada çalışır:

1. **Künye aşaması** (AÇIKLAMALAR'a veya ilk bölüm başlığına kadar): `FIELD_RULES` kayıt tablosu etiketi tanır, kanonik kısa adını ve türünü (`case`, `karar`, `party`, `attorney`, `address`, `uets`, `attorney-extra`, `file`, `topic`, `other`) verir. Ayrı satırdaki değerler, devam satırları, DOSYA/KARAR çifti ve vekil adres/UETS satırları birleştirilir; satırlar `fieldRows()` ile tek biçimde üretilir.
2. **Bölüm aşaması:** `SECTION_RULES` AÇIKLAMALAR, HUKUKİ SEBEPLER, HUKUKİ DELİLLER, SONUÇ VE İSTEM ve EKLER eş adlarını tanır. Sonuç bölümü giriş / talepler / kapanış / tarih / imza kuyruğu olarak ayrıştırılır; talepler ve ekler `list` modeline (`{kind:'number', id, level, raw:'NUMBER_TYPE_NUMBER_DOT'}`) dönüştürülür.
3. **Rol aşaması:** mahkeme başlığı, dilekçe türü, ara başlık, açıklama gövdesi ve imza rolleri atanır; atıf biçimleri (kanun italik, karar künyesi kalın-italik) etiket run'larına dokunmadan uygulanır.

Her metin değişikliği `statistics.changes` içine `{type, before, after}` olarak yazılır; `statistics.integrity` kaynak ve çıktı sözcüklerini karşılaştırır. `udf.js` liste modelini `Numbered/NumberType/ListLevel/ListId` paragraf özniteliklerine çevirir (ListLevel 1 tabanlı); `udf-reader.js` + `docx-writer.js` her listenin en düşük düzeyini Word düzey 0 kabul ederek geri dönüştürür.
