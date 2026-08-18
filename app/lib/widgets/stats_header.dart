import 'package:flutter/material.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class StatsHeader extends StatelessWidget {
  final ProbeProvider provider;

  const StatsHeader({super.key, required this.provider});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          _buildStatCard('Всего', '${provider.totalCount}', AppTheme.textPrimary, Icons.dns_rounded),
          const SizedBox(width: 8),
          _buildStatCard('Живых', '${provider.aliveCount}', AppTheme.success, Icons.check_circle_rounded),
          const SizedBox(width: 8),
          _buildStatCard('Мертвых', '${provider.deadCount}', AppTheme.error, Icons.cancel_rounded),
          const SizedBox(width: 8),
          _buildStatCard('Ср. пинг', provider.averagePing > 0 ? '${provider.averagePing}мс' : '--', AppTheme.primary, Icons.speed_rounded),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppTheme.outlineVariant),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 13, color: color),
                const SizedBox(width: 4),
                Text(
                  label,
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: color),
            ),
          ],
        ),
      ),
    );
  }
}
