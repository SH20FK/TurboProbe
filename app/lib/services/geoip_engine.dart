/// High-Speed In-Memory GeoIP, ASN & Multi-Language Location Resolver
/// Provides 3-Tier Resolution: Egress Trace ➔ Local Host GeoIP Range ➔ Deep Linguistic & Emoji Regex

class GeoIpResult {
  final String countryCode; // ISO-2: DE, NL, KZ, etc.
  final String countryName; // Russian: Германия, Нидерланды
  final String? cityName; // Франкфурт, Амстердам
  final String? providerName; // Hetzner, DigitalOcean, OVH, Leaseweb
  final String flagEmoji; // 🇩🇪, 🇳🇱, 🇰🇿

  GeoIpResult({
    required this.countryCode,
    required this.countryName,
    this.cityName,
    this.providerName,
    required this.flagEmoji,
  });

  String get displayName {
    final buffer = StringBuffer();
    buffer.write('$flagEmoji $countryName');
    if (cityName != null && cityName!.isNotEmpty) {
      buffer.write(' ($cityName)');
    }
    if (providerName != null && providerName!.isNotEmpty) {
      buffer.write(' · $providerName');
    }
    return buffer.toString();
  }
}

class GeoIpEngine {
  // Emoji Flag from ISO-2
  static String countryToEmoji(String code) {
    code = code.trim().toUpperCase();
    if (code.length != 2 || code == 'UN') return '🌐';
    try {
      final int r1 = code.codeUnitAt(0) - 65 + 0x1F1E6;
      final int r2 = code.codeUnitAt(1) - 65 + 0x1F1E6;
      return String.fromCharCode(r1) + String.fromCharCode(r2);
    } catch (_) {
      return '🌐';
    }
  }

  // Extract ISO-2 country code from Emoji Flag
  static String? emojiToCountry(String text) {
    final flagMap = {
      '🇩🇪': 'DE', '🇳🇱': 'NL', '🇺🇸': 'US', '🇫🇮': 'FI', '🇸🇪': 'SE',
      '🇫🇷': 'FR', '🇬🇧': 'GB', '🇹🇷': 'TR', '🇯🇵': 'JP', '🇸🇬': 'SG',
      '🇭🇰': 'HK', '🇰🇿': 'KZ', '🇵🇱': 'PL', '🇪🇪': 'EE', '🇱🇻': 'LV',
      '🇱🇹': 'LT', '🇦🇹': 'AT', '🇨🇭': 'CH', '🇮🇹': 'IT', '🇪🇸': 'ES',
      '🇨🇦': 'CA', '🇦🇪': 'AE', '🇮🇱': 'IL', '🇰🇷': 'KR', '🇹🇼': 'TW',
      '🇨🇿': 'CZ', '🇲🇩': 'MD', '🇷🇴': 'RO', '🇧🇬': 'BG', '🇷🇺': 'RU',
      '🇺🇦': 'UA', '🇧🇾': 'BY', '🇬🇪': 'GE', '🇦🇲': 'AM', '🇳🇴': 'NO',
      '🇩🇰': 'DK', '🇮🇳': 'IN', '🇦🇺': 'AU', '🇧🇷': 'BR', '🇮🇪': 'IE',
    };
    for (final entry in flagMap.entries) {
      if (text.contains(entry.key)) return entry.value;
    }
    return null;
  }

  static const Map<String, String> countryNamesRu = {
    'DE': 'Германия', 'NL': 'Нидерланды', 'US': 'США', 'FI': 'Финляндия',
    'SE': 'Швеция', 'FR': 'Франция', 'GB': 'Великобритания', 'UK': 'Великобритания',
    'TR': 'Турция', 'JP': 'Япония', 'SG': 'Сингапур', 'HK': 'Гонконг',
    'KZ': 'Казахстан', 'PL': 'Польша', 'EE': 'Эстония', 'LV': 'Латвия',
    'LT': 'Литва', 'AT': 'Австрия', 'CH': 'Швейцария', 'IT': 'Италия',
    'ES': 'Испания', 'CA': 'Канада', 'AE': 'ОАЭ', 'IL': 'Израиль',
    'KR': 'Южная Корея', 'TW': 'Тайвань', 'CZ': 'Чехия', 'MD': 'Молдова',
    'RO': 'Румыния', 'BG': 'Болгария', 'RU': 'Россия', 'UA': 'Украина',
    'BY': 'Беларусь', 'GE': 'Грузия', 'AM': 'Армения', 'NO': 'Норвегия',
    'DK': 'Дания', 'IN': 'Индия', 'AU': 'Австралия', 'BR': 'Бразилия',
    'IE': 'Ирландия', 'IS': 'Исландия', 'RS': 'Сербия', 'HU': 'Венгрия',
  };

