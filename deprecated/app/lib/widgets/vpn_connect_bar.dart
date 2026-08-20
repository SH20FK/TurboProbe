import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/node_model.dart';
import '../providers/probe_provider.dart';
import '../providers/vpn_provider.dart';
import '../screens/ghost_matrix_sheet.dart';
import '../screens/topology_hud_sheet.dart';
import '../services/vpn_service.dart';
import '../theme/app_theme.dart';

class VpnConnectBar extends StatelessWidget {
  const VpnConnectBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer2<VpnProvider, ProbeProvider>(
      builder: (context, vpn, probe, _) {
        // Find best node if not connected
        NodeModel? targetNode = vpn.activeNode;
        if (targetNode == null) {
          final aliveNodes = probe.nodes.where((n) => n.isAlive).toList();
          if (aliveNodes.isNotEmpty) {
            aliveNodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));
            targetNode = aliveNodes.first;
          }
        }

        if (targetNode == null && !vpn.isConnected && !vpn.isConnecting) {
          return const SizedBox.shrink();
        }

        final isConnected = vpn.isConnected;
        final isConnecting = vpn.isConnecting;

        return Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: isConnected ? AppTheme.surfaceContainer : AppTheme.surfaceContainerLow,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isConnected ? AppTheme.statusFast.withOpacity(0.5) : AppTheme.dividerDark,
              width: 1,
            ),
          ),
          child: Row(
            children: [
              // Status Indicator Dot or Spinner
              if (isConnecting)
                const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.accent),
                )
              else
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: isConnected ? AppTheme.statusFast : AppTheme.statusDead,
                  ),
                ),
              const SizedBox(width: 12),

              // Info Column
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Text(
                          isConnected
                              ? 'VPN АКТИВЕН (${vpn.durationFormatted})'
                              : (isConnecting ? 'ПОДКЛЮЧЕНИЕ...' : 'РЕКОМЕНДУЕМЫЙ СЕРВЕР'),
                          style: GoogleFonts.roboto(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.5,
                            color: isConnected ? AppTheme.statusFast : AppTheme.textTertiaryDark,
                          ),
                        ),
                        const Spacer(),
                        if (targetNode != null)
                          InkWell(
                            onTap: () => TopologyHudSheet.show(context, targetNode!),
                            borderRadius: BorderRadius.circular(4),
                            child: Container(
                              margin: const EdgeInsets.only(right: 6),
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                              decoration: BoxDecoration(
                                color: AppTheme.surfaceContainerHighest,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Text('📊', style: TextStyle(fontSize: 10)),
                                  const SizedBox(width: 3),
                                  Text(
                                    'HUD',
                                    style: GoogleFonts.roboto(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.statusFast),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        InkWell(
                          onTap: () => GhostMatrixSheet.show(context),
                          borderRadius: BorderRadius.circular(4),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                            decoration: BoxDecoration(
                              color: AppTheme.surfaceContainerHighest,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Text('🤖', style: TextStyle(fontSize: 10)),
                                const SizedBox(width: 3),
                                Text(
                                  'Ghost-Matrix',
                                  style: GoogleFonts.roboto(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.accent),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      targetNode != null
                          ? '${targetNode.flagEmoji ?? "🌐"} ${targetNode.name}'
                          : 'Быстрый сервер',
                      style: GoogleFonts.roboto(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppTheme.textPrimaryDark,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (targetNode != null && isConnected) ...[
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            'Пинг: ${targetNode.pingMs} мс · ⬇️ ${vpn.downloadSpeedMbps.toStringAsFixed(1)} Мбит/с',
                            style: GoogleFonts.robotoMono(fontSize: 10.5, color: AppTheme.textSecondaryDark),
                          ),
                          const SizedBox(width: 6),
                          const Text('·', style: TextStyle(color: AppTheme.textTertiaryDark, fontSize: 10)),
                          const SizedBox(width: 6),
                          Text(
                            '🔄 Sentinel ON',
                            style: GoogleFonts.roboto(fontSize: 10, fontWeight: FontWeight.w600, color: AppTheme.statusFast),
                          ),
                        ],
                      ),
                    ],
                    if (vpn.lastSentinelMessage != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        vpn.lastSentinelMessage!,
                        style: GoogleFonts.roboto(fontSize: 10.5, fontWeight: FontWeight.w500, color: AppTheme.accent),
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(width: 10),

              // Connect / Disconnect Action Button
              FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: isConnected ? AppTheme.surfaceContainerHighest : Colors.white,
                  foregroundColor: isConnected ? AppTheme.statusSlow : Colors.black,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                onPressed: isConnecting
                    ? null
                    : () {
                        if (isConnected) {
                          vpn.disconnect();
                        } else if (targetNode != null) {
                          vpn.connect(targetNode);
                        }
                      },
                child: Text(
                  isConnected ? 'Отключить' : 'Включить',
                  style: GoogleFonts.roboto(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: isConnected ? AppTheme.statusSlow : Colors.black,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
