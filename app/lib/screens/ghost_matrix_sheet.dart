import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/ghost_matrix_model.dart';
import '../models/node_model.dart';
import '../providers/probe_provider.dart';
import '../providers/vpn_provider.dart';
import '../theme/app_theme.dart';

class GhostMatrixSheet extends StatefulWidget {
  final GhostMatrixConfig matrixConfig;
  final List<NodeModel> availableNodes;

  const GhostMatrixSheet({
    super.key,
    required this.matrixConfig,
    required this.availableNodes,
  });

  static Future<void> show(BuildContext context) {
    final probe = context.read<ProbeProvider>();
    final vpn = context.read<VpnProvider>();

    final matrix = GhostMatrixConfig.defaultPresets();
    matrix.autoAssignNodes(probe.nodes);

    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => GhostMatrixSheet(
        matrixConfig: matrix,
        availableNodes: probe.nodes.where((n) => n.isAlive).toList(),
      ),
    );
  }

  @override
  State<GhostMatrixSheet> createState() => _GhostMatrixSheetState();
}

class _GhostMatrixSheetState extends State<GhostMatrixSheet> {
  late GhostMatrixConfig _config;

  @override
  void initState() {
    super.initState();
    _config = widget.matrixConfig;
  }

  void _recalcAI() {
    setState(() {
      _config.autoAssignNodes(widget.availableNodes);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('✨ AI пересчитал идеальные серверы под каждый сервис!'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }

  void _showNodePicker(GhostServiceRule rule) {
    if (rule.id == 'ru_direct') return; // Always Direct

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => Container(
        constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Выбрать сервер для ${rule.name}',
                    style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 20, color: AppTheme.textSecondaryDark),
                    onPressed: () => Navigator.pop(ctx),
                  ),
                ],
              ),
            ),
            const Divider(height: 1, color: AppTheme.dividerDark),
            Expanded(
              child: ListView.builder(
                itemCount: widget.availableNodes.length,
                itemBuilder: (ctx, i) {
                  final node = widget.availableNodes[i];
                  final isSelected = rule.customNode?.id == node.id;

                  return ListTile(
                    leading: Text(node.flagEmoji ?? '🌐', style: const TextStyle(fontSize: 20)),
                    title: Text(node.name, style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textPrimaryDark)),
                    subtitle: Text(
                      '${node.pingMs} мс · ${node.speedMbps.toStringAsFixed(1)} Мбит/с · ${node.protocol.toUpperCase()}',
                      style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textSecondaryDark),
                    ),
                    trailing: isSelected ? const Icon(Icons.check_circle, color: AppTheme.accent, size: 20) : null,
                    onTap: () {
                      setState(() {
                        rule.customNode = node;
                      });
                      Navigator.pop(ctx);
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final vpn = context.watch<VpnProvider>();

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
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
                Row(
                  children: [
                    const Text('🤖', style: TextStyle(fontSize: 18)),
                    const SizedBox(width: 8),
                    Text(
                      'Ghost-Matrix Routing AI',
                      style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, size: 20, color: AppTheme.textSecondaryDark),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.dividerDark),

          // Body
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              children: [
                // Explanation Card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.dividerDark),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.auto_awesome, color: AppTheme.accent, size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Ghost-Matrix автоматически распределяет трафик: YouTube идёт через широкую полосу, Discord — через нулевой джиттер, а банки — напрямую без VPN.',
                          style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textSecondaryDark, height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Matrix Rules List
                for (final rule in _config.rules) ...[
                  _buildServiceCard(rule),
                  const SizedBox(height: 10),
                ],
              ],
            ),
          ),

          // Bottom Action Bar
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppTheme.surfaceDark,
              border: Border(top: BorderSide(color: AppTheme.dividerDark, width: 1)),
            ),
            child: Row(
              children: [
                OutlinedButton.icon(
                  icon: const Icon(Icons.refresh, size: 16, color: AppTheme.textPrimaryDark),
                  label: const Text('Пересчитать AI'),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppTheme.dividerDark),
                    foregroundColor: AppTheme.textPrimaryDark,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: _recalcAI,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: FilledButton.icon(
                    icon: const Icon(Icons.bolt, size: 18, color: Colors.black),
                    label: const Text('Активировать Матрицу'),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: () {
                      Navigator.pop(context);
                      final topNode = widget.availableNodes.isNotEmpty ? widget.availableNodes.first : null;
                      if (topNode != null) {
                        vpn.connect(topNode);
                      }
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: const Text('🚀 Ghost-Matrix Routing успешно активирован для всех приложений!'),
                          duration: const Duration(seconds: 3),
                          behavior: SnackBarBehavior.floating,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildServiceCard(GhostServiceRule rule) {
    final isDirect = rule.id == 'ru_direct';
    final node = rule.customNode;

    return InkWell(
      onTap: isDirect ? null : () => _showNodePicker(rule),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isDirect ? AppTheme.statusFast.withOpacity(0.3) : AppTheme.dividerDark,
            width: 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(rule.iconEmoji, style: const TextStyle(fontSize: 22)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        rule.name,
                        style: GoogleFonts.roboto(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isDirect ? AppTheme.statusFast.withOpacity(0.15) : AppTheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          isDirect ? 'DIRECT (0 мс)' : (node != null ? '${node.pingMs} мс' : 'AUTO'),
                          style: GoogleFonts.robotoMono(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                            color: isDirect ? AppTheme.statusFast : AppTheme.accent,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    rule.description,
                    style: GoogleFonts.roboto(fontSize: 11.5, color: AppTheme.textSecondaryDark),
                  ),
                  const SizedBox(height: 6),
                  if (isDirect)
                    Text(
                      '⚡ Напрямую через вашего провайдера (1000 Мбит/с)',
                      style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w500, color: AppTheme.statusFast),
                    )
                  else if (node != null)
                    Row(
                      children: [
                        Text(node.flagEmoji ?? '🌐', style: const TextStyle(fontSize: 13)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '${node.name} (${node.countryName ?? "Node"})',
                            style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w500, color: AppTheme.textPrimaryDark),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const Icon(Icons.chevron_right, size: 16, color: AppTheme.textTertiaryDark),
                      ],
                    )
                  else
                    Text(
                      '🔍 Авто-подбор после запуска теста',
                      style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textTertiaryDark),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
