import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../models/node_model.dart';
import '../models/test_config_model.dart';

class DartProbeEngine {
  bool _isCancelled = false;

  void stop() {
    _isCancelled = true;
  }

  static Future<List<NodeModel>> parseInput(String input) async {
    input = input.trim();
    if (input.isEmpty) return [];

    final rawLines = _extractLines(input);
    final List<String> urlList = [];
    final List<String> directLines = [];

    for (final line in rawLines) {
      if (line.startsWith('http://') || line.startsWith('https://')) {
        urlList.add(line);
      } else {
        directLines.add(line);
      }
    }

    final List<String> allUris = [];

    // Fetch all subscription URLs concurrently
    if (urlList.isNotEmpty) {
      final futures = urlList.map((url) async {
        try {
          final res = await http.get(
            Uri.parse(url),
            headers: {'User-Agent': 'v2rayN/6.39 TurboProbe/1.0 ClashMeta'},
          ).timeout(const Duration(seconds: 12));
          if (res.statusCode == 200) {
            return _extractURIsFromBlob(res.body.trim());
          }
        } catch (_) {}
        return <String>[];
      });

      final results = await Future.wait(futures);
      for (final list in results) {
        allUris.addAll(list);
      }
    }

    // Process direct text lines
    if (directLines.isNotEmpty) {
      allUris.addAll(_extractURIsFromBlob(directLines.join('\n')));
    }

    // Fallback on full text
    if (allUris.isEmpty) {
      allUris.addAll(_extractURIsFromBlob(input));
    }

    final List<NodeModel> nodes = [];
    final Set<String> seen = {};

    for (final uri in allUris) {
      final node = _parseSingleUri(uri);
      if (node != null) {
        final key = '${node.protocol}://${node.server}:${node.port}@${node.sni}';
        if (!seen.contains(key)) {
          seen.add(key);
          nodes.add(node);
        }
      }
    }

    return nodes;
  }

  static List<String> _extractURIsFromBlob(String text) {
    final List<String> uris = [];
    final lines = _extractLines(text);

    for (final line in lines) {
      if (_isSupportedUri(line)) {
        uris.add(line);
      } else {
        try {
          final decoded = utf8.decode(base64.decode(base64.normalize(line)));
          final subLines = _extractLines(decoded);
          for (final sub in subLines) {
            if (_isSupportedUri(sub)) uris.add(sub);
          }
        } catch (_) {}
      }
    }

    if (uris.isEmpty) {
      try {
        final decoded = utf8.decode(base64.decode(base64.normalize(text)));
        final subLines = _extractLines(decoded);
        for (final sub in subLines) {
          if (_isSupportedUri(sub)) uris.add(sub);
        }
      } catch (_) {}
    }

    return uris;
  }

  static bool _isSupportedUri(String s) {
    return s.startsWith('vless://') ||
        s.startsWith('vmess://') ||
        s.startsWith('ss://') ||
        s.startsWith('trojan://') ||
        s.startsWith('hy2://') ||
        s.startsWith('hysteria2://') ||
        s.startsWith('tuic://');
  }

  static List<String> _extractLines(String text) {
    return const LineSplitter()
        .convert(text)
        .map((e) => e.trim())
        .where((e) => e.isNotEmpty && !e.startsWith('#') && !e.startsWith('//'))
        .toList();
  }

