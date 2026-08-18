import 'package:flutter/material.dart';
import '../models/test_config_model.dart';
import '../theme/app_theme.dart';

class SettingsDialog extends StatefulWidget {
  final TestConfigModel initialConfig;

  const SettingsDialog({super.key, required this.initialConfig});

  static Future<TestConfigModel?> show(BuildContext context, TestConfigModel config) {
    return showModalBottomSheet<TestConfigModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SettingsDialog(initialConfig: config),
    );
  }

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late final TextEditingController _urlController;
  late int _concurrency;
  late int _timeoutMs;
  late bool _enableBurst;
  late bool _enableGeoIp;

  final List<Map<String, String>> _presets = const [
    {'name': 'Cloudflare 204', 'url': 'http://cp.cloudflare.com/generate_204'},
    {'name': 'Google Gstatic', 'url': 'http://www.gstatic.com/generate_204'},
    {'name': 'YouTube Check', 'url': 'https://www.youtube.com'},
    {'name': 'Telegram API', 'url': 'https://t.me'},
  ];

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.initialConfig.targetUrl);
    _concurrency = widget.initialConfig.concurrency;
    _timeoutMs = widget.initialConfig.timeoutMs;
    _enableBurst = widget.initialConfig.enableBurst;
    _enableGeoIp = widget.initialConfig.enableGeoIp;
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

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
                const Row(
                  children: [
                    Icon(Icons.tune_rounded, color: AppTheme.primary, size: 22),
                    SizedBox(width: 10),
                    Text(
                      'Настройки бенчмарка',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
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
            const Text(
              'Целевой URL для замера пинга (HTTP 204)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textSecondary),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _urlController,
              style: const TextStyle(fontSize: 13, color: AppTheme.textPrimary),
              decoration: const InputDecoration(
                hintText: 'http://cp.cloudflare.com/generate_204',
                prefixIcon: Icon(Icons.link_rounded, size: 18, color: AppTheme.primary),
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _presets.map((preset) {
                final isSelected = _urlController.text == preset['url'];
                return FilterChip(
                  label: Text(preset['name']!),
                  selected: isSelected,
                  onSelected: (_) {
                    setState(() {
                      _urlController.text = preset['url']!;
                    });
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 20),
            // Concurrency Slider
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Параллельных потоков:', style: TextStyle(fontSize: 14, color: AppTheme.textPrimary)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryContainer,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '$_concurrency воркеров',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.onPrimaryContainer),
                  ),
                ),
              ],
            ),
            Slider(
              value: _concurrency.toDouble(),
              min: 10,
              max: 200,
              divisions: 19,
              activeColor: AppTheme.primary,
              onChanged: (val) => setState(() => _concurrency = val.round()),
            ),
            const SizedBox(height: 12),
            // Timeout Slider
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Таймаут на ноду:', style: TextStyle(fontSize: 14, color: AppTheme.textPrimary)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${_timeoutMs}мс',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textPrimary),
                  ),
                ),
              ],
            ),
            Slider(
              value: _timeoutMs.toDouble(),
              min: 500,
              max: 5000,
              divisions: 18,
              activeColor: AppTheme.primary,
              onChanged: (val) => setState(() => _timeoutMs = val.round()),
            ),
            const SizedBox(height: 12),
            // Micro-burst Toggle
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Микро-берст тест (Джиттер и потери)', style: TextStyle(fontSize: 14, color: AppTheme.textPrimary)),
              subtitle: const Text('3 быстрых пакета для выявления блокировок ТСПУ', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              value: _enableBurst,
              activeColor: AppTheme.primary,
              onChanged: (val) => setState(() => _enableBurst = val),
            ),
            // GeoIP Toggle
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Определение стран и флагов (GeoIP)', style: TextStyle(fontSize: 14, color: AppTheme.textPrimary)),
              subtitle: const Text('Показывает страну, город и провайдера ноды', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              value: _enableGeoIp,
              activeColor: AppTheme.primary,
              onChanged: (val) => setState(() => _enableGeoIp = val),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: FilledButton.icon(
                icon: const Icon(Icons.check_circle_rounded, size: 18),
                label: const Text('Сохранить настройки'),
                onPressed: () {
                  widget.initialConfig.targetUrl = _urlController.text.trim();
                  widget.initialConfig.concurrency = _concurrency;
                  widget.initialConfig.timeoutMs = _timeoutMs;
                  widget.initialConfig.enableBurst = _enableBurst;
                  widget.initialConfig.enableGeoIp = _enableGeoIp;
                  Navigator.pop(context, widget.initialConfig);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
