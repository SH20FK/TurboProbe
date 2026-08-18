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
