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

  // RU Region Specific Badges
  final bool unlockYouTube;
  final bool unlockDiscord;
  final bool unlockOpenAI;
  final bool unlockTelegram;
  final bool unlockInstagram;
  final bool isTSPUResistant;

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
    };
  }
}
