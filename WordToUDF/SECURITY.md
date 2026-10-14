# WordToUDF 1.4.0 güvenlik notları

- Manifest V3; host izni ve genişletilmiş tarayıcı izni yoktur.
- Ağ erişimi kapalıdır (`connect-src 'none'`); uzaktan script/kod kullanılmaz.
- DOCX/UDF en fazla 24 MB ZIP kabul edilir; ZIP giriş sayısı ve açılmış toplam veri sınırlıdır.
- ZIP path traversal, kontrol karakterli giriş adları, şifreli arşivler, ZIP64 ve yerel/merkez başlık uyuşmazlıkları reddedilir.
- ZIP CRC32 doğrulanır.
- XML DTD/ENTITY reddedilir; XML öğe sayısı ve iç içe geçme derinliği sınırlanır.
- UDF metin ofsetleri doğrulanır; çakışan veya açıklanamayan görünür metin reddedilir.
- Önizlemede kullanıcı metni `textContent` ile yazılır; HTML olarak yürütülmez.
- İndirilen dosya adlarında kontrol, bidi ve görünmez yönlendirme karakterleri temizlenir.
- Elektronik imza kriptografik olarak başka formata taşınmaz.
- 1.4.0'daki isteğe bağlı vekil UETS listesi yalnız uzantı sayfasının yerel `localStorage` alanında tutulur; Chrome izni gerektirmez, hiçbir yere gönderilmez ve otomatik doldurulmaz.

Bu kontroller dosyanın hukuki veya içerik doğruluğunu garanti etmez; yalnızca dönüştürme yüzeyini sertleştirir.
