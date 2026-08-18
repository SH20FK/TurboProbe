import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/filter_bar.dart';
import '../widgets/node_card.dart';
import '../widgets/progress_bar.dart';
import '../widgets/stats_header.dart';
import 'export_sheet.dart';
import 'settings_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _inputController = TextEditingController();
  bool _isInputExpanded = true;

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  void _pasteFromClipboard() async {
    final data = await Clipboard.getData('text/plain');
    if (data?.text != null && data!.text!.isNotEmpty) {
      setState(() {
        _inputController.text = data.text!;
      });
      _parseKeys();
    }
  }

  void _parseKeys() {
    FocusScope.of(context).unfocus();
    final text = _inputController.text.trim();
    if (text.isNotEmpty) {
      context.read<ProbeProvider>().parseInput(text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProbeProvider>();
    final nodes = provider.filteredNodes;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: const Color(0xFFE31E24).withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE31E24).withOpacity(0.4)),
              ),
              child: const Icon(Icons.vpn_key_rounded, color: Color(0xFF3DAE2B), size: 22),
            ),
            const SizedBox(width: 12),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'TurboProbe VPN',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.textPrimary),
                ),
                Text(
                  'Бенчмарк и фильтр ключей',
                  style: TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ],
        ),
        actions: [
          if (provider.nodes.isNotEmpty)
            IconButton.filledTonal(
              icon: const Icon(Icons.delete_outline_rounded, size: 20),
              tooltip: 'Очистить всё',
              onPressed: () {
                _inputController.clear();
                provider.clearNodes();
              },
            ),
          const SizedBox(width: 4),
          IconButton.filledTonal(
            icon: const Icon(Icons.tune_rounded, size: 20),
            tooltip: 'Настройки',
            onPressed: () {
              FocusScope.of(context).unfocus();
              SettingsDialog.show(context, provider.config);
            },
          ),
          const SizedBox(width: 4),
          IconButton.filledTonal(
            icon: const Icon(Icons.file_download_rounded, size: 20),
            tooltip: 'Экспорт лучших ключей',
            onPressed: provider.nodes.isEmpty
                ? null
                : () {
                    FocusScope.of(context).unfocus();
                    ExportSheet.show(context, provider);
                  },
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: Column(
        children: [
          // Error Message Banner
          if (provider.errorMessage != null)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.error.withOpacity(0.15),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppTheme.error.withOpacity(0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded, size: 18, color: AppTheme.error),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      provider.errorMessage!,
                      style: const TextStyle(fontSize: 12, color: AppTheme.error),
                    ),
                  ),
                  IconButton(
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    icon: const Icon(Icons.close_rounded, size: 18, color: AppTheme.error),
                    onPressed: () => context.read<ProbeProvider>().clearNodes(),
                  ),
                ],
              ),
            ),

          // Input Section (Collapsible & Multi-URL)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: AppTheme.surfaceContainerLow,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.outlineVariant),
            ),
            child: Column(
              children: [
                if (_isInputExpanded) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: TextField(
                      controller: _inputController,
                      maxLines: 4,
                      style: const TextStyle(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Вставьте ссылки на подписки (каждую с новой строки) либо ключи (vless://, vmess://, ss://, hy2://, tuic://, Base64)...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                        contentPadding: EdgeInsets.zero,
                        suffixIcon: _inputController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18, color: AppTheme.textSecondary),
                                onPressed: () {
                                  _inputController.clear();
                                  setState(() {});
                                },
                              )
                            : null,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const Divider(height: 1, color: AppTheme.outlineVariant),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      // Paste Button
                      FilledButton.tonalIcon(
                        icon: const Icon(Icons.paste_rounded, size: 16),
                        label: const Text('Вставить'),
                        style: FilledButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: _pasteFromClipboard,
                      ),
                      const SizedBox(width: 8),
                      // Parse Button if not loaded
                      if (_inputController.text.isNotEmpty && provider.nodes.isEmpty)
                        FilledButton.tonal(
                          style: FilledButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: _parseKeys,
                          child: const Text('Загрузить'),
                        ),
                      const Spacer(),
                      // Start / Stop Button
                      if (provider.isTesting)
                        FilledButton.icon(
                          icon: const Icon(Icons.stop_rounded, size: 18),
                          label: const Text('Стоп'),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppTheme.error,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: provider.stopBenchmark,
                        )
                      else
                        FilledButton.icon(
                          icon: const Icon(Icons.vpn_key_rounded, size: 18),
                          label: Text(
                            provider.nodes.isEmpty ? 'Запустить тест' : 'Проверить (${provider.nodes.length})',
                          ),
                          onPressed: () async {
                            FocusScope.of(context).unfocus();
                            if (provider.nodes.isEmpty && _inputController.text.isNotEmpty) {
                              await provider.parseInput(_inputController.text.trim());
                            }
                            if (provider.nodes.isNotEmpty) {
                              setState(() => _isInputExpanded = false);
                              provider.startBenchmark();
                            }
                          },
                        ),
                      const SizedBox(width: 4),
                      IconButton(
                        icon: Icon(
                          _isInputExpanded ? Icons.keyboard_arrow_up_rounded : Icons.keyboard_arrow_down_rounded,
                          color: AppTheme.textSecondary,
                          size: 22,
                        ),
                        onPressed: () => setState(() => _isInputExpanded = !_isInputExpanded),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Progress Bar
          ProgressBar(percent: provider.percent, isTesting: provider.isTesting),

          // Stats Bar
          if (provider.nodes.isNotEmpty) StatsHeader(provider: provider),

          // Filters Bar
          if (provider.nodes.isNotEmpty) FilterBar(provider: provider),

          // Main Nodes List (High-performance virtualized builder)
          Expanded(
            child: provider.isLoading
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(color: AppTheme.primary, strokeWidth: 3),
                        SizedBox(height: 16),
                        Text(
                          'Загрузка и парсинг подписок...',
                          style: TextStyle(color: AppTheme.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : provider.nodes.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(22),
                              decoration: BoxDecoration(
                                color: AppTheme.surfaceContainerLow,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.outlineVariant),
                              ),
                              child: const Icon(
                                Icons.vpn_key_rounded,
                                size: 44,
                                color: Color(0xFF3DAE2B),
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'Ключи еще не загружены',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Вставьте ссылки на подписки для быстрого бенчмарка.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      )
                    : nodes.isEmpty
                        ? const Center(
                            child: Text(
                              'Нет ключей, подходящих под критерии поиска',
                              style: TextStyle(color: AppTheme.textSecondary),
                            ),
                          )
                        : ListView.builder(
                            itemCount: nodes.length,
                            cacheExtent: 200,
                            addRepaintBoundaries: true,
                            addAutomaticKeepAlives: false,
                            physics: const BouncingScrollPhysics(),
                            itemBuilder: (context, index) {
                              return NodeCard(
                                key: ValueKey(nodes[index].id),
                                node: nodes[index],
                              );
                            },
                          ),
          ),
        ],
      ),
      // Floating Export Bar when completed
      floatingActionButton: (provider.aliveCount > 0 && !provider.isTesting)
          ? FloatingActionButton.extended(
              backgroundColor: AppTheme.primary,
              foregroundColor: AppTheme.onPrimary,
              elevation: 4,
              icon: const Icon(Icons.file_download_rounded),
              label: Text('Скачать ТОП-${provider.aliveCount > 10 ? 10 : provider.aliveCount} лучших'),
              onPressed: () {
                FocusScope.of(context).unfocus();
                ExportSheet.show(context, provider);
              },
            )
          : null,
    );
  }
}
