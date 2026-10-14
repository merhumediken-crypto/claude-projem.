# WordToUDF 1.7.0 güvenlik notları

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
- 1.5.0 ayarları (vekil profili, başka vekiller, seçenekler) ve şablon taslağı yalnız sayfanın yerel `localStorage` alanındadır. Dışa aktarma kullanıcının kendi indirdiği bir JSON dosyasıdır; içe aktarma 256 KB ile sınırlıdır ve yalnız bilinen alanlar (`settings.sanitize`) kabul edilir.
- Elle düzeltme menüsü ve denetim mesajları `textContent` ile yazılır.
- Toplu dönüşüm en fazla 100 dosya alır; her dosya tek dosyadaki sınır ve doğrulamalardan geçer.
- Web uygulaması (PWA) kipinde `sw.js` yalnız **aynı kaynaktaki** uygulama dosyalarını önbelleğe alır (`url.origin !== location.origin` ise karışmaz); belge içeriği ağ üzerinden hiçbir yere gönderilmez. Sayfaların CSP'si (`connect-src 'none'`) değişmedi. Chrome uzantısı service worker'ı kaydetmez.

- 1.6.0 yapıştırma: panodaki HTML en fazla 4 MB, düz metin 2 MB; HTML `DOMParser` ile etkisiz belgeye ayrıştırılır (betik çalışmaz, görsel/bağlantı yüklenmez), `script/style/iframe/object` vb. atlanır, içerik yalnız `textContent`/`value` ile gösterilir.
- 1.6.1: yapıştırılan Word/Google HTML'indeki satır içi stiller ayrıştırmadan önce etkisiz hâle getirilir; sayfa CSP'si hiçbir ihlal kaydı üretmez (`tests/e2e.py` sayfaları CSP açık HTTP sunucusundan yükleyerek doğrular).
- 1.7.0 arayüz: HTML sayfaları `tools/pages.py` ile üretilir ve üretim sırasında satır içi `style="…"` veya satır içi `<script>` bulunursa durur; CSP'ye `unsafe-inline` eklenmedi. Simgeler aynı sayfadaki SVG setinden (`<use href="#…">`) gelir, dış kaynak yüklenmez. Tema seçimi (`wordtoudf.theme`: auto/light/dark) yalnız yerel depolamada tutulur; okunan değer bu üç değerden biri değilse yok sayılır. Manifest izinleri değişmedi (`permissions: []`, `host_permissions: []`).

Bu kontroller dosyanın hukuki veya içerik doğruluğunu garanti etmez; yalnızca dönüştürme yüzeyini sertleştirir.
