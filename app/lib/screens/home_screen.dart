import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/node_model.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/filter_bar.dart';
import '../widgets/node_card.dart';
import '../widgets/progress_bar.dart';
import '../widgets/stats_header.dart';
import '../widgets/vpn_connect_bar.dart';
import 'export_sheet.dart';
import 'settings_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _inputController = TextEditingController();

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
      _parseAndRun();
    }
  }

  void _parseAndRun() async {
    FocusScope.of(context).unfocus();
    final text = _inputController.text.trim();
    if (text.isNotEmpty) {
      final provider = context.read<ProbeProvider>();
      await provider.parseInput(text);
      if (provider.nodes.isNotEmpty) {
        provider.startBenchmark();
      }
    }
  }

  void _showAddKeysDialog() {
    final addController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 20,
          right: 20,
          top: 16,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Добавить ключи или подписки',
                  style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: AppTheme.textSecondaryDark),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addController,
              maxLines: 5,
              style: GoogleFonts.robotoMono(fontSize: 12.5, color: AppTheme.textPrimaryDark),
              decoration: InputDecoration(
                hintText: 'Вставьте ссылки на подписки или ключи (vless://, trojan://, ss://, hy2://, Base64)...',
                hintStyle: GoogleFonts.roboto(fontSize: 12.5, color: AppTheme.textSecondaryDark),
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.paste, size: 16, color: AppTheme.textPrimaryDark),
                  label: const Text('Вставить'),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.dividerDark),
                    foregroundColor: AppTheme.textPrimaryDark,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                  onPressed: () async {
                    final d = await Clipboard.getData('text/plain');
                    if (d?.text != null) addController.text = d!.text!;
                  },
                ),
                const Spacer(),
                FilledButton.icon(
                  icon: const Icon(Icons.play_arrow, size: 16, color: Colors.black),
                  label: const Text('Проверить'),
                  onPressed: () async {
                    Navigator.pop(ctx);
                    if (addController.text.trim().isNotEmpty) {
                      final provider = context.read<ProbeProvider>();
                      await provider.parseInput(addController.text.trim());
                      if (provider.nodes.isNotEmpty) {
                        provider.startBenchmark();
                      }
                    }
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            Text(
              'TurboProbe',
              style: GoogleFonts.roboto(fontSize: 18, fontWeight: FontWeight.w700, letterSpacing: -0.3),
            ),
            // Fine-grained selector for spinner during active benchmark
            Selector<ProbeProvider, bool>(
              selector: (_, p) => p.isTesting,
              builder: (_, isTesting, __) {
                if (!isTesting) return const SizedBox.shrink();
                return const Padding(
                  padding: EdgeInsets.only(left: 8),
                  child: SizedBox(
                    width: 12,
                    height: 12,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accent),
                  ),
                );
              },
            ),
          ],
        ),
        actions: [
          // Add keys icon: visible only if nodes exist
          Selector<ProbeProvider, bool>(
            selector: (_, p) => p.nodes.isNotEmpty,
            builder: (_, hasNodes, __) {
              if (!hasNodes) return const SizedBox.shrink();
              return IconButton(
                icon: const Icon(Icons.add, size: 22),
                tooltip: 'Добавить ключи',
                onPressed: _showAddKeysDialog,
              );
            },
          ),

          // Standard Android Overflow Menu (⋮)
          Selector<ProbeProvider, bool>(
            selector: (_, p) => p.nodes.isNotEmpty,
            builder: (ctx, hasNodes, __) {
              return PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 22),
                onSelected: (val) {
                  FocusScope.of(ctx).unfocus();
                  final provider = ctx.read<ProbeProvider>();
                  if (val == 'settings') {
                    SettingsDialog.show(ctx, provider.config);
                  } else if (val == 'export') {
                    ExportSheet.show(ctx, provider);
                  } else if (val == 'clear') {
                    _inputController.clear();
                    provider.clearNodes();
                  }
                },
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: 'settings',
                    child: Row(
                      children: [
                        const Icon(Icons.settings_outlined, size: 18, color: AppTheme.textSecondaryDark),
                        const SizedBox(width: 10),
                        Text('Настройки', style: GoogleFonts.roboto(fontSize: 13)),
                      ],
                    ),
                  ),
                  if (hasNodes)
                    PopupMenuItem(
                      value: 'export',
                      child: Row(
                        children: [
                          const Icon(Icons.file_download_outlined, size: 18, color: AppTheme.textSecondaryDark),
                          const SizedBox(width: 10),
                          Text('Экспорт ключей', style: GoogleFonts.roboto(fontSize: 13)),
                        ],
                      ),
                    ),
                  if (hasNodes)
                    PopupMenuItem(
                      value: 'clear',
                      child: Row(
                        children: [
                          const Icon(Icons.delete_outline, size: 18, color: AppTheme.statusSlow),
                          const SizedBox(width: 10),
                          Text('Очистить всё', style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.statusSlow)),
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: Column(
        children: [
          // 1. Thin 2.5px Progress Indicator (Granular selector)
          Selector<ProbeProvider, (double, bool)>(
            selector: (_, p) => (p.percent, p.isTesting),
            builder: (_, data, __) => ProgressBar(percent: data.$1, isTesting: data.$2),
          ),

          // 2. Error Banner if any
          Selector<ProbeProvider, String?>(
            selector: (_, p) => p.errorMessage,
            builder: (ctx, errorMsg, __) {
              if (errorMsg == null) return const SizedBox.shrink();
              return Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                color: AppTheme.statusSlow.withOpacity(0.12),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, size: 16, color: AppTheme.statusSlow),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        errorMsg,
                        style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.statusSlow),
                      ),
                    ),
                    IconButton(
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      icon: const Icon(Icons.close, size: 16, color: AppTheme.statusSlow),
                      onPressed: () => ctx.read<ProbeProvider>().clearNodes(),
                    ),
                  ],
                ),
              );
            },
          ),

          // 2.5 Built-in Quick VPN Connect Bar (All-in-one VPN Client)
          const VpnConnectBar(),

          // 3. Stats Summary (Single-line)
          Selector<ProbeProvider, bool>(
            selector: (_, p) => p.nodes.isNotEmpty,
            builder: (ctx, hasNodes, __) {
              if (!hasNodes) return const SizedBox.shrink();
              return StatsHeader(provider: ctx.watch<ProbeProvider>());
            },
          ),

          // 4. Search & 3-Segment Quick Filter (Все / Живые / ТОП)
          Selector<ProbeProvider, bool>(
            selector: (_, p) => p.nodes.isNotEmpty,
            builder: (ctx, hasNodes, __) {
              if (!hasNodes) return const SizedBox.shrink();
              return FilterBar(provider: ctx.watch<ProbeProvider>());
            },
          ),

          // 5. Main Body (Empty State Input OR Grouped Sliver List)
          Expanded(
            child: Selector<ProbeProvider, (bool, bool, bool, Map<String, List<NodeModel>>)>(
              selector: (_, p) => (p.isLoading, p.nodes.isNotEmpty, p.filteredNodes.isEmpty, p.groupedByCountry),
              builder: (_, state, __) {
                final isLoading = state.$1;
                final hasNodes = state.$2;
                final isFilteredEmpty = state.$3;
                final grouped = state.$4;

                if (isLoading) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const SizedBox(
                          width: 28,
                          height: 28,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: AppTheme.accent),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'Загрузка и парсинг подписок...',
                          style: GoogleFonts.roboto(color: AppTheme.textSecondaryDark, fontSize: 13),
                        ),
                      ],
                    ),
                  );
                }

                if (!hasNodes) {
                  return _buildEmptyStateInput();
                }

                if (isFilteredEmpty) {
                  return Center(
                    child: Text(
                      'Нет ключей, подходящих под критерии поиска',
                      style: GoogleFonts.roboto(color: AppTheme.textSecondaryDark, fontSize: 13),
                    ),
                  );
                }

                return _buildGroupedNodeList(grouped);
              },
            ),
          ),
        ],
      ),
      // 6. Flat Google Style FAB «Скачать ТОП-10»
      floatingActionButton: Selector<ProbeProvider, (int, bool)>(
        selector: (_, p) => (p.aliveCount, p.isTesting),
        builder: (ctx, data, __) {
          final aliveCount = data.$1;
          final isTesting = data.$2;

          if (aliveCount == 0 || isTesting) return const SizedBox.shrink();

          return FloatingActionButton.extended(
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            icon: const Icon(Icons.file_download, size: 18, color: Colors.black),
            label: Text(
              'Скачать ТОП-${aliveCount > 10 ? 10 : aliveCount}',
              style: GoogleFonts.roboto(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black),
            ),
            onPressed: () {
              FocusScope.of(ctx).unfocus();
              ExportSheet.show(ctx, ctx.read<ProbeProvider>());
            },
          );
        },
      ),
    );
  }

  // 100% Clean Fullscreen Empty State Input
  Widget _buildEmptyStateInput() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Бенчмарк и фильтр VPN',
            style: GoogleFonts.roboto(fontSize: 20, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
          ),
          const SizedBox(height: 6),
          Text(
            'Вставьте одну или несколько ссылок на подписки либо сырые ключи (vless, trojan, ss, hy2, tuic, Base64):',
            style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textSecondaryDark, height: 1.4),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _inputController,
            maxLines: 8,
            style: GoogleFonts.robotoMono(fontSize: 12.5, color: AppTheme.textPrimaryDark),
            decoration: InputDecoration(
              hintText: 'https://example.com/sub/vless...\nvless://uuid@server:port?...\ntrojan://...\nss://...',
              hintStyle: GoogleFonts.robotoMono(fontSize: 12, color: AppTheme.textTertiaryDark),
              suffixIcon: _inputController.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear, size: 18, color: AppTheme.textSecondaryDark),
                      onPressed: () => setState(() => _inputController.clear()),
                    )
                  : null,
            ),
            onChanged: (_) => setState(() {}),
          ),
          const SizedBox(height: 12),
          Text('Быстрые публичные подписки (Анти-ТСПУ & Белые списки):', style: GoogleFonts.roboto(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textSecondaryDark)),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildPresetChip('🛡️ GitVerse Ru-WL (Белые списки)', 'https://gitverse.ru/api/repos/ru-wbl/wl/raw/branch/master/KvRuVPN/KvRuVPN.txt'),
              _buildPresetChip('⚡ White-SNI Reality (RU)', 'https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/WHITE-SNI-RU-all.txt'),
              _buildPresetChip('🇷🇺 GitVerse Akres All (2000+)', 'https://gitverse.ru/api/repos/Akres/VPN/raw/branch/master/all'),
              _buildPresetChip('🟣 Purple Anti-TSPU', 'https://yahuy.eu.cc/purple.txt'),
              _buildPresetChip('🛡️ Aetris BlackList Bypass', 'https://gitverse.ru/api/repos/flaafix/AetrisVPN_Black_list/raw/branch/master/configs.txt'),
              _buildPresetChip('🌐 Все протоколы (9500+)', 'https://raw.githubusercontent.com/Epodonios/v2ray-configs/main/All_Configs_Sub.txt'),
            ],
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.paste, size: 16, color: AppTheme.textPrimaryDark),
                label: const Text('Вставить из буфера'),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.dividerDark),
                  foregroundColor: AppTheme.textPrimaryDark,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _pasteFromClipboard,
              ),
              const Spacer(),
              FilledButton.icon(
                icon: const Icon(Icons.play_arrow, size: 18, color: Colors.black),
                label: const Text('Запустить тест'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: _inputController.text.trim().isEmpty ? null : _parseAndRun,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPresetChip(String label, String url) {
    return InkWell(
      onTap: () {
        setState(() {
          _inputController.text = url;
        });
        _parseAndRun();
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppTheme.dividerDark, width: 1),
        ),
        child: Text(
          label,
          style: GoogleFonts.roboto(fontSize: 12, fontWeight: FontWeight.w500, color: AppTheme.textPrimaryDark),
        ),
      ),
    );
  }

  // Grouped by Country with Sticky/Section Headers
  Widget _buildGroupedNodeList(Map<String, List<NodeModel>> grouped) {
    final entries = grouped.entries.toList();

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        for (final entry in entries) ...[
          // Sticky / Section Header
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              color: AppTheme.surfaceContainerLowest,
              child: Row(
                children: [
                  Text(
                    entry.key,
                    style: GoogleFonts.roboto(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondaryDark,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text('·', style: TextStyle(color: AppTheme.textTertiaryDark, fontSize: 12)),
                  const SizedBox(width: 6),
                  Text(
                    '${entry.value.length}',
                    style: GoogleFonts.robotoMono(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textTertiaryDark,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Node Rows
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final node = entry.value[index];
                return NodeCard(
                  key: ValueKey(node.id),
                  node: node,
                );
              },
              childCount: entry.value.length,
            ),
          ),
        ],
        // Bottom padding for FAB
        const SliverToBoxAdapter(
          child: SizedBox(height: 80),
        ),
      ],
    );
  }
}
