# UYAP kabul kontrol listesi

Otomatik testler UDF'nin yapısını (ZIP, XML, metin ofsetleri) doğrular; **UYAP Doküman Editörü'nde nasıl göründüğünü doğrulayamaz.** Yeni bir sürümden sonra ya da yeni tür bir dilekçede, ilk UDF'yi UYAP Doküman Editörü'nde açıp aşağıdaki listeyi bir kez gözle kontrol edin. Bir madde tutmazsa ekran görüntüsüyle bildirin; hangi kuralın düzeltileceği buradan anlaşılır.

## Açılış

- [ ] Dosya hata vermeden açılıyor; “bozuk / desteklenmeyen biçim” uyarısı yok.
- [ ] Bütün metin var: ilk ve son paragraf, imza ve EKLER eksiksiz (dönüşüm raporundaki paragraf sayısıyla karşılaştırın).
- [ ] Türkçe karakterler (ı, İ, ş, ğ, ç, ö, ü, â) doğru.

## Sayfa ve yazı

- [ ] A4 dikey; kenar boşlukları 1,5 cm.
- [ ] Yazı tipi Times New Roman 12 pt (Cambria/Calibri değil).
- [ ] Mahkeme başlığı ortalı, kalın, 14 pt, altı çizili değil.

## Künye

- [ ] Bütün iki noktalar (DOSYA NO, taraflar, VEKİLİ, KONU, AÇIKLAMALAR, SONUÇ VE İSTEM, EKLER) aynı dikey sütunda.
- [ ] Etiketin alt çizgisi sekme boşluğunda kesilmeden iki noktaya kadar sürüyor; değerin altı çizili değil.
- [ ] Uzun değer (adres, KONU) alt satıra girintisiz geçiyor ve iki nokta sütununu bozmuyor.
- [ ] VEKİLİ satırı doğru: `Av. Ad SOYAD (UETS: …)`; UETS girilmemiş vekilde numara veya boş `(UETS)` yok.

## Gövde ve sonuç

- [ ] AÇIKLAMALAR paragrafları iki yana yaslı, ilk satır girintili, satır aralığı seçtiğiniz gibi (varsayılan 1,5).
- [ ] Ara başlıklar (I., II., A) …) gövde girintisi almamış.
- [ ] SONUÇ VE İSTEM talepleri 1., 2., 3. diye sıralı; **numara ilk sözcüğün üstüne binmiyor** (ör. `114.10.2026` gibi görünmüyor) ve ikinci satırlar metin hizasından devam ediyor.
- [ ] Tek kapanış cümlesi var (“Karar verilmesini … talep ederim/ederiz”); ikinci bir kapanış eklenmemiş; tarih yalnız bir kez, cümlenin sonunda.
- [ ] İmza bloğu sağda, kalın; EKLER (varsa) ayrı numaralı liste.

## Düzenleme ve gönderim

- [ ] Elle düzenlediğiniz paragraflar (önizlemede işaretliydi) UDF'de de aynı.
- [ ] Belge UYAP'ta düzenlenip kaydedilebiliyor; e-imza ile imzalanıp gönderim ekranına eklenebiliyor.
- [ ] Yazdırma önizlemesinde sayfa kırılımı kabul edilebilir (önizleme yaklaşık yerleşimdir; birebir garanti edilmez).

## UDF → Word / PDF yönü (kullanılıyorsa)

- [ ] UYAP'tan alınan bir UDF, Word'de metin kaybı olmadan açılıyor; numaralı listeler gerçek Word listesi.
- [ ] PDF olarak kaydedilen çıktıda üstbilgi/altbilgi (varsa) ve tablolar okunabilir.
