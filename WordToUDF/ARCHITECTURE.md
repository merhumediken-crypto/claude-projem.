# WordToUDF 1.8.0 – Mimari

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

## 1.5.0 modül düzeni

```
zip.js ─ docx.js ─┐
                  ▼
settings.js ─► pipeline.js: normalize.js → legal-typography.js (+ legal-rules.js) → edits.js → checks.js → udf.js → zip.js
                  ▲                                     │
templates.js ─────┘                                     └► docx-writer.js (düzenlenmiş Word)
preview.js: ortak A4 önizleme (workspace.html, templates.html)
```

- **settings.js** — vekil profili, başka vekiller, liste/satır/tarih/talep-ayırma seçenekleri. Varsayılan vekil yalnız burada yazılıdır. `sanitize()` her girdiyi (eski kayıt, içe aktarılan JSON) bilinen alanlara indirger.
- **legal-rules.js** — yalnız veri: `FIELD_RULES`, `SECTION_RULES`, algılama düzenli ifadeleri, `REQUEST_END_RE`, ad listesi, kalın harf genişlikleri. Yeni etiket veya eş anlamlı bölüm adı tek satırla buraya eklenir.
- **legal-typography.js** — kural motoru. 1.5.0'da eklenenler: `requestCuts()` / talep ayırma (yalnız `splitRequests` açıkken uygular, kapalıyken `statistics.splittableRequests` ile önerir), `blockKeys()` / `applyOverrides()` (metne bağlı anahtarla elle düzen düzeltmesi; metin değişmez).
- **edits.js** — elle paragraf düzenlemeleri: tür (talep/ek maddesi dahil), hizalama, yazı, girinti/aralık, metin, sil/birleştir/boş satır/sayfa sonu. Anahtar = `<sıra>|<ilk 80 karakter>` (otomatik kurallardan sonraki metin), böylece ayar değişince düzenleme kaybolmaz. Metin kipindeki listeler her uygulamada yeniden numaralanır; girdi blokları asla yerinde değiştirilmez.
- **editor-ui.js** — düzenleme paneli, çoklu seçim, geri al; dönüştürme ve şablon sayfası ortak kullanır. Kullanıcı metni yalnız `textContent`/`value` ile yazılır.
- **checks.js** — son blok modelini okur, hiçbir şeyi değiştirmez; `{level, code, message}` listesi döndürür.
- **pipeline.js** — `typeset()`, `toUdf()` (yaz → doğrula → zip → aç → yeniden doğrula), `batch()` (hatalı dosya diğerlerini durdurmaz).
- **templates.js** — form alanlarından *kaynak paragraflar* üretir; bunlar Word'den gelen paragraflarla aynı hattan geçer. Boş alan `…` olarak kalır.
- **sw.js / app.webmanifest / index.html** — yalnız web uygulaması (PWA) kipinde; yalnız kendi kaynağındaki dosyaları önbelleğe alır.

### Test katmanları

1. `tests/logic.test.js` — kural birimleri (Node, bağımlılıksız).
2. `tests/golden.test.js` + `tests/fixtures/*.json` — isimleri değiştirilmiş gerçek dilekçe yapıları; çıktı satır satır (rol + metin) ve denetim hataları beklenen değerle karşılaştırılır. Bilinçli kural değişikliğinden sonra `--update` ile yenilenir ve fark gözden geçirilir.
3. `tests/e2e.py` — Chromium'da gerçek sayfa: DOCX→UDF, telefon görünümü, elle düzeltme, DOCX çıktısı, ayar aktarımı, toplu dönüşüm, şablonlar, PWA dosya listesi, güvenlik reddi testleri.

## 1.6.0 — yapıştırma girişi

`paste.js` ikinci bir kaynak okuyucudur (DOCX için `docx.js`): pano `text/html` + `text/plain` → kaynak tanıma (`detect`) → kaynağa özgü onarım (`textToBlocks` / `htmlToBlocks`) → `analyze` (hangi dilekçe parçaları var) → `assemble` (eksikleri yalnız form/ayar değerleriyle ekler) → normal hat (`pipeline.typeset`). HTML, `DOMParser` ile etkisiz bir belgeye ayrıştırılır; yalnız okunur, sayfaya eklenmez. Metin işleyiciler DOM gerektirmez ve Node testlerinde doğrudan sınanır.

