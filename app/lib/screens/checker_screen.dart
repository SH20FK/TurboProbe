import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/test_config_model.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/filter_bar.dart';
import '../widgets/node_card.dart';
import '../widgets/progress_bar.dart';
import '../widgets/stats_header.dart';
import 'export_sheet.dart';
import 'filter_sheet.dart';
import 'settings_dialog.dart';

class CheckerScreen extends StatefulWidget {
  const CheckerScreen({super.key});

  @override
  State<CheckerScreen> createState() => _CheckerScreenState();
}

class _CheckerScreenState extends State<CheckerScreen> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isInputExpanded = true;

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _startBenchmark() async {
    final text = _inputController.text.trim();
    if (text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Вставьте ссылки на подписки или конфигурации серверов'),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
        ),
      );
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() => _isInputExpanded = false);

    final provider = context.read<ProbeProvider>();
    await provider.loadAndBenchmark(text);
  }

  void _stopBenchmark() {
    context.read<ProbeProvider>().stopBenchmark();
  }

  void _pasteFromClipboard() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data != null && data.text != null && data.text!.isNotEmpty) {
      setState(() {
        _inputController.text = data.text!;
      });
    }
  }

  Widget _buildPresetChip(String label, String url) {
    return ActionChip(
      label: Text(label, style: GoogleFonts.roboto(fontSize: 11.5, fontWeight: FontWeight.w500)),
      backgroundColor: AppTheme.surfaceContainerLow,
      side: const BorderSide(color: AppTheme.dividerDark, width: 1),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
      onPressed: () {
        setState(() {
          _inputController.text = url;
        });
        _startBenchmark();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProbeProvider>();
    final nodes = provider.filteredNodes;
    final isTesting = provider.isTesting;

    return Column(
      children: [
        // 1. Collapsible Input Card
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: Container(
            decoration: BoxDecoration(
              color: AppTheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppTheme.dividerDark, width: 1),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row of Input
                InkWell(
                  onTap: () => setState(() => _isInputExpanded = !_isInputExpanded),
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.input, size: 18, color: AppTheme.textSecondaryDark),
                            const SizedBox(width: 8),
                            Text(
                              'Импорт и публичные подписки',
                              style: GoogleFonts.roboto(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimaryDark,
                              ),
                            ),
                          ],
                        ),
                        Icon(
                          _isInputExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                          size: 20,
                          color: AppTheme.textTertiaryDark,
                        ),
                      ],
                    ),
                  ),
                ),

                if (_isInputExpanded) ...[
                  const Divider(height: 1, color: AppTheme.dividerDark),
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _inputController,
                          maxLines: 2,
                          style: GoogleFonts.robotoMono(fontSize: 12, color: AppTheme.textPrimaryDark),
                          decoration: InputDecoration(
                            hintText: 'Вставьте ссылки на подписки (http/https) или ключи...',
                            hintStyle: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textTertiaryDark),
                            filled: true,
                            fillColor: AppTheme.surfaceContainerLowest,
                            contentPadding: const EdgeInsets.all(10),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide.none),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'Официальные супер-подписки TurboProbe:',
                          style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.textSecondaryDark),
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            _buildPresetChip('🛡️ Анти-Белые списки (1200+)', 'https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/anti-whitelist.txt'),
                            _buildPresetChip('⚡ VLESS Reality (3200+)', 'https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/reality.txt'),
                            _buildPresetChip('🌐 Все протоколы (11900+)', 'https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/all.txt'),
                            _buildPresetChip('🚀 Hysteria 2 / TUIC', 'https://github.com/SH20FK/TurboProbe/raw/refs/heads/main/sub/hysteria2.txt'),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            OutlinedButton.icon(
                              icon: const Icon(Icons.paste, size: 14, color: AppTheme.textPrimaryDark),
                              label: const Text('Вставить'),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: AppTheme.dividerDark),
                                foregroundColor: AppTheme.textPrimaryDark,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: _pasteFromClipboard,
                            ),
                            const Spacer(),
                            FilledButton.icon(
                              icon: Icon(isTesting ? Icons.stop : Icons.play_arrow, size: 16, color: Colors.black),
                              label: Text(isTesting ? 'Остановить' : 'Запустить тест'),
                              style: FilledButton.styleFrom(
                                backgroundColor: isTesting ? AppTheme.statusSlow : Colors.white,
                                foregroundColor: Colors.black,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                              ),
                              onPressed: isTesting ? _stopBenchmark : _startBenchmark,
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),

        // 2. Progress Header (Only when testing or completed)
        if (isTesting || provider.totalCount > 0) ...[
          ProgressBar(percent: provider.percent, isTesting: isTesting),
          StatsHeader(provider: provider),
        ],

        // 3. Sticky Filter & Sorting Bar
        if (provider.totalCount > 0)
          FilterBar(provider: provider),

        // 4. Node List
        Expanded(
          child: provider.totalCount == 0
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.speed, size: 48, color: AppTheme.textTertiaryDark),
                        const SizedBox(height: 12),
                        Text(
                          'Турбо-Чекер готов к работе',
                          style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Нажмите на любой пресет выше или вставьте свои ключи для запуска сквозного тестирования.',
                          style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textSecondaryDark),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  padding: const EdgeInsets.only(bottom: 80),
                  itemCount: nodes.length,
                  itemBuilder: (context, idx) => NodeCard(node: nodes[idx]),
                ),
        ),

        // 5. Sticky Bottom Export Action Bar
        if (provider.totalCount > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: AppTheme.surfaceDark,
              border: Border(top: BorderSide(color: AppTheme.dividerDark, width: 1)),
            ),
            child: Row(
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.flash_on, size: 16, color: AppTheme.accent),
                  label: const Text('В Happ'),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.dividerDark),
                    foregroundColor: AppTheme.textPrimaryDark,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  onPressed: () => ExportSheet.show(context, provider),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  icon: const Icon(Icons.bolt, size: 16, color: AppTheme.statusFast),
                  label: const Text('В Incy'),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.dividerDark),
                    foregroundColor: AppTheme.textPrimaryDark,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  onPressed: () => ExportSheet.show(context, provider),
                ),
                const Spacer(),
                FilledButton.icon(
                  icon: const Icon(Icons.file_upload_outlined, size: 16, color: Colors.black),
                  label: const Text('Экспорт & QR'),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  onPressed: () => ExportSheet.show(context, provider),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
