import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class ProgressBar extends StatelessWidget {
  final double percent;
  final bool isTesting;

  const ProgressBar({
    super.key,
    required this.percent,
    required this.isTesting,
  });

  @override
  Widget build(BuildContext context) {
    if (!isTesting && percent == 0) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isTesting ? '⚡ Turbo-Probing in progress...' : '✅ Benchmark Complete',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isTesting ? AppTheme.primaryAccent : AppTheme.success,
                ),
              ),
              Text(
                '${percent.toStringAsFixed(1)}%',
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: LinearProgressIndicator(
              value: percent / 100.0,
              minHeight: 6,
              backgroundColor: AppTheme.surfaceLight,
              valueColor: AlwaysStoppedAnimation<Color>(
                isTesting ? AppTheme.primaryAccent : AppTheme.success,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
