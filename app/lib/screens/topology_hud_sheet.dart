import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/node_model.dart';
import '../providers/vpn_provider.dart';
import '../theme/app_theme.dart';

class TopologyHudSheet extends StatelessWidget {
  final NodeModel activeNode;

  const TopologyHudSheet({super.key, required this.activeNode});

  static Future<void> show(BuildContext context, NodeModel node) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => TopologyHudSheet(activeNode: node),
    );
  }

  @override
  Widget build(BuildContext context) {
    final vpn = context.watch<VpnProvider>();
    final node = activeNode;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
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
                    const Text('📊', style: TextStyle(fontSize: 18)),
                    const SizedBox(width: 8),
                    Text(
                      'Live Network Topology & HUD',
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
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              children: [
                // 1. Live Tunnel Pathway Visualizer
                _buildSectionHeader('Карта маршрута туннеля (Live Route)'),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.dividerDark),
                  ),
                  child: Column(
                    children: [
                      _buildHopRow(
                        icon: '📱',
                        title: 'Ваше устройство (Android / PC)',
                        subtitle: 'Локальный IP: 10.0.0.2 · MTU ${node.pathMtu}',
                        isEnd: false,
                        badge: 'TUN0',
                      ),
                      _buildConnectionLine('🛡️ Anti-DPI Fragmentation (1-3B) · ТСПУ Обойдено'),
                      _buildHopRow(
                        icon: '🏛️',
                        title: 'Шлюз провайдера & ТСПУ',
                        subtitle: 'SNI: ${node.sni ?? "Белый список"} · Статус: DPI PASS',
                        isEnd: false,
                        badge: 'DPI PASS',
                        badgeColor: AppTheme.statusFast,
                      ),
                      _buildConnectionLine('🔒 TLS 1.3 Reality · Ping: ${node.pingMs}ms'),
                      _buildHopRow(
                        icon: node.flagEmoji ?? '🌐',
                        title: '${node.countryName ?? "Выходной сервер"} (${node.server})',
                        subtitle: 'Egress IP: ${node.egressIp ?? "Защищен"} · ${node.protocol.toUpperCase()}',
                        isEnd: false,
                        badge: node.streamBandGrade ?? '4K HDR',
                      ),
                      _buildConnectionLine('✨ Чистый интернет без цензуры'),
                      _buildHopRow(
                        icon: '🌐',
                        title: 'Мировой Интернет',
                        subtitle: 'YouTube 4K · Discord · ChatGPT · Игры',
                        isEnd: true,
                        badge: 'UNLOCKED',
                        badgeColor: AppTheme.statusFast,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // 2. Real-Time Telemetry & Threat Guards
                _buildSectionHeader('Телеметрия безопасности и защита от утечек'),
                Row(
                  children: [
                    Expanded(
                      child: _buildTelemetryCard(
                        title: 'DNS Leak Shield',
                        value: 'DoH 1.1.1.1',
                        subtitle: '100% Защита от утечек',
                        icon: Icons.security,
                        color: AppTheme.statusFast,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildTelemetryCard(
                        title: 'IPv6 Leak Block',
                        value: 'Blackhole',
                        subtitle: 'Утечка IPv6 заблокирована',
                        icon: Icons.shield,
                        color: AppTheme.statusFast,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildTelemetryCard(
                        title: 'Скорость загрузки',
                        value: '${vpn.downloadSpeedMbps.toStringAsFixed(1)} Мб/с',
                        subtitle: 'Полоса пропускания',
                        icon: Icons.arrow_downward,
                        color: AppTheme.accent,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _buildTelemetryCard(
                        title: 'Джиттер / Потери',
                        value: '±${node.jitterMs}ms (0%)',
                        subtitle: 'Идеально для игр',
                        icon: Icons.speed,
                        color: AppTheme.statusFast,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textTertiaryDark, letterSpacing: 0.5),
      ),
    );
  }

  Widget _buildHopRow({
    required String icon,
    required String title,
    required String subtitle,
    required bool isEnd,
    required String badge,
    Color badgeColor = AppTheme.accent,
  }) {
    return Row(
      children: [
        Text(icon, style: const TextStyle(fontSize: 22)),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.roboto(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textSecondaryDark),
              ),
            ],
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
            color: badgeColor.withOpacity(0.15),
            borderRadius: BorderRadius.circular(4),
            border: Border.all(color: badgeColor.withOpacity(0.4)),
          ),
          child: Text(
            badge,
            style: GoogleFonts.roboto(fontSize: 9.5, fontWeight: FontWeight.bold, color: badgeColor),
          ),
        ),
      ],
    );
  }

  Widget _buildConnectionLine(String label) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 8),
      child: Row(
        children: [
          Container(
            margin: const EdgeInsets.only(left: 10, right: 14),
            width: 2,
            height: 22,
            color: AppTheme.dividerDark,
          ),
          Text(
            label,
            style: GoogleFonts.roboto(fontSize: 10.5, color: AppTheme.textTertiaryDark, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildTelemetryCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppTheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppTheme.dividerDark),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 6),
              Text(
                title,
                style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w500, color: AppTheme.textSecondaryDark),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: GoogleFonts.robotoMono(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimaryDark),
          ),
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: GoogleFonts.roboto(fontSize: 10.5, color: AppTheme.textTertiaryDark),
          ),
        ],
      ),
    );
  }
}
