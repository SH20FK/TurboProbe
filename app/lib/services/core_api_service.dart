import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';
import '../models/node_model.dart';
import '../models/test_config_model.dart';

class CoreApiService {
  final String baseUrl;
  final String wsUrl;
  WebSocketChannel? _wsChannel;
  StreamController<Map<String, dynamic>>? _wsStreamController;

  CoreApiService({
    this.baseUrl = 'http://127.0.0.1:8999',
    this.wsUrl = 'ws://127.0.0.1:8999/api/ws',
  });

  Stream<Map<String, dynamic>> get stream {
    _wsStreamController ??= StreamController<Map<String, dynamic>>.broadcast();
    _connectWebSocket();
    return _wsStreamController!.stream;
  }

  void _connectWebSocket() {
    try {
      _wsChannel?.sink.close();
      _wsChannel = WebSocketChannel.connect(Uri.parse(wsUrl));
      _wsChannel!.stream.listen(
        (message) {
          try {
            final data = jsonDecode(message as String) as Map<String, dynamic>;
            _wsStreamController?.add(data);
          } catch (_) {}
        },
        onError: (err) {
          Future.delayed(const Duration(seconds: 2), _connectWebSocket);
        },
        onDone: () {
          Future.delayed(const Duration(seconds: 2), _connectWebSocket);
        },
      );
    } catch (_) {}
  }

  Future<bool> checkHealth() async {
    try {
      final res = await http.get(Uri.parse('$baseUrl/api/health')).timeout(const Duration(seconds: 2));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<List<NodeModel>> parseInput(String input) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/parse'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'input': input}),
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      if (data['success'] == true) {
        final list = data['nodes'] as List<dynamic>? ?? [];
        return list.map((e) => NodeModel.fromJson(e as Map<String, dynamic>)).toList();
      }
      throw Exception(data['error'] ?? 'Parse failed');
    }
    throw Exception('Server error: ${res.statusCode}');
  }

  Future<bool> startTest(TestConfigModel config) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/test/start'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(config.toJson()),
    );
    return res.statusCode == 200;
  }

  Future<bool> stopTest() async {
    final res = await http.post(Uri.parse('$baseUrl/api/test/stop'));
    return res.statusCode == 200;
  }

  Future<String> export({
    required String format,
    bool onlyAlive = true,
    int? limit,
    int? maxPing,
    List<String>? protocols,
    List<String>? countries,
  }) async {
    final res = await http.post(
      Uri.parse('$baseUrl/api/export'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'format': format,
        'filters': {
          'only_alive': onlyAlive,
          'limit': limit ?? 0,
          'max_ping_ms': maxPing ?? 0,
          'protocols': protocols ?? [],
          'countries': countries ?? [],
        },
      }),
    );

    if (res.statusCode == 200) {
      final data = jsonDecode(res.body) as Map<String, dynamic>;
      return data['content'] as String? ?? '';
    }
    throw Exception('Export failed');
  }

  void dispose() {
    _wsChannel?.sink.close();
    _wsStreamController?.close();
  }
}
