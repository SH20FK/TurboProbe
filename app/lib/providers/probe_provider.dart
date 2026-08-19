import 'dart:async';
import 'package:flutter/foundation.dart';
import '../models/node_model.dart';
import '../models/test_config_model.dart';
import '../services/dart_probe_engine.dart';

enum SortOption { pingAsc, scoreDesc, protocol, country }
enum QuickFilter { all, alive, top }

class ProbeProvider extends ChangeNotifier {
  List<NodeModel> _nodes = [];
  Map<String, int> _idToIndex = {};
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
  QuickFilter _quickFilter = QuickFilter.all;
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

  ProbeProvider();

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
  QuickFilter get quickFilter => _quickFilter;
  String get selectedProtocol => _selectedProtocol;
  String get selectedCountry => _selectedCountry;
  String get selectedRUCategory => _selectedRUCategory;
  SortOption get sortOption => _sortOption;

  int get activeFilterCount {
    int count = 0;
    if (_selectedRUCategory != 'ALL') count++;
    if (_selectedProtocol != 'ALL') count++;
    if (_selectedCountry != 'ALL') count++;
    if (_sortOption != SortOption.pingAsc) count++;
    return count;
  }

  // Returns nodes grouped by Country for Sticky/Section Headers
  Map<String, List<NodeModel>> get groupedByCountry {
    final map = <String, List<NodeModel>>{};
    for (final node in _filteredNodesCache) {
      final key = node.countryName != null && node.countryName!.isNotEmpty
          ? '${node.flagEmoji ?? "🌐"} ${node.countryName}'
          : (node.countryCode != null && node.countryCode!.isNotEmpty
              ? '${node.flagEmoji ?? "🌐"} ${node.countryCode}'
              : '🌐 Другие серверы');
      map.putIfAbsent(key, () => []).add(node);
    }
    return map;
  }

  void _rebuildIndex() {
    _idToIndex = {
      for (int i = 0; i < _nodes.length; i++) _nodes[i].id: i,
    };
  }

  /// Throttled notification: recalculates cache strictly when UI actually updates
  void _throttledNotify() {
    if (_throttleTimer == null || !_throttleTimer!.isActive) {
      _recalculateFilteredCache();
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
        _errorMessage = 'Не удалось распознать ключи. Проверьте ссылки или формат.';
      } else {
        _nodes = parsed;
        _rebuildIndex();
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
      _dartEngine?.stop();
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
            // O(1) direct map lookup instead of O(N) linear scan
            final idx = _idToIndex[updatedNode.id];
            if (idx != null && idx < _nodes.length) {
              _nodes[idx] = updatedNode;
            }
          }

          if (data['is_completed'] == true) {
            _isTesting = false;
            _sortNodes();
            _rebuildIndex();
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
          _rebuildIndex();
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
    _dartEngine?.stop();
    _nodes.clear();
    _idToIndex.clear();
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
    _rebuildIndex();
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

  void setQuickFilter(QuickFilter qf) {
    _quickFilter = qf;
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
    _rebuildIndex();
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
    List<NodeModel> list = _nodes.where((n) {
      if (query.isNotEmpty) {
        final matchesName = n.name.toLowerCase().contains(query);
        final matchesServer = n.server.toLowerCase().contains(query);
        final matchesCountry = (n.countryName ?? '').toLowerCase().contains(query);
        if (!matchesName && !matchesServer && !matchesCountry) return false;
      }

      // Quick Segment Filter (Все / Живые / ТОП)
      if (_quickFilter == QuickFilter.alive && !n.isAlive) {
        return false;
      }
      if (_quickFilter == QuickFilter.top && !n.isAlive) {
        return false;
      }

      if (_selectedProtocol != 'ALL' && n.protocol.toUpperCase() != _selectedProtocol) {
        return false;
      }

      if (_selectedCountry != 'ALL' && (n.countryCode ?? '').toUpperCase() != _selectedCountry) {
        return false;
      }

      // RU Category Filter
      if (_selectedRUCategory == 'YOUTUBE' && !n.unlockYouTube) return false;
      if (_selectedRUCategory == 'DISCORD' && !n.unlockDiscord) return false;
      if (_selectedRUCategory == 'REALITY' && !(n.isTSPUResistant || n.security == 'reality')) return false;
      if (_selectedRUCategory == 'AI' && !n.unlockOpenAI) return false;

      return true;
    }).toList();

    if (_quickFilter == QuickFilter.top) {
      list.sort((a, b) => a.pingMs.compareTo(b.pingMs));
      if (list.length > 20) {
        list = list.sublist(0, 20);
      }
    }

    _filteredNodesCache = list;
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
    _dartEngine?.stop();
    _throttleTimer?.cancel();
    super.dispose();
  }
}
