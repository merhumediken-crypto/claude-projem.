# Tekrarlanabilir kalite denetimi

Kaynak kökünde:

```sh
node tests/logic.test.js
python tests/e2e.py          # CHROMIUM=/yol/chrome ile tarayıcı yolu verilebilir
```

`logic.test.js`: 77 test (v1.4.1'in 5 düzeltme testi; v1.3.2'nin 23 regresyonu, 7'si yeni standarda göre bilinçli olarak revize edildi ve adında REVİZE yazar; 49 WTU kural testi).

`e2e.py`: Chromium içinde DOCX→UDF (hukuk ve Word biçimini koru profilleri), Dumanbey tipi tam dilekçe (ortak sekme, tek DOSYA NO, UETS, satır içi bölümler, gerçek listeler, tarih, imza, önizlemede iki nokta x-konumu eşitliği), UDF→DOCX geri dönüşte gerçek Word listeleri, ZIP/DTD/CRC saldırı reddi ve 1.500 paragraflık belge.

`e2e.py` için Python `playwright`, `python-docx`, `lxml` ve erişilebilir Chromium gerekir. Tarayıcı güvenlik politikası nedeniyle bu ortamdaki Chromium URL gezinmelerini engellediğinden test sayfaları `set_content` ile yüklenip kaynak JS dosyaları aynı sırayla çalıştırılır. Bu yöntem iş mantığı, dönüştürme/indirme ve zip/xml testini yapar; MV3 uzantısının gerçekten yüklenmesini veya UYAP Doküman Editörü kabulünü doğrulamaz. Test, sayfa CSP meta etiketini yalnız test çalışma ortamında kaldırır; dağıtımda CSP korunur.

Örnek Word/PDF uyumsuzlukları ve görsel tablo kaybı farklı test kapsamıdır.