  static const Map<String, String> airportCityNames = {
    'FRA': 'Франкфурт', 'AMS': 'Амстердам', 'HEL': 'Хельсинки', 'ARN': 'Стокгольм',
    'CDG': 'Париж', 'LHR': 'Лондон', 'MAN': 'Манчестер', 'IST': 'Стамбул',
    'SAW': 'Стамбул', 'NRT': 'Токио', 'HND': 'Токио', 'KIX': 'Осака',
    'SIN': 'Сингапур', 'HKG': 'Гонконг', 'WAW': 'Варшава', 'VIE': 'Вена',
    'ZRH': 'Цюрих', 'MXP': 'Милан', 'FCO': 'Рим', 'MAD': 'Мадрид',
    'BCN': 'Барселона', 'DME': 'Москва', 'SVO': 'Москва', 'LED': 'СПб',
    'ALA': 'Алматы', 'NQZ': 'Астана', 'TSE': 'Астана', 'DXB': 'Дубай',
    'EWR': 'Нью-Йорк', 'JFK': 'Нью-Йорк', 'LAX': 'Лос-Анджелес', 'ORD': 'Чикаго',
    'SJC': 'Кремниевая долина', 'IAD': 'Вашингтон', 'MIA': 'Майами', 'SEA': 'Сиэтл',
    'YYZ': 'Торонто', 'YVR': 'Ванкувер', 'DUB': 'Дублин', 'OSL': 'Осло',
  };

  static const Map<String, String> asnProviderMap = {
    '24940': 'Hetzner', '16276': 'OVH', '14061': 'DigitalOcean', '16265': 'Leaseweb',
    '13335': 'Cloudflare WARP', '9198': 'Kazakhtelecom', '48716': 'PS Internet KZ',
    '9121': 'Turkcell', '34984': 'TTNet', '49505': 'Selectel', '9123': 'Timeweb',
    '20473': 'Vultr', '63949': 'Linode / Akamai', '31898': 'Oracle Cloud',
    '16509': 'Amazon AWS', '15169': 'Google Cloud', '8075': 'Microsoft Azure',
    '45102': 'Alibaba Cloud', '51167': 'Contabo', '201814': 'Meverywhere',
  };

  /// Tier 1.5: Offline IP Range & Domain TLD GeoIP Resolver
  static String? resolveHostCountry(String host) {
    host = host.trim().toLowerCase();

    // 1. Domain TLD Check
    if (host.endsWith('.de')) return 'DE';
    if (host.endsWith('.nl')) return 'NL';
    if (host.endsWith('.fi')) return 'FI';
    if (host.endsWith('.se')) return 'SE';
    if (host.endsWith('.fr')) return 'FR';
    if (host.endsWith('.kz')) return 'KZ';
    if (host.endsWith('.tr')) return 'TR';
    if (host.endsWith('.pl')) return 'PL';
    if (host.endsWith('.ua')) return 'UA';
    if (host.endsWith('.ru') || host.endsWith('.su') || host.endsWith('.рф')) return 'RU';
    if (host.endsWith('.uk') || host.endsWith('.co.uk')) return 'GB';
    if (host.endsWith('.jp')) return 'JP';
    if (host.endsWith('.sg')) return 'SG';
    if (host.endsWith('.ee')) return 'EE';
    if (host.endsWith('.lv')) return 'LV';
    if (host.endsWith('.lt')) return 'LT';
    if (host.endsWith('.at')) return 'AT';
    if (host.endsWith('.ch')) return 'CH';
    if (host.endsWith('.it')) return 'IT';
    if (host.endsWith('.es')) return 'ES';
    if (host.endsWith('.cz')) return 'CZ';
    if (host.endsWith('.ro')) return 'RO';
    if (host.endsWith('.bg')) return 'BG';
    if (host.endsWith('.ge')) return 'GE';
    if (host.endsWith('.am')) return 'AM';

    // 2. Common Hosting Subnet Prefixes
    if (host.startsWith('188.119.') || host.startsWith('95.216.') || host.startsWith('95.217.') || host.startsWith('65.108.') || host.startsWith('65.109.')) return 'FI'; // Hetzner FI
    if (host.startsWith('88.198.') || host.startsWith('148.251.') || host.startsWith('144.76.') || host.startsWith('178.63.') || host.startsWith('116.202.') || host.startsWith('116.203.') || host.startsWith('159.69.') || host.startsWith('168.119.')) return 'DE'; // Hetzner DE
    if (host.startsWith('185.220.') || host.startsWith('185.193.') || host.startsWith('141.95.') || host.startsWith('51.15.') || host.startsWith('212.83.')) return 'FR'; // Scaleway / OVH FR
    if (host.startsWith('146.190.') || host.startsWith('167.99.') || host.startsWith('134.209.') || host.startsWith('159.65.') || host.startsWith('188.166.')) return 'NL'; // DigitalOcean AMS
    if (host.startsWith('2.132.') || host.startsWith('2.133.') || host.startsWith('2.134.') || host.startsWith('2.135.') || host.startsWith('92.46.') || host.startsWith('95.56.') || host.startsWith('89.218.')) return 'KZ'; // Kazakhstan
    if (host.startsWith('88.247.') || host.startsWith('176.240.') || host.startsWith('195.175.') || host.startsWith('212.156.')) return 'TR'; // Turkey

    return null;
  }