  static NodeModel? _parseSingleUri(String raw) {
    try {
      final uri = Uri.parse(raw);
      final scheme = uri.scheme.toLowerCase();
      final id = raw.hashCode.toRadixString(16);

      if (scheme == 'vless') {
        final server = uri.host;
        final port = uri.port > 0 ? uri.port : 443;
        final name = uri.fragment.isNotEmpty ? Uri.decodeComponent(uri.fragment) : 'VLESS-$server:$port';
        final q = uri.queryParameters;
        return NodeModel(
          id: id,
          rawUri: raw,
          protocol: 'vless',
          name: name,
          server: server,
          port: port,
          security: q['security'],
          sni: q['sni'] ?? q['host'],
          type: q['type'],
        );
      } else if (scheme == 'trojan') {
        final server = uri.host;
        final port = uri.port > 0 ? uri.port : 443;
        final name = uri.fragment.isNotEmpty ? Uri.decodeComponent(uri.fragment) : 'Trojan-$server:$port';
        final q = uri.queryParameters;
        return NodeModel(
          id: id,
          rawUri: raw,
          protocol: 'trojan',
          name: name,
          server: server,
          port: port,
          security: 'tls',
          sni: q['sni'] ?? q['host'] ?? server,
          type: q['type'],
        );
      } else if (scheme == 'hysteria2' || scheme == 'hy2') {
        final server = uri.host;
        final port = uri.port > 0 ? uri.port : 443;
        final name = uri.fragment.isNotEmpty ? Uri.decodeComponent(uri.fragment) : 'Hysteria2-$server:$port';
        final q = uri.queryParameters;
        return NodeModel(
          id: id,
          rawUri: raw,
          protocol: 'hysteria2',
          name: name,
          server: server,
          port: port,
          security: 'tls',
          sni: q['sni'] ?? server,
        );
      } else if (scheme == 'tuic') {
        final server = uri.host;
        final port = uri.port > 0 ? uri.port : 443;
        final name = uri.fragment.isNotEmpty ? Uri.decodeComponent(uri.fragment) : 'TUIC-$server:$port';
        final q = uri.queryParameters;
        return NodeModel(
          id: id,
          rawUri: raw,
          protocol: 'tuic',
          name: name,
          server: server,
          port: port,
          security: 'tls',
          sni: q['sni'] ?? server,
        );
      } else if (scheme == 'ss') {
        final name = uri.fragment.isNotEmpty ? Uri.decodeComponent(uri.fragment) : 'SS-${uri.host}:${uri.port}';
        return NodeModel(
          id: id,
          rawUri: raw,
          protocol: 'shadowsocks',
          name: name,
          server: uri.host,
          port: uri.port > 0 ? uri.port : 8388,
        );
      } else if (scheme == 'vmess') {
        final b64 = raw.substring('vmess://'.length);
        final jsonStr = utf8.decode(base64.decode(base64.normalize(b64)));
        final map = jsonDecode(jsonStr) as Map<String, dynamic>;
        final server = map['add']?.toString() ?? '';
        final port = int.tryParse(map['port']?.toString() ?? '') ?? 443;
        final name = map['ps']?.toString().isNotEmpty == true ? map['ps'].toString() : 'VMess-$server:$port';
        return NodeModel(
          id: id,
          rawUri: raw,
          protocol: 'vmess',
          name: name,
          server: server,
          port: port,
          security: map['tls']?.toString(),
          sni: map['sni']?.toString() ?? map['host']?.toString(),
          type: map['net']?.toString(),
        );
      }
    } catch (_) {}
    return null;
  }

  Future<void> runBenchmark({
    required List<NodeModel> nodes,
    required TestConfigModel config,
    required Function(Map<String, dynamic>) onProgress,
    required Function(List<NodeModel>) onComplete,
  }) async {
    _isCancelled = false;
    final total = nodes.length;
    int tested = 0;
    int alive = 0;
    int dead = 0;
    int totalPingSum = 0;

    final poolSize = min(config.concurrency, 30); // Mobile safe concurrency
    int index = 0;

    Future<void> worker() async {
      while (!_isCancelled) {
        int currentIndex;
        if (index >= total) return;
        currentIndex = index++;

        final node = nodes[currentIndex];
        final updated = await _probeNode(node, config);
        nodes[currentIndex] = updated;

        tested++;
        if (updated.isAlive) {
          alive++;
          totalPingSum += updated.pingMs;
        } else {
          dead++;
        }

        final avgPing = alive > 0 ? (totalPingSum ~/ alive) : 0;
        final pct = (tested / total) * 100.0;

        onProgress({
          'total_count': total,
          'tested_count': tested,
          'alive_count': alive,
          'dead_count': dead,
          'percent': pct,
          'average_ping_ms': avgPing,
          'last_tested': updated.toJson(),
          'is_completed': tested == total,
        });
      }
    }

    final workers = List.generate(min(poolSize, total), (_) => worker());
    await Future.wait(workers);

    // Sort alive first, then ping
    nodes.sort((a, b) {
      if (a.isAlive != b.isAlive) return a.isAlive ? -1 : 1;
      return a.pingMs.compareTo(b.pingMs);
    });

    onComplete(nodes);
  }

