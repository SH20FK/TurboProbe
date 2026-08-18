import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/node_model.dart';
import '../models/test_config_model.dart';
import '../services/core_api_service.dart';
import '../services/dart_probe_engine.dart';

enum SortOption { pingAsc, scoreDesc, protocol, country }

class ProbeProvider extends ChangeNotifier {
  final CoreApiService api = CoreApiService();
  StreamSubscription? _wsSubscription;

  List<NodeModel> _nodes = [];
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
  SortOption _sortOption = SortOption.pingAsc;

  // Test Config
  TestConfigModel config = TestConfigModel();

  ProbeProvider() {
    _initWebSocket();
  }

  List<NodeModel> get nodes => _nodes;
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
  SortOption get sortOption => _sortOption;

  void _initWebSocket() {
    _wsSubscription = api.stream.listen((event) {
      final type = event['type'] as String?;
      if (type == 'progress') {
        final data = event['data'] as Map<String, dynamic>? ?? {};
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
        }
        notifyListeners();
      } else if (type == 'complete') {
        _isTesting = false;
        final list = event['nodes'] as List<dynamic>? ?? [];
        _nodes = list.map((e) => NodeModel.fromJson(e as Map<String, dynamic>)).toList();
        _sortNodes();
        notifyListeners();
      }
    });
  }

  DartProbeEngine? _dartEngine;

  Future<void> parseInput(String input) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      List<NodeModel> parsed;
      final isBackendAlive = await api.checkHealth();
      if (isBackendAlive) {
        parsed = await api.parseInput(input);
      } else {
        parsed = await DartProbeEngine.parseInput(input);
      }

      _nodes = parsed;
      _totalCount = parsed.length;
      _testedCount = 0;
      _aliveCount = 0;
      _deadCount = 0;
      _percent = 0.0;
      _averagePing = 0;
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
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
    notifyListeners();

    try {
      final isBackendAlive = await api.checkHealth();
      if (isBackendAlive) {
        await api.startTest(config);
      } else {
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
            }
            notifyListeners();
          },
          onComplete: (completedNodes) {
            _isTesting = false;
            _nodes = completedNodes;
            _sortNodes();
            notifyListeners();
          },
        );
      }
    } catch (e) {
      _isTesting = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> stopBenchmark() async {
    _dartEngine?.stop();
    await api.stopTest();
    _isTesting = false;
    notifyListeners();
  }

  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setProtocolFilter(String proto) {
    _selectedProtocol = proto;
    notifyListeners();
  }

  void setCountryFilter(String country) {
    _selectedCountry = country;
    notifyListeners();
  }

  void setSortOption(SortOption option) {
    _sortOption = option;
    _sortNodes();
    notifyListeners();
  }

  void _sortNodes() {
    _nodes.sort((a, b) {
      // Always put alive first
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

  List<NodeModel> get filteredNodes {
    return _nodes.where((n) {
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase();
        final matchesName = n.name.toLowerCase().contains(q);
        final matchesServer = n.server.toLowerCase().contains(q);
        final matchesCountry = (n.countryName ?? '').toLowerCase().contains(q);
        if (!matchesName && !matchesServer && !matchesCountry) return false;
      }

      if (_selectedProtocol != 'ALL' && n.protocol.toUpperCase() != _selectedProtocol) {
        return false;
      }

      if (_selectedCountry != 'ALL' && (n.countryCode ?? '').toUpperCase() != _selectedCountry) {
        return false;
      }

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
    _wsSubscription?.cancel();
    api.dispose();
    super.dispose();
  }
}