  /// Tier 2: Deep Multi-Lingual Regex & City / Country Name Extractor
  static String? extractCountryFromName(String text) {
    if (text.isEmpty) return null;

    // 1. Emoji Flag Check
    final emojiMatch = emojiToCountry(text);
    if (emojiMatch != null) return emojiMatch;

    final lower = text.toLowerCase();
    final upper = text.toUpperCase();

    // 2. Russian & English City Names
    if (lower.contains('франкфурт') || lower.contains('frankfurt') || lower.contains('берлин') || lower.contains('berlin') || lower.contains('мюнхен') || lower.contains('munich') || lower.contains('гамбург') || lower.contains('hamburg')) return 'DE';
    if (lower.contains('амстердам') || lower.contains('amsterdam') || lower.contains('роттердам') || lower.contains('rotterdam')) return 'NL';
    if (lower.contains('хельсинки') || lower.contains('helsinki') || lower.contains('тампере') || lower.contains('tampere') || lower.contains('эспоо') || lower.contains('espoo')) return 'FI';
    if (lower.contains('стокгольм') || lower.contains('stockholm') || lower.contains('гётеборг') || lower.contains('gothenburg')) return 'SE';
    if (lower.contains('алматы') || lower.contains('almaty') || lower.contains('астана') || lower.contains('astana') || lower.contains('шымкент') || lower.contains('shymkent') || lower.contains('караганда') || lower.contains('karaganda')) return 'KZ';
    if (lower.contains('стамбул') || lower.contains('istanbul') || lower.contains('анкара') || lower.contains('ankara') || lower.contains('измир') || lower.contains('izmir') || lower.contains('анталья') || lower.contains('antalya')) return 'TR';
    if (lower.contains('варшава') || lower.contains('warsaw') || lower.contains('краков') || lower.contains('krakow') || lower.contains('гданьск') || lower.contains('gdansk') || lower.contains('вроцлав') || lower.contains('wroclaw')) return 'PL';
    if (lower.contains('лондон') || lower.contains('london') || lower.contains('манчестер') || lower.contains('manchester')) return 'GB';
    if (lower.contains('париж') || lower.contains('paris') || lower.contains('марсель') || lower.contains('marseille') || lower.contains('лион') || lower.contains('lyon')) return 'FR';
    if (lower.contains('токио') || lower.contains('tokyo') || lower.contains('осака') || lower.contains('osaka')) return 'JP';
    if (lower.contains('сингапур') || lower.contains('singapore')) return 'SG';
    if (lower.contains('гонконг') || lower.contains('hong kong') || lower.contains('hongkong')) return 'HK';
    if (lower.contains('нью-йорк') || lower.contains('new york') || lower.contains('майами') || lower.contains('miami') || lower.contains('лос-анджелес') || lower.contains('los angeles') || lower.contains('чикаго') || lower.contains('chicago') || lower.contains('сиэтл') || lower.contains('seattle') || lower.contains('вашингтон') || lower.contains('washington') || lower.contains('даллас') || lower.contains('dallas')) return 'US';
    if (lower.contains('москва') || lower.contains('moscow') || lower.contains('спб') || lower.contains('питер') || lower.contains('петербург') || lower.contains('saint petersburg') || lower.contains('новосибирск') || lower.contains('екатеринбург') || lower.contains('казань')) return 'RU';
    if (lower.contains('киев') || lower.contains('kyiv') || lower.contains('kiev') || lower.contains('одесса') || lower.contains('odessa') || lower.contains('львов') || lower.contains('lviv')) return 'UA';
    if (lower.contains('минск') || lower.contains('minsk')) return 'BY';
    if (lower.contains('тбилиси') || lower.contains('tbilisi') || lower.contains('батуми') || lower.contains('batumi')) return 'GE';
    if (lower.contains('ереван') || lower.contains('yerevan')) return 'AM';
    if (lower.contains('вена') || lower.contains('vienna')) return 'AT';
    if (lower.contains('цюрих') || lower.contains('zurich') || lower.contains('женева') || lower.contains('geneva')) return 'CH';
    if (lower.contains('милан') || lower.contains('milan') || lower.contains('рим') || lower.contains('rome')) return 'IT';
    if (lower.contains('мадрид') || lower.contains('madrid') || lower.contains('барселона') || lower.contains('barcelona')) return 'ES';
    if (lower.contains('прага') || lower.contains('prague')) return 'CZ';
    if (lower.contains('бухарест') || lower.contains('bucharest')) return 'RO';
    if (lower.contains('софия') || lower.contains('sofia')) return 'BG';
    if (lower.contains('таллин') || lower.contains('tallinn')) return 'EE';
    if (lower.contains('рига') || lower.contains('riga')) return 'LV';
    if (lower.contains('вильнюс') || lower.contains('vilnius')) return 'LT';
    if (lower.contains('дубай') || lower.contains('dubai')) return 'AE';
    if (lower.contains('сеул') || lower.contains('seoul')) return 'KR';
    if (lower.contains('тайбэй') || lower.contains('taipei')) return 'TW';
    if (lower.contains('торонто') || lower.contains('toronto') || lower.contains('монреаль') || lower.contains('montreal') || lower.contains('ванкувер') || lower.contains('vancouver')) return 'CA';
    if (lower.contains('сидней') || lower.contains('sydney') || lower.contains('мельбурн') || lower.contains('melbourne')) return 'AU';

    // 3. Russian & English Country Names
    if (lower.contains('германи') || lower.contains('germany') || lower.contains('deutschland')) return 'DE';
    if (lower.contains('нидерланд') || lower.contains('голланди') || lower.contains('netherlands') || lower.contains('holland')) return 'NL';
    if (lower.contains('финлянди') || lower.contains('finland') || lower.contains('suomi')) return 'FI';
    if (lower.contains('швеци') || lower.contains('sweden') || lower.contains('sverige')) return 'SE';
    if (lower.contains('казахстан') || lower.contains('kazakhstan') || lower.contains('қазақстан')) return 'KZ';
    if (lower.contains('турци') || lower.contains('turkey') || lower.contains('türkiye')) return 'TR';
    if (lower.contains('польш') || lower.contains('poland') || lower.contains('polska')) return 'PL';
    if (lower.contains('сша') || lower.contains('штаты') || lower.contains('америк') || lower.contains('united states') || lower.contains('usa')) return 'US';
    if (lower.contains('великобритан') || lower.contains('англи') || lower.contains('united kingdom') || lower.contains('england') || lower.contains('britain')) return 'GB';
    if (lower.contains('франци') || lower.contains('france')) return 'FR';
    if (lower.contains('япони') || lower.contains('japan') || lower.contains('nippon')) return 'JP';
    if (lower.contains('росси') || lower.contains('russia') || lower.contains('rus')) return 'RU';
    if (lower.contains('украин') || lower.contains('ukraine')) return 'UA';
    if (lower.contains('беларус') || lower.contains('belarus')) return 'BY';
    if (lower.contains('грузи') || lower.contains('georgia')) return 'GE';
    if (lower.contains('армени') || lower.contains('armenia')) return 'AM';
    if (lower.contains('эстони') || lower.contains('estonia')) return 'EE';
    if (lower.contains('латви') || lower.contains('latvia')) return 'LV';
    if (lower.contains('литв') || lower.contains('lithuania')) return 'LT';
    if (lower.contains('австри') || lower.contains('austria')) return 'AT';
    if (lower.contains('швейцари') || lower.contains('switzerland')) return 'CH';
    if (lower.contains('итали') || lower.contains('italy')) return 'IT';
    if (lower.contains('испани') || lower.contains('spain')) return 'ES';
    if (lower.contains('чехи') || lower.contains('czech')) return 'CZ';
    if (lower.contains('румыни') || lower.contains('romania')) return 'RO';
    if (lower.contains('болгари') || lower.contains('bulgaria')) return 'BG';
    if (lower.contains('норвеги') || lower.contains('norway')) return 'NO';
    if (lower.contains('дани') || lower.contains('denmark')) return 'DK';
    if (lower.contains('канада') || lower.contains('canada')) return 'CA';
    if (lower.contains('оаэ') || lower.contains('эмират') || lower.contains('uae')) return 'AE';
    if (lower.contains('коре') || lower.contains('korea')) return 'KR';
    if (lower.contains('тайван') || lower.contains('taiwan')) return 'TW';
    if (lower.contains('инди') || lower.contains('india')) return 'IN';
    if (lower.contains('австрали') || lower.contains('australia')) return 'AU';
    if (lower.contains('бразили') || lower.contains('brazil')) return 'BR';

    // 4. ISO-2 Code Boundary Regex Matches (e.g. [DE], (NL), _US_, -FI-, |KZ|)
    final isoCodes = [
      'DE', 'NL', 'US', 'FI', 'SE', 'KZ', 'TR', 'PL', 'GB', 'UK', 'FR', 'JP',
      'SG', 'HK', 'RU', 'UA', 'BY', 'GE', 'AM', 'EE', 'LV', 'LT', 'AT', 'CH',
      'IT', 'ES', 'CZ', 'RO', 'BG', 'NO', 'DK', 'CA', 'AE', 'KR', 'TW', 'IN', 'AU', 'BR'
    ];

    for (final code in isoCodes) {
      final reg = RegExp('(^|[\\[\\(\\_\\-\\s\\|\\.\\/])$code([\\s\\]\\)\\_\\-\\d\\|\\.\\/:]|\$)', caseSensitive: false);
      if (reg.hasMatch(upper)) {
        return code == 'UK' ? 'GB' : code;
      }
    }

    return null;
  }

