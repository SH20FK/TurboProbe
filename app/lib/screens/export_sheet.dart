import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class ExportSheet extends StatefulWidget {
  final ProbeProvider provider;

  const ExportSheet({super.key, required this.provider});

  @override
  State<ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<ExportSheet> {
  String _format = 'raw'; // raw, base64, clash, singbox
  int _limit = 0; // 0 = all
  int _maxPing = 0; // 0 = no limit
  bool _onlyAlive = true;
  String _exportedContent = '';
  bool _isGenerating = false;

  final List<Map<String, String>> _formats = [
    {'id': 'raw', 'name': 'Raw Links (vless://, etc.)'},
    {'id': 'base64', 'name': 'Base64 Subscription'},
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
      final res = await widget.provider.api.export(
        format: _format,
        onlyAlive: _onlyAlive,
        limit: _limit > 0 ? _limit : null,
        maxPing: _maxPing > 0 ? _maxPing : null,
        protocols: widget.provider.selectedProtocol != 'ALL' ? [widget.provider.selectedProtocol] : null,
        countries: widget.provider.selectedCountry != 'ALL' ? [widget.provider.selectedCountry] : null,
      );
      setState(() {
        _exportedContent = res;
        _isGenerating = false;
      });
    } catch (e) {
      setState(() => _isGenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  '📦 Export Clean VPN Keys',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppTheme.textSecondary),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Export Format:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: _formats.map((f) {
                final isSelected = _format == f['id'];
                return ChoiceChip(
                  label: Text(f['name']!),
                  selected: isSelected,
                  selectedColor: AppTheme.primary,
                  backgroundColor: AppTheme.surfaceLight,
                  labelStyle: TextStyle(
                    color: isSelected ? Colors.white : AppTheme.textSecondary,
                    fontSize: 12,
                  ),
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
            const Text('Quantity / Selection:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [
                _buildFilterChip('All Working', 0),
                _buildFilterChip('Top 5 Fastest', 5),
                _buildFilterChip('Top 10 Fastest', 10),
                _buildFilterChip('Top 25', 25),
              ],
            ),
            const SizedBox(height: 16),
            // Preview Box
            const Text('Preview:', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Container(
              height: 120,
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.border),
              ),
              child: _isGenerating
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                  : SingleChildScrollView(
                      child: Text(
                        _exportedContent.isEmpty ? 'No keys match selected filter.' : _exportedContent,
                        style: const TextStyle(
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ),
            ),
            const SizedBox(height: 20),
            // Copy Button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.copy_rounded, size: 18),
                label: const Text('Copy to Clipboard'),
                onPressed: _exportedContent.isEmpty
                    ? null
                    : () {
                        Clipboard.setData(ClipboardData(text: _exportedContent));
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Export copied to clipboard!'),
                            backgroundColor: AppTheme.success,
                            behavior: SnackBarBehavior.floating,
                          ),
                        );
                      },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, int limitVal) {
    final isSelected = _limit == limitVal;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppTheme.primary,
      backgroundColor: AppTheme.surfaceLight,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppTheme.textSecondary,
        fontSize: 12,
      ),
      onSelected: (selected) {
        if (selected) {
          setState(() => _limit = limitVal);
          _generateExport();
        }
      },
    );
  }
}
