import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/node_model.dart';
import '../providers/probe_provider.dart';
import '../providers/vpn_provider.dart';
import '../theme/app_theme.dart';
import 'ghost_matrix_sheet.dart';
import 'location_picker_sheet.dart';
import 'topology_hud_sheet.dart';
import 'split_tunnel_sheet.dart';

class VpnScreen extends StatefulWidget {
  const VpnScreen({super.key});

  @override
  State<VpnScreen> createState() => _VpnScreenState();
}

class _VpnScreenState extends State<VpnScreen> with SingleTickerProviderStateMixin {
  bool _smartRuDirect = true;
  bool _antiDpiShield = true;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: 0.95, end: 1.06).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final vpn = context.watch<VpnProvider>();
    final probe = context.watch<ProbeProvider>();

    // Target node to connect to
    NodeModel? targetNode = vpn.activeNode;
    if (targetNode == null) {
      final alive = probe.nodes.where((n) => n.isAlive).toList();
      if (alive.isNotEmpty) {
        alive.sort((a, b) => a.pingMs.compareTo(b.pingMs));
        targetNode = alive.first;
      }
    }

    final isConnected = vpn.isConnected;
    final isConnecting = vpn.isConnecting;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Column(
        children: [
          // 1. Status Pill Badge
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: isConnected
                  ? AppTheme.statusFast.withOpacity(0.15)
                  : (isConnecting ? AppTheme.accent.withOpacity(0.15) : AppTheme.surfaceContainerLow),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: isConnected
                    ? AppTheme.statusFast.withOpacity(0.4)
                    : (isConnecting ? AppTheme.accent.withOpacity(0.4) : AppTheme.dividerDark),
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedBuilder(
                  animation: _pulseAnimation,
                  builder: (context, child) => Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: isConnected
                          ? AppTheme.statusFast
                          : (isConnecting ? AppTheme.accent : AppTheme.statusSlow),
                      shape: BoxShape.circle,
                      boxShadow: isConnected
                          ? [
                              BoxShadow(
                                color: AppTheme.statusFast.withOpacity(0.6),
                                blurRadius: 6 * _pulseAnimation.value,
                                spreadRadius: 2 * _pulseAnimation.value,
                              ),
                            ]
                          : [],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  isConnected
                      ? 'ЗАЩИЩЕНО · ${vpn.durationFormatted}'
                      : (isConnecting ? 'ПОДКЛЮЧЕНИЕ...' : 'НЕ ЗАЩИЩЕНО'),
                  style: GoogleFonts.robotoMono(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: isConnected
                        ? AppTheme.statusFast
                        : (isConnecting ? AppTheme.accent : AppTheme.textSecondaryDark),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // 2. Central Animated Power Switch with Breathing Pulse
          GestureDetector(
            onTap: isConnecting
                ? null
                : () {
                    HapticFeedback.mediumImpact();
                    if (isConnected) {
                      vpn.disconnect();
                    } else if (targetNode != null) {
                      vpn.connect(targetNode, fallbackNodes: probe.nodes.where((n) => n.isAlive).toList());
                    } else {
                      LocationPickerSheet.show(context);
                    }
                  },
            child: AnimatedBuilder(
              animation: _pulseAnimation,
              builder: (context, child) {
                final scale = isConnected ? _pulseAnimation.value : 1.0;
                return Transform.scale(
                  scale: scale,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 300),
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isConnected ? Colors.white : AppTheme.surfaceContainerLow,
                      border: Border.all(
                        color: isConnected
                            ? Colors.white
                            : (isConnecting ? AppTheme.accent : AppTheme.dividerDark),
                        width: isConnected ? 4 : 2,
                      ),
                      boxShadow: isConnected
                          ? [
                              BoxShadow(
                                color: Colors.white.withOpacity(0.35 * _pulseAnimation.value),
                                blurRadius: 35 * _pulseAnimation.value,
                                spreadRadius: 6 * _pulseAnimation.value,
                              ),
                              BoxShadow(
                                color: AppTheme.accent.withOpacity(0.2),
                                blurRadius: 60,
                                spreadRadius: 10,
                              ),
                            ]
                          : [],
                    ),
                    child: Center(
                      child: isConnecting
                          ? const SizedBox(
                              width: 40,
                              height: 40,
                              child: CircularProgressIndicator(
                                strokeWidth: 3,
                                color: AppTheme.accent,
                              ),
                            )
                          : Icon(
                              Icons.power_settings_new,
                              size: 56,
                              color: isConnected ? Colors.black : AppTheme.textPrimaryDark,
                            ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 14),

          // Quick tap hint
          Text(
            isConnected
                ? 'Нажмите, чтобы отключить'
                : (targetNode != null ? 'Нажмите для подключения' : 'Выберите сервер'),
            style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textTertiaryDark),
          ),
          const SizedBox(height: 24),

          // 3. Active Server Card (Tap to pick server)
          InkWell(
            onTap: () => LocationPickerSheet.show(context),
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppTheme.dividerDark),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppTheme.dividerDark),
                    ),
                    child: Center(
                      child: Text(
                        targetNode?.flagEmoji ?? '🌐',
                        style: const TextStyle(fontSize: 24),
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              targetNode?.countryName ?? 'Авто-выбор локации',
                              style: GoogleFonts.roboto(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimaryDark,
                              ),
                            ),
                            if (targetNode != null) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: AppTheme.getPingColor(targetNode.pingMs).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '${targetNode.pingMs} ms',
                                  style: GoogleFonts.robotoMono(
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.getPingColor(targetNode.pingMs),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Text(
                          targetNode != null
                              ? '${targetNode.name} · ${targetNode.protocol.toUpperCase()}'
                              : 'Нажмите, чтобы выбрать сервер',
                          style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textSecondaryDark),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_right, color: AppTheme.textTertiaryDark, size: 20),
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),

          // 4. Real-Time Telemetry Bar (Download / Upload / Speed)
          if (isConnected) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainerLow,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.dividerDark),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _buildTelemetryStat(
                      icon: Icons.arrow_downward,
                      label: 'Загрузка',
                      value: '${vpn.downloadSpeedMbps.toStringAsFixed(1)} Мб/с',
                      color: AppTheme.accent,
                    ),
                  ),
                  Container(width: 1, height: 32, color: AppTheme.dividerDark),
                  Expanded(
                    child: _buildTelemetryStat(
                      icon: Icons.arrow_upward,
                      label: 'Отдача',
                      value: '${vpn.uploadSpeedMbps.toStringAsFixed(1)} Мб/с',
                      color: AppTheme.statusFast,
                    ),
                  ),
                  Container(width: 1, height: 32, color: AppTheme.dividerDark),
                  Expanded(
                    child: _buildTelemetryStat(
                      icon: Icons.timer_outlined,
                      label: 'Сессия',
                      value: vpn.durationFormatted,
                      color: AppTheme.textPrimaryDark,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // 5. 4 Functional Security & Routing Modules
          _buildSectionTitle('Модули защиты и маршрутизации'),
          const SizedBox(height: 10),

          // Module 1: Ghost-Matrix Routing AI
          _buildActionTile(
            icon: '🤖',
            title: 'Ghost-Matrix Routing AI',
            subtitle: 'YouTube 4K, Discord, ChatGPT и Банки разделены',
            trailing: const Icon(Icons.chevron_right, color: AppTheme.textTertiaryDark, size: 18),
            onTap: () => GhostMatrixSheet.show(context),
          ),
          const SizedBox(height: 8),

          // Module 2: Network Topology HUD
          _buildActionTile(
            icon: '📊',
            title: 'HUD Маршрута & Защиты',
            subtitle: 'DoH 1.1.1.1 · IPv6 Blackhole · DPI Bypass статус',
            trailing: const Icon(Icons.chevron_right, color: AppTheme.textTertiaryDark, size: 18),
            onTap: () {
              if (targetNode != null) {
                TopologyHudSheet.show(context, targetNode);
              }
            },
          ),
          const SizedBox(height: 8),

          // Module 3: Anti-DPI Shield Switch
          _buildSwitchTile(
            icon: '🛡️',
            title: 'Anti-DPI Shield (Хамелеон)',
            subtitle: 'TLS ClientHello Micro-Fragmentation (1-3B)',
            value: _antiDpiShield,
            onChanged: (val) {
              setState(() => _antiDpiShield = val);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(val ? '🛡️ Anti-DPI расщепление пакетов ВКЛЮЧЕНО' : 'Anti-DPI выключено'),
                  duration: const Duration(seconds: 2),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          const SizedBox(height: 8),

          // Module 4: Smart RU Direct Switch
          _buildSwitchTile(
            icon: '🇷🇺',
            title: 'Smart RU Direct',
            subtitle: 'Госуслуги, Сбер, VK, Ozon, .RU идут напрямую 0ms',
            value: _smartRuDirect,
            onChanged: (val) {
              setState(() => _smartRuDirect = val);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(val ? '🇷🇺 Smart RU Direct ВКЛЮЧЕН (Банки идут напрямую)' : 'Весь трафик направлен в VPN'),
                  duration: const Duration(seconds: 2),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            },
          ),
          const SizedBox(height: 8),

          // Module 5: Split-Tunneling (Per-App Proxying)
          _buildActionTile(
            icon: '🎯',
            title: 'Раздельное туннелирование',
            subtitle: 'Выбор приложений: YouTube, Discord через VPN, банки напрямую',
            trailing: const Icon(Icons.chevron_right, color: AppTheme.textTertiaryDark, size: 18),
            onTap: () => SplitTunnelSheet.show(context),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.roboto(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: AppTheme.textTertiaryDark,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildTelemetryStat({
    required IconData icon,
    required String label,
    required String value,
    required Color color,
  }) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 12, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.roboto(fontSize: 10.5, color: AppTheme.textTertiaryDark),
            ),
          ],
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.robotoMono(fontSize: 12.5, fontWeight: FontWeight.bold, color: AppTheme.textPrimaryDark),
        ),
      ],
    );
  }

  Widget _buildActionTile({
    required String icon,
    required String title,
    required String subtitle,
    required Widget trailing,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.dividerDark),
        ),
        child: Row(
          children: [
            Text(icon, style: const TextStyle(fontSize: 20)),
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
                    style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textSecondaryDark),
                  ),
                ],
              ),
            ),
            trailing,
          ],
        ),
      ),
    );
  }

  Widget _buildSwitchTile({
    required String icon,
    required String title,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppTheme.surfaceContainerLow,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.dividerDark),
      ),
      child: Row(
        children: [
          Text(icon, style: const TextStyle(fontSize: 20)),
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
                  style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textSecondaryDark),
                ),
              ],
            ),
          ),
          Switch(
            value: value,
            activeColor: AppTheme.accent,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
