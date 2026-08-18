import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../models/node_model.dart';
import '../models/test_config_model.dart';
import '../services/core_api_service.dart';
import '../services/dart_probe_engine.dart';

enum SortOption { pingAsc, scoreDesc, protocol, country }

class ProbeProvider extends ChangeNotifier {
  final CoreApiService api = CoreApiService();
  HttpServer? _localHttpServer;

  List<NodeModel> _nodes = [];
  List<NodeModel> _filteredNodesCache = [];
  bool _isTesting = false;
  bool _isLoading = false;
  String? _errorMessage;

  // Progress stats
  int _totalCount = 0;
  int _testedCount = 0;
  int _aliveCount = 0;
  int _deadCount = 0;
  double _percent = 0.0;
  int _averagePing = 0;

  // Filter & Search
  String _searchQuery = '';
  String _selectedProtocol = 'ALL';
  String _selectedCountry = 'ALL';
  String _selectedRUCategory = 'ALL';
  SortOption _sortOption = SortOption.pingAsc;

  // Test Config
  TestConfigModel config = TestConfigModel();

  // High-performance UI Notification Throttler (120ms window)
  Timer? _throttleTimer;
  bool _hasPendingNotify = false;

  DartProbeEngine? _dartEngine;

  ProbeProvider() {
    _startLocalHttpServer();
  }

