import 'package:flutter/material.dart';
import '../models/test_config_model.dart';
import '../theme/app_theme.dart';

class SettingsDialog extends StatefulWidget {
  final TestConfigModel initialConfig;

  const SettingsDialog({super.key, required this.initialConfig});

  @override
  State<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends State<SettingsDialog> {
  late TextEditingController _urlController;
  late int _concurrency;
  late int _timeoutMs;
  late bool _enableBurst;
  late bool _enableGeoIp;

  final List<Map<String, String>> _presets = [
    {'name': 'Cloudflare 204 (Recommended)', 'url': 'http://cp.cloudflare.com/generate_204'},
    {'name': 'Google 204 (Gstatic)', 'url': 'http://www.gstatic.com/generate_204'},
    {'name': 'YouTube Main Page', 'url': 'https://www.youtube.com'},
    {'name': 'Telegram API Check', 'url': 'https://t.me'},
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
    return Dialog(
      backgroundColor: AppTheme.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        padding: const EdgeInsets.all(20),
        constraints: const BoxConstraints(maxWidth: 500),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    '⚙️ Benchmark Settings',
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
              const Text(
                'Target URL for Probe Check',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimary),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _urlController,
                style: const TextStyle(fontSize: 13),
                decoration: const InputDecoration(
                  hintText: 'http://cp.cloudflare.com/generate_204',
                ),
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: _presets.map((preset) {
                  return ActionChip(
                    backgroundColor: AppTheme.surfaceLight,
                    label: Text(preset['name']!, style: const TextStyle(fontSize: 11)),
                    onPressed: () {
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
                  const Text('Worker Concurrency (Threads):', style: TextStyle(fontSize: 13)),
                  Text('$_concurrency', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryAccent)),
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
              const SizedBox(height: 10),
              // Timeout Slider
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Timeout per node:', style: TextStyle(fontSize: 13)),
                  Text('${_timeoutMs}ms', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryAccent)),
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
              const SizedBox(height: 10),
              // Micro-burst Toggle
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Micro-burst Jitter & Loss Test', style: TextStyle(fontSize: 13)),
                subtitle: const Text('Sends 3 rapid packets to detect ISP DPI throttling', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                value: _enableBurst,
                activeColor: AppTheme.primary,
                onChanged: (val) => setState(() => _enableBurst = val),
              ),
              // GeoIP Toggle
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('GeoIP & Country Flags', style: TextStyle(fontSize: 13)),
                subtitle: const Text('Resolves server location and ISP name', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                value: _enableGeoIp,
                activeColor: AppTheme.primary,
                onChanged: (val) => setState(() => _enableGeoIp = val),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () {
                    widget.initialConfig.targetUrl = _urlController.text.trim();
                    widget.initialConfig.concurrency = _concurrency;
                    widget.initialConfig.timeoutMs = _timeoutMs;
                    widget.initialConfig.enableBurst = _enableBurst;
                    widget.initialConfig.enableGeoIp = _enableGeoIp;
                    Navigator.pop(context, widget.initialConfig);
                  },
                  child: const Text('Save Settings'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
