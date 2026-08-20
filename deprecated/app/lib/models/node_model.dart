class NodeModel {
  final String id;
  final String rawUri;
  final String protocol;
  final String name;
  final String server;
  final int port;
  final String? security;
  final String? sni;
  final String? type;
  final String? countryCode;
  final String? countryName;
  final String? flagEmoji;
  final String? isp;
  final bool isAlive;
  final int pingMs;
  final int jitterMs;
  final double packetLoss;
  final int score;
  final String? errorMsg;

  // RU Region Specific Badges & Security
  final bool unlockYouTube;
  final bool unlockDiscord;
  final bool unlockOpenAI;
  final bool unlockTelegram;
  final bool unlockInstagram;
  final bool isTSPUResistant;

  // Author Mechanics Fields
  final double speedMbps;
  final String? streamBandGrade; // '4K HDR', '1080p 60fps', '720p HD'
  final bool isTSPUThrottled; // DPI Pulse-Wave dropped/reset
  final bool isCleanIp; // Egress Cleanliness (no Cloudflare challenge/block)
  final String? egressIp; // True exit IP from Cloudflare Anycast
  final bool isDuplicate; // Host Fingerprint Deduplication
  final String? duplicateOfName;

  // 🌟 6 New Killer Mechanics
  final bool isResurrected; // Port-Hopper resurrection
  final int? resurrectedPort;
  final String? dpiDiagnosis; // 'Блокировка по IP', 'Блокировка по SNI', 'DPI L7 Drop', 'Хост выключен', 'Чистое соединение'
  final bool isGamingReady; // Gaming Latency & MTU test
  final int pathMtu; // e.g. 1420

  NodeModel({
    required this.id,
    required this.rawUri,
    required this.protocol,
    required this.name,
    required this.server,
    required this.port,
    this.security,
    this.sni,
    this.type,
    this.countryCode,
    this.countryName,
    this.flagEmoji,
    this.isp,
    this.isAlive = false,
    this.pingMs = 0,
    this.jitterMs = 0,
    this.packetLoss = 0.0,
    this.score = 0,
    this.errorMsg,
    this.unlockYouTube = false,
    this.unlockDiscord = false,
    this.unlockOpenAI = false,
    this.unlockTelegram = false,
    this.unlockInstagram = false,
    this.isTSPUResistant = false,
    this.speedMbps = 0.0,
    this.streamBandGrade,
    this.isTSPUThrottled = false,
    this.isCleanIp = true,
    this.egressIp,
    this.isDuplicate = false,
    this.duplicateOfName,
    this.isResurrected = false,
    this.resurrectedPort,
    this.dpiDiagnosis,
    this.isGamingReady = false,
    this.pathMtu = 1420,
  });

  factory NodeModel.fromJson(Map<String, dynamic> json) {
    return NodeModel(
      id: json['id'] as String? ?? '',
      rawUri: json['raw_uri'] as String? ?? '',
      protocol: json['protocol'] as String? ?? 'unknown',
      name: json['name'] as String? ?? 'Node',
      server: json['server'] as String? ?? '',
      port: (json['port'] as num?)?.toInt() ?? 443,
      security: json['security'] as String?,
      sni: json['sni'] as String?,
      type: json['type'] as String?,
      countryCode: json['country_code'] as String?,
      countryName: json['country_name'] as String?,
      flagEmoji: json['flag_emoji'] as String? ?? '🌐',
      isp: json['isp'] as String?,
      isAlive: json['is_alive'] as bool? ?? false,
      pingMs: (json['ping_ms'] as num?)?.toInt() ?? 0,
      jitterMs: (json['jitter_ms'] as num?)?.toInt() ?? 0,
      packetLoss: (json['packet_loss'] as num?)?.toDouble() ?? 0.0,
      score: (json['score'] as num?)?.toInt() ?? 0,
      errorMsg: json['error_msg'] as String?,
      unlockYouTube: json['unlock_youtube'] as bool? ?? false,
      unlockDiscord: json['unlock_discord'] as bool? ?? false,
      unlockOpenAI: json['unlock_openai'] as bool? ?? false,
      unlockTelegram: json['unlock_telegram'] as bool? ?? false,
      unlockInstagram: json['unlock_instagram'] as bool? ?? false,
      isTSPUResistant: json['is_tspu_resistant'] as bool? ?? false,
      speedMbps: (json['speed_mbps'] as num?)?.toDouble() ?? 0.0,
      streamBandGrade: json['stream_band_grade'] as String?,
      isTSPUThrottled: json['is_tspu_throttled'] as bool? ?? false,
      isCleanIp: json['is_clean_ip'] as bool? ?? true,
      egressIp: json['egress_ip'] as String?,
      isDuplicate: json['is_duplicate'] as bool? ?? false,
      duplicateOfName: json['duplicate_of_name'] as String?,
      isResurrected: json['is_resurrected'] as bool? ?? false,
      resurrectedPort: (json['resurrected_port'] as num?)?.toInt(),
      dpiDiagnosis: json['dpi_diagnosis'] as String?,
      isGamingReady: json['is_gaming_ready'] as bool? ?? false,
      pathMtu: (json['path_mtu'] as num?)?.toInt() ?? 1420,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'raw_uri': rawUri,
      'protocol': protocol,
      'name': name,
      'server': server,
      'port': port,
      'security': security,
      'sni': sni,
      'type': type,
      'country_code': countryCode,
      'country_name': countryName,
      'flag_emoji': flagEmoji,
      'isp': isp,
      'is_alive': isAlive,
      'ping_ms': pingMs,
      'jitter_ms': jitterMs,
      'packet_loss': packetLoss,
      'score': score,
      'error_msg': errorMsg,
      'unlock_youtube': unlockYouTube,
      'unlock_discord': unlockDiscord,
      'unlock_openai': unlockOpenAI,
      'unlock_telegram': unlockTelegram,
      'unlock_instagram': unlockInstagram,
      'is_tspu_resistant': isTSPUResistant,
      'speed_mbps': speedMbps,
      'stream_band_grade': streamBandGrade,
      'is_tspu_throttled': isTSPUThrottled,
      'is_clean_ip': isCleanIp,
      'egress_ip': egressIp,
      'is_duplicate': isDuplicate,
      'duplicate_of_name': duplicateOfName,
      'is_resurrected': isResurrected,
      'resurrected_port': resurrectedPort,
      'dpi_diagnosis': dpiDiagnosis,
      'is_gaming_ready': isGamingReady,
      'path_mtu': pathMtu,
    };
  }
}
