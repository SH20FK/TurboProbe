import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class StatsHeader extends StatelessWidget {
  final ProbeProvider provider;

  const StatsHeader({super.key, required this.provider});

  @override
  Widget build(BuildContext context) {
    if (provider.nodes.isEmpty) return const SizedBox.shrink();

    final pingStr = provider.averagePing > 0 ? '~${provider.averagePing} мс' : '--';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: AppTheme.backgroundDark,
        border: Border(bottom: BorderSide(color: AppTheme.dividerDark, width: 1)),
      ),
      child: Row(
        children: [
          _buildStatItem('${provider.totalCount}', 'всего'),
          _buildDot(),
          _buildStatItem('${provider.aliveCount}', 'живых', countColor: AppTheme.statusFast),
          _buildDot(),
          _buildStatItem('${provider.deadCount}', 'мёртвых', countColor: provider.deadCount > 0 ? AppTheme.statusSlow : AppTheme.textSecondaryDark),
          _buildDot(),
          _buildStatItem(pingStr, '', isMono: true, countColor: provider.averagePing > 0 ? AppTheme.statusFast : AppTheme.textSecondaryDark),
          
          const Spacer(),

          // Quick Clean Dead Nodes Button
          if (provider.deadCount > 0 && !provider.isTesting)
            InkWell(
              onTap: () {
                HapticFeedback.lightImpact();
                provider.purgeDeadAndSortByPing();
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: const Text('🧹 Мёртвые сервера удалены, оставлены самые быстрые!'),
                    duration: const Duration(seconds: 2),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppTheme.dividerDark),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.cleaning_services, size: 12, color: AppTheme.accent),
                    const SizedBox(width: 4),
                    Text(
                      'Вычистить',
                      style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w600, color: AppTheme.accent),
                    ),
                  ],
                ),
              ),
            ),

          // Quick Copy Top Low-Ping Sub Button
          if (provider.aliveCount > 0 && !provider.isTesting) ...[
            const SizedBox(width: 6),
            InkWell(
              onTap: () {
                HapticFeedback.mediumImpact();
                final rawSub = provider.getTopSubscriptionRaw(limit: 50);
                Clipboard.setData(ClipboardData(text: rawSub));
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('📋 Скопировано ${provider.aliveCount > 50 ? 50 : provider.aliveCount} быстрейших серверов с минимальным пингом!'),
                    duration: const Duration(seconds: 2),
                    behavior: SnackBarBehavior.floating,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                  ),
                );
              },
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.statusFast.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: AppTheme.statusFast.withOpacity(0.4)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.bolt, size: 12, color: AppTheme.statusFast),
                    const SizedBox(width: 3),
                    Text(
                      'ТОП Сабка',
                      style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.statusFast),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatItem(String count, String label, {Color? countColor, bool isMono = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          count,
          style: isMono
              ? GoogleFonts.robotoMono(fontSize: 12, fontWeight: FontWeight.w600, color: countColor ?? AppTheme.textPrimaryDark)
              : GoogleFonts.roboto(fontSize: 12, fontWeight: FontWeight.w600, color: countColor ?? AppTheme.textPrimaryDark),
        ),
        if (label.isNotEmpty) ...[
          const SizedBox(width: 3),
          Text(
            label,
            style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textSecondaryDark),
          ),
        ],
      ],
    );
  }

  Widget _buildDot() {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 6),
      child: Text('·', style: TextStyle(color: AppTheme.textTertiaryDark, fontSize: 13)),
    );
  }
}