  Future<void> _startLocalHttpServer() async {
    try {
      _localHttpServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 8999);
      _localHttpServer!.listen((HttpRequest request) async {
        try {
          if (request.uri.path == '/sub') {
            final q = request.uri.queryParameters;
            int limit = int.tryParse(q['top'] ?? '') ?? 0;
            final alive = _nodes.where((n) => n.isAlive).toList();
            final toTake = (limit > 0 && limit < alive.length) ? limit : alive.length;
            final rawUris = alive.take(toTake).map((n) => n.rawUri).join('\n');
            final base64Content = base64.encode(utf8.encode(rawUris));

            request.response
              ..headers.contentType = ContentType.text
              ..headers.set('Access-Control-Allow-Origin', '*')
              ..headers.set('Subscription-Userinfo', 'upload=0; download=0; total=107374182400; expire=0')
              ..write(q['format'] == 'raw' ? rawUris : base64Content)
              ..close();
          } else if (request.uri.path == '/api/health') {
            request.response
              ..headers.contentType = ContentType.json
              ..headers.set('Access-Control-Allow-Origin', '*')
              ..write(jsonEncode({'status': 'ok', 'version': '1.0.0-embedded'}))
              ..close();
          } else if (request.uri.path == '/api/parse' && request.method == 'POST') {
            final body = await utf8.decodeStream(request);
            final jsonBody = jsonDecode(body) as Map<String, dynamic>;
            final inputText = jsonBody['input'] as String? ?? '';
            final parsed = await DartProbeEngine.parseInput(inputText);
            request.response
              ..headers.contentType = ContentType.json
              ..headers.set('Access-Control-Allow-Origin', '*')
              ..write(jsonEncode({'success': true, 'nodes': parsed.map((n) => n.toJson()).toList()}))
              ..close();
          } else {
            request.response
              ..headers.contentType = ContentType.json
              ..headers.set('Access-Control-Allow-Origin', '*')
              ..write(jsonEncode({'status': 'ok'}))
              ..close();
          }
        } catch (_) {
          try {
            request.response
              ..statusCode = HttpStatus.internalServerError
              ..close();
          } catch (_) {}
        }
      });
    } catch (_) {}
  }

  List<NodeModel> get nodes => _nodes;
  List<NodeModel> get filteredNodes => _filteredNodesCache;
  bool get isTesting => _isTesting;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  int get totalCount => _totalCount;
  int get testedCount => _testedCount;
  int get aliveCount => _aliveCount;
  int get deadCount => _deadCount;
  double get percent => _percent;
  int get averagePing => _averagePing;

  String get searchQuery => _searchQuery;
  String get selectedProtocol => _selectedProtocol;
  String get selectedCountry => _selectedCountry;
  String get selectedRUCategory => _selectedRUCategory;
  SortOption get sortOption => _sortOption;

  void _throttledNotify() {
    _recalculateFilteredCache();
    if (_throttleTimer == null || !_throttleTimer!.isActive) {
      notifyListeners();
      _throttleTimer = Timer(const Duration(milliseconds: 120), () {
        if (_hasPendingNotify) {
          _hasPendingNotify = false;
          _recalculateFilteredCache();
          notifyListeners();
        }
      });
    } else {
      _hasPendingNotify = true;
    }
  }

  Future<void> parseInput(String input) async {
    final text = input.trim();
    if (text.isEmpty) return;

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final parsed = await DartProbeEngine.parseInput(text);

      if (parsed.isEmpty) {
        _errorMessage = 'Не удалось распознать ключи. Проверьте правильность ссылок или формата.';
      } else {
        _nodes = parsed;
        _totalCount = parsed.length;
        _testedCount = 0;
        _aliveCount = 0;
        _deadCount = 0;
        _percent = 0.0;
        _averagePing = 0;
        _recalculateFilteredCache();
      }
    } catch (e) {
      _errorMessage = 'Ошибка парсинга: $e';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> startBenchmark() async {
    if (_nodes.isEmpty) return;
    _isTesting = true;
    _testedCount = 0;
    _aliveCount = 0;
    _deadCount = 0;
    _percent = 0.0;
    _averagePing = 0;
    _recalculateFilteredCache();
    notifyListeners();

    try {
      _dartEngine = DartProbeEngine();
      _dartEngine!.runBenchmark(
        nodes: _nodes,
        config: config,
        onProgress: (data) {
          _totalCount = (data['total_count'] as num?)?.toInt() ?? _totalCount;
          _testedCount = (data['tested_count'] as num?)?.toInt() ?? _testedCount;
          _aliveCount = (data['alive_count'] as num?)?.toInt() ?? _aliveCount;
          _deadCount = (data['dead_count'] as num?)?.toInt() ?? _deadCount;
          _percent = (data['percent'] as num?)?.toDouble() ?? _percent;
          _averagePing = (data['average_ping_ms'] as num?)?.toInt() ?? _averagePing;

          final lastTested = data['last_tested'] as Map<String, dynamic>?;
          if (lastTested != null) {
            final updatedNode = NodeModel.fromJson(lastTested);
            final idx = _nodes.indexWhere((n) => n.id == updatedNode.id);
            if (idx != -1) {
              _nodes[idx] = updatedNode;
            }
          }

          if (data['is_completed'] == true) {
            _isTesting = false;
            _sortNodes();
            _recalculateFilteredCache();
            notifyListeners();
          } else {
            _throttledNotify();
          }
        },
        onComplete: (completedNodes) {
          _isTesting = false;
          _nodes = completedNodes;
          _sortNodes();
          _recalculateFilteredCache();
          notifyListeners();
        },
      );
    } catch (e) {
      _isTesting = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> stopBenchmark() async {
    _dartEngine?.stop();
    _isTesting = false;
    _recalculateFilteredCache();
    notifyListeners();
  }

  void clearNodes() {
    _nodes.clear();
    _filteredNodesCache.clear();
    _totalCount = 0;
    _testedCount = 0;
    _aliveCount = 0;
    _deadCount = 0;
    _percent = 0.0;
    _averagePing = 0;
    _errorMessage = null;
    notifyListeners();
  }

  void removeNode(String id) {
    _nodes.removeWhere((n) => n.id == id);
    _totalCount = _nodes.length;
    _aliveCount = _nodes.where((n) => n.isAlive).length;
    _deadCount = _nodes.where((n) => !n.isAlive && n.pingMs > 0).length;
    _recalculateFilteredCache();
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    _recalculateFilteredCache();
    notifyListeners();
  }

  void setProtocolFilter(String proto) {
    _selectedProtocol = proto;
    _recalculateFilteredCache();
    notifyListeners();
  }

  void setCountryFilter(String country) {
    _selectedCountry = country;
    _recalculateFilteredCache();
    notifyListeners();
  }

  void setRUCategoryFilter(String category) {
    _selectedRUCategory = category;
    _recalculateFilteredCache();
    notifyListeners();
  }

  void setSortOption(SortOption option) {
    _sortOption = option;
    _sortNodes();
    _recalculateFilteredCache();
    notifyListeners();
  }

  void _sortNodes() {
    _nodes.sort((a, b) {
      if (a.isAlive != b.isAlive) {
        return a.isAlive ? -1 : 1;
      }

      switch (_sortOption) {
        case SortOption.pingAsc:
          return a.pingMs.compareTo(b.pingMs);
        case SortOption.scoreDesc:
          return b.score.compareTo(a.score);
        case SortOption.protocol:
          return a.protocol.compareTo(b.protocol);
        case SortOption.country:
          return (a.countryCode ?? '').compareTo(b.countryCode ?? '');
      }
    });
  }

  void _recalculateFilteredCache() {
    final query = _searchQuery.toLowerCase().trim();
    _filteredNodesCache = _nodes.where((n) {
      if (query.isNotEmpty) {
        final matchesName = n.name.toLowerCase().contains(query);
        final matchesServer = n.server.toLowerCase().contains(query);
        final matchesCountry = (n.countryName ?? '').toLowerCase().contains(query);
        if (!matchesName && !matchesServer && !matchesCountry) return false;
      }

      if (_selectedProtocol != 'ALL' && n.protocol.toUpperCase() != _selectedProtocol) {
        return false;
      }

      if (_selectedCountry != 'ALL' && (n.countryCode ?? '').toUpperCase() != _selectedCountry) {
        return false;
      }

      // RU Category Specific Filter
      if (_selectedRUCategory == 'YOUTUBE' && !n.unlockYouTube) return false;
      if (_selectedRUCategory == 'DISCORD' && !n.unlockDiscord) return false;
      if (_selectedRUCategory == 'REALITY' && !(n.isTSPUResistant || n.security == 'reality')) return false;
      if (_selectedRUCategory == 'AI' && !n.unlockOpenAI) return false;

      return true;
    }).toList();
  }

  List<String> get availableProtocols {
    final set = <String>{'ALL'};
    for (final n in _nodes) {
      set.add(n.protocol.toUpperCase());
    }
    return set.toList();
  }

  List<String> get availableCountries {
    final set = <String>{'ALL'};
    for (final n in _nodes) {
      if (n.countryCode != null && n.countryCode!.isNotEmpty) {
        set.add(n.countryCode!.toUpperCase());
      }
    }
    return set.toList();
  }

  @override
  void dispose() {
    _localHttpServer?.close(force: true);
    _throttleTimer?.cancel();
    super.dispose();
  }
}
