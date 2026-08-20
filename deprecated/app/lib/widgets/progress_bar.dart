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
    if (!isTesting && percent == 0) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 2.5,
      child: isTesting
          ? LinearProgressIndicator(
              value: percent > 0 ? (percent / 100.0).clamp(0.0, 1.0) : null,
              backgroundColor: AppTheme.dividerDark,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.accent),
            )
          : const Divider(height: 1, color: AppTheme.dividerDark),
    );
  }
}
