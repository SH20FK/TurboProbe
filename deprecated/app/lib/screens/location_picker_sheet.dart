import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/node_model.dart';
import '../providers/probe_provider.dart';
import '../providers/vpn_provider.dart';
import '../theme/app_theme.dart';

class LocationPickerSheet extends StatefulWidget {
  const LocationPickerSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => const LocationPickerSheet(),
    );
  }

  @override
  State<LocationPickerSheet> createState() => _LocationPickerSheetState();
}

class _LocationPickerSheetState extends State<LocationPickerSheet> {
  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final probe = context.watch<ProbeProvider>();
    final vpn = context.watch<VpnProvider>();

    final aliveNodes = probe.nodes.where((n) => n.isAlive).toList();
    aliveNodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));

    final filteredNodes = aliveNodes.where((n) {
      if (_searchQuery.isEmpty) return true;
      final q = _searchQuery.toLowerCase();
      return n.name.toLowerCase().contains(q) ||
          (n.countryName ?? '').toLowerCase().contains(q) ||
          (n.countryCode ?? '').toLowerCase().contains(q);
    }).toList();

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
                Row(
                  children: [
                    const Icon(Icons.public, color: AppTheme.accent, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Выбор локации сервера',
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

          // Search Box
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: TextField(
              style: GoogleFonts.roboto(color: AppTheme.textPrimaryDark, fontSize: 13),
              decoration: InputDecoration(
                hintText: 'Поиск по стране, городу или имени...',
                hintStyle: GoogleFonts.roboto(color: AppTheme.textTertiaryDark, fontSize: 13),
                prefixIcon: const Icon(Icons.search, size: 18, color: AppTheme.textTertiaryDark),
                filled: true,
                fillColor: AppTheme.surfaceContainerLow,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.dividerDark)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: const BorderSide(color: AppTheme.dividerDark)),
              ),
              onChanged: (val) => setState(() => _searchQuery = val.trim()),
            ),
          ),

          // Auto-Select Best Node Option
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: InkWell(
              onTap: () {
                if (aliveNodes.isNotEmpty) {
                  vpn.connect(aliveNodes.first, fallbackNodes: aliveNodes);
                  Navigator.pop(context);
                }
              },
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.accent.withOpacity(0.4)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: AppTheme.accent.withOpacity(0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.bolt, color: AppTheme.accent, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '⚡ Авто-выбор (Самый быстрый сервер)',
                            style: GoogleFonts.roboto(fontSize: 13.5, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            aliveNodes.isNotEmpty
                                ? 'Рекомендуем: ${aliveNodes.first.flagEmoji ?? "🌐"} ${aliveNodes.first.countryName ?? aliveNodes.first.name} (${aliveNodes.first.pingMs} ms)'
                                : 'Запустите чекер для поиска лучших серверов',
                            style: GoogleFonts.roboto(fontSize: 11.5, color: AppTheme.textSecondaryDark),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: AppTheme.textTertiaryDark, size: 18),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),

          // Node List
          Expanded(
            child: filteredNodes.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Text(
                        aliveNodes.isEmpty
                            ? 'Нет протестированных серверов.\nПерейдите во вкладку «Чекер» и запустите тест.'
                            : 'Ничего не найдено по запросу "$_searchQuery"',
                        style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textTertiaryDark, height: 1.4),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    itemCount: filteredNodes.length,
                    itemBuilder: (context, idx) {
                      final node = filteredNodes[idx];
                      final isSelected = vpn.activeNode?.id == node.id;

                      return Container(
                        margin: const EdgeInsets.only(bottom: 6),
                        child: ListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(
                              color: isSelected ? AppTheme.accent : AppTheme.dividerDark,
                              width: isSelected ? 1.5 : 1,
                            ),
                          ),
                          tileColor: isSelected ? AppTheme.surfaceContainerHighest : AppTheme.surfaceContainerLow,
                          leading: Text(node.flagEmoji ?? '🌐', style: const TextStyle(fontSize: 22)),
                          title: Text(
                            node.name,
                            style: GoogleFonts.roboto(
                              fontSize: 13,
                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                              color: AppTheme.textPrimaryDark,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            '${node.countryName ?? "Сервер"} · ${node.protocol.toUpperCase()} · ${node.speedMbps.toStringAsFixed(1)} Мб/с',
                            style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textSecondaryDark),
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppTheme.getPingColor(node.pingMs).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '${node.pingMs} ms',
                                  style: GoogleFonts.robotoMono(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.getPingColor(node.pingMs),
                                  ),
                                ),
                              ),
                              if (isSelected) ...[
                                const SizedBox(width: 8),
                                const Icon(Icons.check_circle, color: AppTheme.accent, size: 18),
                              ],
                            ],
                          ),
                          onTap: () {
                            vpn.connect(node, fallbackNodes: aliveNodes);
                            Navigator.pop(context);
                          },
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
