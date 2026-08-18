import 'package:flutter/material.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class StatsHeader extends StatelessWidget {
  final ProbeProvider provider;

  const StatsHeader({super.key, required this.provider});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          _buildStatCard(
            'Total',
            '${provider.totalCount}',
            AppTheme.textPrimary,
            Icons.dns_rounded,
          ),
          const SizedBox(width: 8),
          _buildStatCard(
            'Alive',
            '${provider.aliveCount}',
            AppTheme.success,
            Icons.check_circle_outline_rounded,
          ),
          const SizedBox(width: 8),
          _buildStatCard(
            'Dead',
            '${provider.deadCount}',
            AppTheme.error,
            Icons.highlight_off_rounded,
          ),
          const SizedBox(width: 8),
          _buildStatCard(
            'Avg Ping',
            provider.averagePing > 0 ? '${provider.averagePing}ms' : '--',
            AppTheme.primaryAccent,
            Icons.speed_rounded,
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.border),
        ),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(icon, size: 14, color: color.withOpacity(0.8)),
                const SizedBox(width: 4),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