## 1.7.0 — arayüz katmanı

```
tools/pages.py ─► workspace.html · templates.html · reverse.html · index.html
   ├ tools/pages/sprite.svg          (ortak SVG simge seti)
   ├ tools/pages/<sayfa>.body.html   (sayfaya özgü gövde)
   └ ortak <head> (CSP, workspace.css, theme.js) + üst çubuk + sürüm (manifest.json)
```

- **tools/pages.py** — dört sayfanın başlığını, üst çubuğunu ve simge setini tek kaynaktan üretir; satır içi stil/betik bulursa durur. Üretilen HTML elle düzenlenmez.
- **workspace.css** — tasarım sistemi: renk/boşluk/gölge belirteçleri (açık ve koyu), bileşenler (kart, düğme, form, sekme, rozet, önizleme, düzenleme paneli), telefon düzeni, erişilebilirlik. Adım numaraları CSS sayacıyla görünen kartlardan üretilir. Dilekçe kâğıdı (`.paper`) her temada beyazdır.
- **theme.js** — `<head>` içinde, ilk boyamadan önce `data-theme` uygular (yanıp sönme olmaz); üst çubuktaki düğme Otomatik → Açık → Koyu döngüsünü yapar.
- **Konum koruma** — `workspace.js` `holdPosition()`: yeniden çizimden önce değiştirilen kontrolün (yoksa kartının) ekrandaki yerini ölçer, sonra farkı kaydırarak geri verir; üstteki rapor/denetim listeleri yeniden kurulsa da kontrol yerinde kalır. `editor-ui.js` düzenleme panelini yeniden kurarken panelin kaydırma konumunu ve odaktaki düğmeyi (`data-ctl` anahtarıyla) korur.

## 1.8.0 — kelime/cümle biçimi, ekleme, taşıma

- **edits.js** düzenleme nesnesine üç alan ekler: `marks` (`[{text, at, bold|italic|underline|strike}]`: işaretlenen metin ve paragraftaki yaklaşık yeri), `addAfter` (`[{id, text, role}]`: kullanıcının eklediği paragraflar; anahtarları `<üst anahtar>#+<id>`, kendi düzenlemeleri olabilir) ve `move` (görünen paragraflar arasında kaç sıra). Belge geneli kurallar `'*doc'` anahtarındadır: `{marks: [{text, caseSensitive, wholeWord, …}], replace: [{from, to, …}]}`.
- Uygulama sırası: anahtarlar dizgi sonrası metinden hesaplanır → belge geneli değiştirme (yalnız dizgi metnine, kullanıcının yazdığına değil) → tür → metin → paragraf biçimi → belge geneli biçim → paragrafa özgü biçim (en son, en özel olan kazanır) → eklenen paragraflar → taşıma → yeniden numaralandırma.
- Biçim metinle bulunur: `findMatches()` (Türkçe katlama: `toLocaleLowerCase('tr-TR')`, uzunluk değişirse büyük/küçük harf duyarlı aramaya düşer), paragrafta en yakın geçiş seçilir. Bulunamayan biçim `lost` listesine girer; `pipeline.js` bunu denetime uyarı olarak ekler.
- `sentences()` Türkçe hukuk metni için cümle sınırlarını verir (kısaltma listesi, iki basamaklı sıra sayısı, baş harf, tırnak).
- **preview.js** her metin parçasına `data-o` (paragraf metnindeki ofset) yazar; **editor-ui.js** tarayıcı seçimini bu ofsetlerle paragraf metnine çevirir ve biçimden sonra aynı metni yeniden seçer.
- **docx.js** uyarılarına `minor` alanı eklendi: yalnız görünümü etkileyenler (karakter aralığı, efektler, A4 dışı kâğıt, küçük büyük harf) indirme onayı istemez.
