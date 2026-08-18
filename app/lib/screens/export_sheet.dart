import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class ExportSheet extends StatefulWidget {
  final ProbeProvider provider;

  const ExportSheet({super.key, required this.provider});

  static Future<void> show(BuildContext context, ProbeProvider provider) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ExportSheet(provider: provider),
    );
  }

  @override
  State<ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<ExportSheet> {
  String _format = 'raw'; // raw, base64, clash, singbox
  int _limit = 10; // Default: Top 10
  double _maxPingSlider = 400; // ms
  bool _filterByMaxPing = false;
  String _selectedCountry = 'ALL';
  String _exportedContent = '';
  int _matchedCount = 0;
  bool _isGenerating = false;

  final List<Map<String, String>> _formats = const [
    {'id': 'raw', 'name': 'Raw ссылки (vless://...)'},
    {'id': 'base64', 'name': 'Base64 подписка'},
    {'id': 'clash', 'name': 'Clash Meta (YAML)'},
    {'id': 'singbox', 'name': 'sing-box (JSON)'},
  ];

  @override
  void initState() {
    super.initState();
    _generateExport();
  }

  Future<void> _generateExport() async {
    setState(() => _isGenerating = true);
    try {
      final nodes = widget.provider.nodes.where((n) {
        if (!n.isAlive) return false;
        if (_filterByMaxPing && n.pingMs > _maxPingSlider) return false;
        if (_selectedCountry != 'ALL' && (n.countryCode ?? '').toUpperCase() != _selectedCountry) return false;
        if (widget.provider.selectedProtocol != 'ALL' && n.protocol.toUpperCase() != widget.provider.selectedProtocol) return false;
        return true;
      }).toList();

      final countToTake = (_limit > 0 && _limit < nodes.length) ? _limit : nodes.length;
      final targetNodes = nodes.take(countToTake).toList();

      String content = '';
      if (_format == 'base64') {
        final uris = targetNodes.map((e) => e.rawUri).join('\n');
        content = base64.encode(utf8.encode(uris));
      } else if (_format == 'clash') {
        content = _generateClash(targetNodes);
      } else if (_format == 'singbox') {
        content = _generateSingBox(targetNodes);
      } else {
        content = targetNodes.map((e) => e.rawUri).join('\n');
      }

      setState(() {
        _matchedCount = targetNodes.length;
        _exportedContent = content;
        _isGenerating = false;
      });
    } catch (_) {
      setState(() => _isGenerating = false);
    }
  }

  String _generateClash(List nodes) {
    final sb = StringBuffer();
    sb.writeln('port: 7890\nsocks-port: 7891\nmode: rule\n\nproxies:');
    for (final n in nodes) {
      sb.writeln('  - name: "${n.name.replaceAll(':', '-')}"');
      sb.writeln('    type: ${n.protocol}');
      sb.writeln('    server: ${n.server}');
      sb.writeln('    port: ${n.port}');
    }
    return sb.toString();
  }

  String _generateSingBox(List nodes) {
    return const JsonEncoder.withIndent('  ').convert({
      'outbounds': nodes.map((n) => {
        'type': n.protocol,
        'tag': n.name,
        'server': n.server,
        'server_port': n.port,
      }).toList(),
    });
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    final countries = widget.provider.availableCountries;

    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surfaceContainerLow,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 16,
        bottom: 24 + bottomInset,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Drag Handle
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppTheme.outline,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.file_download_rounded, color: AppTheme.primary, size: 24),
                    const SizedBox(width: 10),
                    const Text(
                      'Экспорт лучших ключей',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryContainer,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$_matchedCount нод',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.onPrimaryContainer),
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, size: 20, color: AppTheme.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),

            // Top Limit Presets: 10 / 50 / 100 / All
            const Text(
              'Количество лучших ключей (по наименьшему пингу)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _buildLimitChip('ТОП 10 лучших', 10),
                _buildLimitChip('ТОП 50 лучших', 50),
                _buildLimitChip('ТОП 100 лучших', 100),
                _buildLimitChip('Все рабочие', 0),
              ],
            ),
            const SizedBox(height: 16),

            // Country Filter
            if (countries.length > 1) ...[
              const Text(
                'Фильтр по стране',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: countries.map((c) {
                    final isSelected = _selectedCountry == c;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: FilterChip(
                        label: Text(c == 'ALL' ? '🌐 Все страны' : c),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => _selectedCountry = c);
                            _generateExport();
                          }
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Ping Limit Slider
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Checkbox(
                      value: _filterByMaxPing,
                      activeColor: AppTheme.primary,
                      onChanged: (val) {
                        setState(() => _filterByMaxPing = val ?? false);
                        _generateExport();
                      },
                    ),
                    const Text('Ограничить пинг не выше:', style: TextStyle(fontSize: 13, color: AppTheme.textPrimary)),
                  ],
                ),
                if (_filterByMaxPing)
                  Text(
                    '≤ ${_maxPingSlider.round()} мс',
                    style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary),
                  ),
              ],
            ),
            if (_filterByMaxPing)
              Slider(
                value: _maxPingSlider,
                min: 50,
                max: 800,
                divisions: 15,
                activeColor: AppTheme.primary,
                onChanged: (val) {
                  setState(() => _maxPingSlider = val);
                  _generateExport();
                },
              ),

            const SizedBox(height: 12),
            const Text(
              'Формат экспорта',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _formats.map((f) {
                final isSelected = _format == f['id'];
                return ChoiceChip(
                  label: Text(f['name']!),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => _format = f['id']!);
                      _generateExport();
                    }
                  },
                );
              }).toList(),
            ),

            const SizedBox(height: 16),
            // Preview
            Container(
              height: 110,
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.outlineVariant),
              ),
              child: _isGenerating
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary))
                  : SingleChildScrollView(
                      child: Text(
                        _exportedContent.isEmpty ? 'Нет ключей, подходящих под выбранные фильтры.' : _exportedContent,
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ),
            ),
            const SizedBox(height: 20),

            // Action Buttons (Copy & Download)
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: FilledButton.icon(
                      icon: const Icon(Icons.copy_rounded, size: 18),
                      label: Text('Копировать ($_matchedCount)'),
                      onPressed: _exportedContent.isEmpty
                          ? null
                          : () {
                              Clipboard.setData(ClipboardData(text: _exportedContent));
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('$_matchedCount ключей скопировано в буфер!'),
                                  backgroundColor: AppTheme.success,
                                  behavior: SnackBarBehavior.floating,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                              );
                            },
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLimitChip(String label, int val) {
    final isSelected = _limit == val;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() => _limit = val);
          _generateExport();
        }
      },
    );
  }
}
