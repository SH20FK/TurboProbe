class TestConfigModel {
  String targetUrl;
  int concurrency;
  int timeoutMs;
  bool enableBurst;
  bool enableGeoIp;

  TestConfigModel({
    this.targetUrl = 'http://cp.cloudflare.com/generate_204',
    this.concurrency = 50,
    this.timeoutMs = 2500,
    this.enableBurst = true,
    this.enableGeoIp = true,
  });

  factory TestConfigModel.fromJson(Map<String, dynamic> json) {
    return TestConfigModel(
      targetUrl: json['target_url'] as String? ?? 'http://cp.cloudflare.com/generate_204',
      concurrency: (json['concurrency'] as num?)?.toInt() ?? 50,
      timeoutMs: (json['timeout_ms'] as num?)?.toInt() ?? 2500,
      enableBurst: json['enable_burst'] as bool? ?? true,
      enableGeoIp: json['enable_geoip'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'target_url': targetUrl,
      'concurrency': concurrency,
      'timeout_ms': timeoutMs,
      'enable_burst': enableBurst,
      'enable_geoip': enableGeoIp,
    };
  }
}