  /// Master Resolver: combines Tier 1 (Trace), Tier 1.5 (Host GeoIP), Tier 2 (Name Parser)
  static GeoIpResult resolve({
    String? traceLoc,
    String? traceColo,
    String? traceAsn,
    String? traceIp,
    required String host,
    required String nodeName,
  }) {
    String? countryCode = traceLoc;
    String? cityName;
    String? providerName;

    // 1. Trace Level (If Trace succeeded)
    if (countryCode != null && countryCode.isNotEmpty && countryCode != 'XX' && countryCode != 'UN') {
      countryCode = countryCode.toUpperCase();
      if (traceColo != null && traceColo.isNotEmpty) {
        cityName = airportCityNames[traceColo.toUpperCase()];
      }
      if (traceAsn != null && traceAsn.isNotEmpty) {
        providerName = asnProviderMap[traceAsn.replaceAll(RegExp(r'\D'), '')];
      }
    }

    // 2. Level 1.5: Host Domain TLD & GeoIP Range Check
    if (countryCode == null || countryCode.isEmpty || countryCode == 'UN') {
      countryCode = resolveHostCountry(host);
    }

    // 3. Level 2: Comprehensive Multi-lingual & Emoji Regex
    if (countryCode == null || countryCode.isEmpty || countryCode == 'UN') {
      countryCode = extractCountryFromName(nodeName);
    }

    // Fallback: UN (Unknown)
    countryCode = countryCode ?? 'UN';
    final flag = countryToEmoji(countryCode);
    final countryName = countryNamesRu[countryCode] ?? (countryCode == 'UN' ? 'Неизвестно' : countryCode);

    return GeoIpResult(
      countryCode: countryCode,
      countryName: countryName,
      cityName: cityName,
      providerName: providerName,
      flagEmoji: flag,
    );
  }
}
