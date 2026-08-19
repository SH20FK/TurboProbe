import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/test_config_model.dart';
import '../theme/app_theme.dart';

class SettingsDialog extends StatefulWidget {
  final TestConfigModel initialConfig;

  const SettingsDialog({super.key, required this.initialConfig});

  static Future<TestConfigModel?> show(BuildContext context, TestConfigModel config) {
    FocusScope.of(context).unfocus();
    return showModalBottomSheet<TestConfigModel>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
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
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.85,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Настройки бенчмарка',
                  style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: AppTheme.textSecondaryDark),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.dividerDark),

          // Settings List (Android Settings style)
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              children: [
                // 1. Target URL
                _buildSectionHeader('Тестовый сервер'),
                TextField(
                  controller: _urlController,
                  style: GoogleFonts.robotoMono(fontSize: 12.5, color: AppTheme.textPrimaryDark),
                  decoration: const InputDecoration(
                    hintText: 'http://cp.cloudflare.com/generate_204',
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: _presets.map((preset) {
                    final isSelected = _urlController.text == preset['url'];
                    return InkWell(
                      onTap: () => setState(() => _urlController.text = preset['url']!),
                      borderRadius: BorderRadius.circular(4),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: isSelected ? AppTheme.accent.withOpacity(0.18) : AppTheme.surfaceContainerLow,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: isSelected ? AppTheme.accent : AppTheme.dividerDark),
                        ),
                        child: Text(
                          preset['name']!,
                          style: GoogleFonts.roboto(
                            fontSize: 11,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                            color: isSelected ? Colors.white : AppTheme.textSecondaryDark,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 24),

                // 2. Concurrency
                _buildSectionHeader('Параллельные потоки'),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Воркеров одновременно', style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textPrimaryDark)),
                    Text('$_concurrency', style: GoogleFonts.robotoMono(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.accent)),
                  ],
                ),
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    activeTrackColor: AppTheme.accent,
                    inactiveTrackColor: AppTheme.dividerDark,
                    thumbColor: AppTheme.accent,
                    overlayColor: AppTheme.accent.withOpacity(0.15),
                    trackHeight: 2,
                  ),
                  child: Slider(
                    value: _concurrency.toDouble(),
                    min: 10,
                    max: 100,
                    divisions: 18,
                    onChanged: (val) => setState(() => _concurrency = val.round()),
                  ),
                ),
                const SizedBox(height: 16),

                // 3. Timeout
                _buildSectionHeader('Таймаут соединения'),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Максимальное ожидание', style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textPrimaryDark)),
                    Text('${_timeoutMs} мс', style: GoogleFonts.robotoMono(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.accent)),
                  ],
                ),
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    activeTrackColor: AppTheme.accent,
                    inactiveTrackColor: AppTheme.dividerDark,
                    thumbColor: AppTheme.accent,
                    overlayColor: AppTheme.accent.withOpacity(0.15),
                    trackHeight: 2,
                  ),
                  child: Slider(
                    value: _timeoutMs.toDouble(),
                    min: 500,
                    max: 5000,
                    divisions: 18,
                    onChanged: (val) => setState(() => _timeoutMs = val.round()),
                  ),
                ),
                const SizedBox(height: 16),

                // 4. Switches (Android Settings style)
                _buildSectionHeader('Обход цензуры и DPI (Хамелеон)'),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('🛡️ DPI Auto-Morph & Anti-DPI Shield', style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textPrimaryDark)),
                  subtitle: Text('Адаптивное расщепление ClientHello (1-3B) против ТСПУ', style: GoogleFonts.roboto(fontSize: 11.5, color: AppTheme.textSecondaryDark)),
                  value: _enableBurst,
                  activeColor: AppTheme.accent,
                  onChanged: (val) => setState(() => _enableBurst = val),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text('Определение GeoIP и флагов', style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textPrimaryDark)),
                  subtitle: Text('Показывает реальный Egress IP и страну ноды', style: GoogleFonts.roboto(fontSize: 11.5, color: AppTheme.textSecondaryDark)),
                  value: _enableGeoIp,
                  activeColor: AppTheme.accent,
                  onChanged: (val) => setState(() => _enableGeoIp = val),
                ),
              ],
            ),
          ),

          // Save Button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppTheme.surfaceDark,
              border: Border(top: BorderSide(color: AppTheme.dividerDark, width: 1)),
            ),
            child: SizedBox(
              width: double.infinity,
              height: 44,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () {
                  widget.initialConfig.targetUrl = _urlController.text.trim();
                  widget.initialConfig.concurrency = _concurrency;
                  widget.initialConfig.timeoutMs = _timeoutMs;
                  widget.initialConfig.enableBurst = _enableBurst;
                  widget.initialConfig.enableGeoIp = _enableGeoIp;
                  Navigator.pop(context, widget.initialConfig);
                },
                child: Text('Сохранить', style: GoogleFonts.roboto(fontSize: 14, fontWeight: FontWeight.w600)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textTertiaryDark, letterSpacing: 0.5),
      ),
    );
  }
}
