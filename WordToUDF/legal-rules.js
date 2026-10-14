/* Legal petition vocabulary (v1.4.2): the label registry, section names,
 * detection patterns, given-name list and label width table used by
 * legal-typography.js. Data only — no conversion logic lives here, so a new
 * label or section synonym is a one-line change in this file.
 */
(() => {
  'use strict';
  /* ---------------------------------------------------------------------
   * Field registry. `to` is the canonical label (undefined = keep source
   * label). `kind` drives formatting and fusion rules.
   * ------------------------------------------------------------------- */
  const FIELD_RULES = [
    {re: /^(?:DOSYA\s+NO|DOSYA\s+NUMARASI|DOSYA\s+ESAS\s+NO|MAHKEME\s+DOSYA\s+NO)$/u, kind: 'case', to: 'DOSYA NO'},
    {re: /^(?:ESAS\s+NO|ESAS\s+NUMARASI)$/u, kind: 'case', esas: true},
    {re: /^(?:KARAR\s+NO|KARAR\s+NUMARASI)$/u, kind: 'karar'},
    {re: /^(?:İHTİYATİ\s+HACZE\s+İTİRAZ\s+EDEN|İHTİYATİ\s+HACİZ\s+KARARINA\s+İTİRAZ\s+EDEN)$/u, kind: 'party', to: 'İTİRAZ EDEN'},
    {re: /^İHTİYATİ\s+HACİZ\s+TALEP\s+EDEN$/u, kind: 'party', to: 'TALEP EDEN'},
    {re: /^(?:İLGİLİ\s+İCRA\s+DOSYASI|İCRA\s+DOSYASI|İLGİLİ\s+İCRA\s+DOSYA\s+NO|İCRA\s+DOSYA\s+NO)$/u, kind: 'file', to: 'İCRA DOSYA NO'},
    {re: /^(?:İLGİLİ\s+İCRA\s+HUKUK\s+DOSYASI|İCRA\s+HUKUK\s+DOSYASI|İCRA\s+HUKUK\s+DOSYA\s+NO)$/u, kind: 'file', to: 'İCRA HUKUK DOSYA NO'},
    {re: /^(?:TEBLİGAT\s+ADRESİ|ADRES|ADRESİ)$/u, kind: 'address', to: 'ADRESİ'},
    {re: /^(?:ADRES\s+VE\s+UETS|VEKİL\s+ADRESİ|VEKİLİ\s+ADRESİ|VEKİLİN\s+ADRESİ|VEKİL\s+ADRES\s+VE\s+UETS)$/u, kind: 'attorney-extra'},
    {re: /^(?:UETS|UETS\s+ADRESİ|UETS\s+NO|E-TEBLİGAT\s+ADRESİ|KEP\s+ADRESİ)$/u, kind: 'uets'},
    {re: /^(?:[A-ZÇĞİÖŞÜ]+\s+){0,3}VEKİL(?:İ|LERİ)$/u, kind: 'attorney'},
    {re: /^(?:MÜDAFİİ|MÜDAFİ|MÜDAFİLERİ)$/u, kind: 'defender'},
    {re: /^(?:DAVACI|DAVALI|DAVACILAR|DAVALILAR|KARŞI\s+DAVACI|KARŞI\s+DAVALI|SANIK|SANIKLAR|ŞÜPHELİ|ŞÜPHELİLER|MÜŞTEKİ|MÜŞTEKİLER|MÜŞTEKİ\s+ŞÜPHELİ|KATILAN|KATILANLAR|BORÇLU|BORÇLULAR|ALACAKLI|ALACAKLILAR|MÜDAHİL|İHBAR\s+OLUNAN|KARŞI\s+TARAF|BAŞVURUCU|ŞİKAYETÇİ|ŞİKÂYETÇİ|SUÇTAN\s+ZARAR\s+GÖREN|MAĞDUR)$/u, kind: 'party'},
    {re: /^KARŞI\s+TARAF(?:\s+(?:DAVACI|DAVALI|SANIK|ŞÜPHELİ|KATILAN|BORÇLU|ALACAKLI|MÜŞTEKİ))?$/u, kind: 'party'},
    {re: /^(?:[A-ZÇĞİÖŞÜ]+\s+){0,3}(?:EDEN|OLUNAN)(?:\s+(?:SANIK|DAVACI|DAVALI|KATILAN|ŞÜPHELİ|BORÇLU|ALACAKLI))?$/u, kind: 'party'},
    {re: /^KONU$/u, kind: 'topic'},
    {re: /^(?:VERGİ\s+NO|VERGİ\s+NUMARASI|VERGİ\s+DAİRESİ|VERGİ\s+DAİRESİ\s+VE\s+NO|TCKN|T\.C\.\s+KİMLİK\s+NO|TC\s+KİMLİK\s+NO|MERSİS\s+NO|TİCARET\s+SİCİL\s+NO|SORUŞTURMA\s+NO|TAKİP\s+DAYANAĞI|TEBLİĞ\s+TARİHİ|ÖDEME\s+EMRİNİN\s+TEBLİĞ\s+TARİHİ|SUÇ|SUÇ\s+TARİHİ|KARAR\s+TARİHİ|TUTUKLAMA\s+T\.?|TUTUKLAMA\s+TARİHİ|DAVA\s+DEĞERİ|HARCA\s+ESAS\s+DEĞER|İTİRAZ\s+EDİLEN\s+KARAR|İSTİNAF\s+EDİLEN\s+KARAR|KARARI\s+VEREN\s+MAHKEME|KARAR\s+VEREN\s+MAHKEME)$/u, kind: 'other'}
  ];
  const SECTION_RULES = [
    {re: /^AÇIKLAMALAR(?:IMIZ|IM)?$/u, kind: 'explanations'},
    {re: /^(?:HUKUKİ\s+SEBEPLER|HUKUKİ\s+NEDENLER|HUKUKİ\s+DAYANAKLAR|YASAL\s+DAYANAKLAR|HUKUKİ\s+SEBEPLER\s+VE\s+DAYANAKLAR)$/u, kind: 'legal-basis'},
    {re: /^(?:HUKUKİ\s+DELİLLER|DELİLLER|DELİLLERİMİZ|DELİL\s+LİSTESİ|DELİLLER\s+VE\s+GEREKÇELER)$/u, kind: 'evidence'},
    {re: /^(?:SONUÇ\s+VE\s+İSTEM|SONUÇ\s+VE\s+TALEP|NETİCE\s+VE\s+İSTEM|NETİCE\s+VE\s+TALEP|NETİCE-İ\s+TALEP|SONUÇ\s+VE\s+İSTEMLER|SONUÇ|İSTEM|TALEP|TALEPLERİMİZ)$/u, kind: 'result'},
    {re: /^(?:EKLER|EK\s+LİSTESİ|EKLER\s+LİSTESİ)$/u, kind: 'attachments'}
  ];

  const COURT_RE = /(?:MAHKEMESİ(?:\s+BAŞKANLIĞINA|['’]?(?:NE|NDE|NİN))?|HÂKİMLİĞİ(?:['’]?(?:NE|NDE|NİN))?|HAKİMLİĞİ(?:['’]?(?:NE|NDE|NİN))?|CUMHURİYET\s+BAŞSAVCILIĞI(?:['’]?(?:NA|NDA|NIN))?|BÖLGE\s+ADLİYE\s+MAHKEMESİ.*DAİRESİ(?:['’]?(?:NE|NDE))?|DAİRESİ(?:['’]?(?:NE|NDE))?|DAİRESİ\s+BAŞKANLIĞINA|MÜDÜRLÜĞÜ(?:['’]?(?:NE|NDE))?)$/u;
  const PETITION_TITLE_RE = /(?:DİLEKÇESİDİR|TALEPLİDİR|İTİRAZDIR|İTİRAZ\s+VE\s+.*TALEPLİDİR|İSTİNAF\s+DİLEKÇESİ|SAVUNMA\s+DİLEKÇESİ|BEYAN\s+DİLEKÇESİ|CEVAP\s+DİLEKÇESİ)/u;
  const INTERNAL_HEADING_RE = /^(?:[IVXLCDM]+|\d+)\.\s+\S/u;
  const SIGNATURE_UPPER_RE = /(?:VEKİLİ|VEKİLLERİ|MÜDAFİİ|MÜDAFİ|(?:^|\s)AV\.|AVUKAT)/u;
  const CLOSING_TAIL_RE = /(?:(?:talep|arz)\s+(?:ve\s+(?:talep|arz)\s+)?(?:ederim|ederiz|olunur)|saygılarımla|saygılarımızla)\s*[.!]?\s*$/iu;
  const CLOSING_SPLIT_RE = /^(.*?)[\s,;]+((?:karar\s+verilmesini|hüküm\s+kurulmasını|kaldırılmasını)\s.*?(?:talep|arz)\s+(?:ve\s+(?:talep|arz)\s+)?(?:ederim|ederiz|olunur)\s*\.?)\s*$/iu;
  const INTRO_RE = /^(?:yukarıda|yukarıdaki|yukarıda\s+arz|açıklanan|arz\s+ve\s+izah|izah\s+edilen|belirtilen)[^;:]{0,220}?(?:sebep|neden|gerekçe)(?:ler)?(?:le|lerle|lerden|lerden\s+dolayı)\b[^;:]*?[;:,]?/iu;
  const DATE_ONLY_RE = /^\s*(?:tarih\s*[:：]?\s*)?(?:\d{1,2}|\.{2}|…)\s*[./]\s*(?:\d{1,2}|\.{2}|…)\s*[./]\s*(?:\d{4}|20\.\.|\.\.\.\.)\s*$/iu;
  const TRAILING_DATE_RE = /\s*(?:\d{1,2}|\.{2}|…)\s*[./]\s*(?:\d{1,2}|\.{2}|…)\s*[./]\s*(?:\d{4}|20\.\.)\s*$/u;
  const LIST_PREFIX_RE = /^\s*(?:EK\s*[-–:]?\s*\d{1,3}\s*[:.)\-–]?|\(?\d{1,3}\s*[.)\-–]|[•·▪●◦○*]|[-–])(?=\s|\t)[\s\t]*/iu;
  const SUB_PREFIX_RE = /^\s*\(?[a-zçğıöşü]\s*\)(?=\s|\t)[\s\t]*/u;

  const LAW_RE = /(?<![\p{L}\p{N}])(?:İİK|HMK|TTK|TCK|CMK|TBK|TMK|İYUK|AYM|SGK|Anayasa|Tebligat\s+Kanunu|Belediye\s+Kanunu|İş\s+Kanunu)\s*m\.?\s*\d+(?:\/[0-9A-Za-zÇĞİÖŞÜçğıöşü-]+)?(?:\s*(?:ve|,|-)\s*\d+(?:\/[0-9A-Za-zÇĞİÖŞÜçğıöşü-]+)?)*/giu;
  const CASE_RE = /(?:Yargıtay\s+(?:\d+\.\s*(?:Hukuk|Ceza)?\s*Dairesi|\d+\.\s*HD|\d+\.\s*CD|HGK|CGK|Ceza\s+Genel\s+Kurulu|Hukuk\s+Genel\s+Kurulu)|(?:İstanbul|Ankara|İzmir|Bursa|Adana|Gaziantep|Diyarbakır|Antalya|Konya|Samsun|Erzurum|Kayseri|Trabzon|Sakarya|Van)\s+Bölge\s+Adliye\s+Mahkemesi\s+\d+\.\s*(?:Hukuk|Ceza)\s+Dairesi|(?:İstanbul|Ankara|İzmir|Bursa|Adana|Gaziantep|Diyarbakır|Antalya|Konya|Samsun|Erzurum|Kayseri|Trabzon|Sakarya|Van)\s+BAM\s+\d+\.\s*(?:HD|CD))[^()\n]{0,140}?\d{4}\/\d+\s*E\.,\s*\d{4}\/\d+\s*K\./giu;
  const RESULT_EMPHASIS_RE = /\b(?:YETKİ\s+İTİRAZININ\s+KABULÜ(?:YLE|NE)?|İMZAYA\s+İTİRAZIN\s+KABULÜ(?:NE)?|İHTİYATİ\s+HACİZ\s+KARARININ\s+MÜVEKKİL\s+ŞİRKET\s+YÖNÜNDEN\s+KALDIRILMASINA|TEMİNAT\s+KARŞILIĞINDA\s+KALDIRILMASINA|GEÇİCİ\s+DURDURULMASINA|DURDURULMASINA|KALDIRILMASINA|BOZULMASINA|TAHLİYESİNE|BERAATİNE|İPTALİNE|KABULÜNE|REDDİNE)\b/gu;

  const INSTITUTION_RE = /(?:^|[^\p{L}])(?:LTD|LİMİTED|AŞ|A\.Ş|ŞTİ|ŞİRKETİ|ŞİRKET|SAN|SANAYİ|TİC|TİCARET|ANONİM|KOLLEKTİF|KOMANDİT|KOOPERATİFİ|HOLDİNG|BANKASI|BANK|SİGORTA|BAKANLIĞI|BAŞKANLIĞI|MÜDÜRLÜĞÜ|BELEDİYESİ|VALİLİĞİ|KAYMAKAMLIĞI|ÜNİVERSİTESİ|VAKFI|DERNEĞİ|SENDİKASI|ODASI|BİRLİĞİ|KURUMU|İDARESİ|HAZİNESİ|HAZİNE|BAROSU|NOTERLİĞİ|GRUP|İNŞAAT|ENERJİ|TEKSTİL|PLASTİK|KİMYA|GIDA|OTOMOTİV|LOJİSTİK|TURİZM|YAYINCILIK|MADENCİLİK|İTHALAT|İHRACAT|PAZARLAMA|ŞUBESİ|MERKEZİ|HASTANESİ|ECZANESİ)(?=$|[^\p{L}])/u;
  // Common Turkish given names. Used only to decide how many trailing words
  // form the surname; unknown names fall back to the conservative last-word rule.
  const GIVEN_NAMES = new Set(('Ahmet Mehmet Mustafa Ali Hüseyin Hasan İbrahim İsmail Osman Yusuf Murat Ömer Ramazan Halil Süleyman Abdullah Mahmut Recep Salih Fatih Kadir Emre Hakan Adem Kemal Yaşar Bekir Musa Metin Orhan Serkan Burak Cemal Erkan Uğur Volkan Gökhan Sinan Tolga Onur Emin Selim Tuncay Levent Kenan Engin Erdal Ercan Ersin Erdem Erol Ferhat Fikret Kaan Kerem Can Cem Barış Berk Baran Arda Alper Aydın Bülent Cengiz Cihan Coşkun Doğan Eyüp Faruk Ferit Furkan Gürkan Hamza Harun Hayati Hikmet Hilmi İlhan İlker İlyas İrfan İsa Kazım Kürşat Lütfi Mesut Mert Muhammed Muharrem Mücahit Necati Nihat Nuri Oğuz Oktay Özcan Özgür Rıza Sadık Sami Sedat Selçuk Serdar Serhat Sezer Sabri Sait Şahin Şükrü Taner Tarık Tayfun Tuncer Turgut Ufuk Umut Ünal Vedat Veli Yakup Yasin Yavuz Yunus Zafer Zeki Ziya Abdurrahman Burhan Cafer Celal Cevdet Davut Erhan Fevzi Hidayet Kamil Kâmil Kudret Mevlüt Nail Necmi Nevzat Nusret Rahmi Rauf Refik Remzi Sabahattin Talat Tahsin Tevfik Yalçın Ender Eren Efe Ege Deniz Aras Alp Atilla Batuhan Berkay Caner Doruk Emir Enes Eray Ertan Ertuğrul Gökay Hakkı Haydar Kubilay Melih Necip Okan Ozan Rasim Sefa Semih Sertaç Taha Tamer Tuğrul Utku Yiğit Zekeriya Selahattin Nurettin Alaattin Bahattin Fahrettin Hayrettin Muhittin Zeynel Mithat Muzaffer Nadir Naci Nazım Niyazi Rüştü Sezai Şevket Ümit Nejat Abdülkadir Abdülkerim Bilal Cuma Dursun Ekrem Emrah Eşref Gazi Güven Hüsnü İhsan Kadri Kasım Kenan Mehmet Nurullah Rıdvan Seyit Şaban Şenol Tuncel Yıldırım Zülfikar Ayşe Fatma Emine Hatice Zeynep Elif Meryem Şerife Sultan Zehra Hanife Merve Havva Zeliha Esra Fadime Özlem Hacer Yasemin Hülya Cennet Kübra Leyla Gülsüm Rabia Melek Dilek Derya Ebru Sevgi Sevim Songül Tuğba Büşra Aysel Ayten Aynur Gül Gülay Gülşen Gülten Hande Hilal İrem Kader Kevser Kezban Nazlı Nermin Nesrin Nihal Nilay Nur Nuray Nurcan Nurhan Pınar Selma Semra Serap Sevda Seda Sibel Şükran Tülay Tülin Ümran Yeliz Yıldız Zerrin Zübeyde Asiye Aslı Aysun Ayşegül Bahar Banu Berna Betül Burcu Canan Ceren Cansu Damla Demet Didem Dilan Duygu Ece Eda Ela Elçin Emel Esin Feride Figen Filiz Funda Gamze Gizem Gökçe Gönül Güler Gülizar Gülsen Hale Hamide Handan İlknur İnci Kadriye Lale Meltem Meral Mine Müge Necla Nehir Neslihan Nevin Nilgün Oya Öznur Pelin Perihan Rukiye Saadet Safiye Sakine Sanem Saniye Selin Selda Sema Sena Seher Serpil Sevil Sinem Şenay Şule Tuba Tuğçe Türkan Ülkü Yağmur Yeşim Zahide Zuhal Nurdan Ayşenur Fatmanur Esma Asuman Beyza Cemile Gülcan Hayriye Huriye Hümeyra Melike Mukaddes Münevver Naciye Nimet Saliha Semiha Süheyla Şengül Vildan Zekiye Zülfiye').split(/\s+/u).map(n => n.toLocaleUpperCase('tr-TR')));

  /* Times-Bold advance widths (1/1000 em) for label width estimation. */
  const BOLD_WIDTHS = {A:722,B:667,C:722,D:722,E:667,F:611,G:778,H:778,I:389,J:500,K:778,L:667,M:944,N:722,O:778,P:611,Q:778,R:722,S:556,T:667,U:722,V:722,W:1000,X:722,Y:722,Z:667,'Ç':722,'Ğ':778,'İ':389,'Ö':778,'Ş':556,'Ü':722,'Â':722,'Î':389,'Û':722,' ':250,'.':250,',':250,'-':333,'/':278,'(':333,')':333,':':333};

  // A request clause ends with a dative verbal noun ("kabulüne", "kaldırılmasına",
  // "değerlendirilmesine") followed by a comma. Used only to SUGGEST splitting
  // one long request into numbered items; never applied without the user.
  const REQUEST_END_RE = /(?:m[ae]s[ıi]n[ae]|kabulüne|reddine|iptaline|tahliyesine|beraatine|tesisine|tespitine|tefrikine|birleştirilmesine)$/iu;

  globalThis.WordToUDFLegalRules = Object.freeze({REQUEST_END_RE, FIELD_RULES, SECTION_RULES, COURT_RE, PETITION_TITLE_RE, INTERNAL_HEADING_RE, SIGNATURE_UPPER_RE, CLOSING_TAIL_RE, CLOSING_SPLIT_RE, INTRO_RE, DATE_ONLY_RE, TRAILING_DATE_RE, LIST_PREFIX_RE, SUB_PREFIX_RE, LAW_RE, CASE_RE, RESULT_EMPHASIS_RE, INSTITUTION_RE, GIVEN_NAMES, BOLD_WIDTHS});
})();