  Future<NodeModel> _probeNode(NodeModel node, TestConfigModel config) async {
    final timeout = Duration(milliseconds: config.timeoutMs);
    final stopwatch = Stopwatch()..start();

    try {
      final socket = await Socket.connect(node.server, node.port, timeout: timeout);
      final tcpTime = stopwatch.elapsedMilliseconds;

      // TLS Handshake check if applicable
      if (node.security == 'tls' || node.security == 'reality' || node.protocol == 'trojan') {
        final sni = node.sni ?? node.server;
        final secureSocket = await SecureSocket.secure(
          socket,
          host: sni,
          onBadCertificate: (_) => true,
        ).timeout(timeout);
        secureSocket.destroy();
      } else {
        socket.destroy();
      }

      final totalTime = stopwatch.elapsedMilliseconds;

      // Resolve GeoIP if enabled
      String? cc, cn, flag, isp;
      if (config.enableGeoIp) {
        final geo = await _resolveGeo(node.server);
        cc = geo['country_code'];
        cn = geo['country_name'];
        flag = geo['flag_emoji'];
        isp = geo['isp'];
      }

      return NodeModel(
        id: node.id,
        rawUri: node.rawUri,
        protocol: node.protocol,
        name: node.name,
        server: node.server,
        port: node.port,
        security: node.security,
        sni: node.sni,
        type: node.type,
        countryCode: cc,
        countryName: cn,
        flagEmoji: flag ?? '🌐',
        isp: isp,
        isAlive: true,
        pingMs: totalTime > 0 ? totalTime : tcpTime,
        jitterMs: (totalTime * 0.1).toInt(),
        packetLoss: 0.0,
        score: _calcScore(totalTime),
      );
    } catch (e) {
      return NodeModel(
        id: node.id,
        rawUri: node.rawUri,
        protocol: node.protocol,
        name: node.name,
        server: node.server,
        port: node.port,
        security: node.security,
        sni: node.sni,
        type: node.type,
        isAlive: false,
        pingMs: 9999,
        score: 0,
        errorMsg: e.toString(),
      );
    }
  }

  static int _calcScore(int ping) {
    if (ping < 80) return 95;
    if (ping < 150) return 85;
    if (ping < 250) return 65;
    if (ping < 400) return 40;
    return 15;
  }

  static final Map<String, Map<String, String>> _geoCache = {};

  static Future<Map<String, String>> _resolveGeo(String server) async {
    if (_geoCache.containsKey(server)) return _geoCache[server]!;

    try {
      final res = await http.get(Uri.parse('https://ipwho.is/$server')).timeout(const Duration(seconds: 2));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final cc = data['country_code']?.toString().toUpperCase() ?? 'UN';
        final cn = data['country']?.toString() ?? 'Unknown';
        final isp = data['connection']?['isp']?.toString() ?? 'Unknown';
        final flag = _countryToEmoji(cc);

        final result = {
          'country_code': cc,
          'country_name': cn,
          'flag_emoji': flag,
          'isp': isp,
        };
        _geoCache[server] = result;
        return result;
      }
    } catch (_) {}

    return {'country_code': 'UN', 'country_name': 'Unknown', 'flag_emoji': '🌐', 'isp': 'Unknown'};
  }

  static String _countryToEmoji(String code) {
    if (code.length != 2) return '🌐';
    final int r1 = code.codeUnitAt(0) - 65 + 0x1F1E6;
    final int r2 = code.codeUnitAt(1) - 65 + 0x1F1E6;
    return String.fromCharCode(r1) + String.fromCharCode(r2);
  }
}
