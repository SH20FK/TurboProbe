import 'package:flutter/material.dart';
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
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
