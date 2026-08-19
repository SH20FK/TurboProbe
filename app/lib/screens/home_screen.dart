import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import '../models/test_config_model.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';
import 'checker_screen.dart';
import 'settings_dialog.dart';
import 'vpn_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedTabIndex = 0; // 0 = VPN Client, 1 = Checker & Benchmark

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProbeProvider>();

    return Scaffold(
      backgroundColor: AppTheme.surfaceDark,
      appBar: AppBar(
        backgroundColor: AppTheme.surfaceDark,
        elevation: 0,
        centerTitle: false,
        title: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('⚡', style: TextStyle(fontSize: 14)),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              'TURBOPROBE',
              style: GoogleFonts.robotoMono(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.0,
                color: AppTheme.textPrimaryDark,
              ),
            ),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                'v2.0',
                style: GoogleFonts.robotoMono(fontSize: 9.5, fontWeight: FontWeight.bold, color: AppTheme.accent),
              ),
            ),
          ],
        ),
        actions: [
          if (_selectedTabIndex == 1 && provider.totalCount > 0)
            IconButton(
              icon: const Icon(Icons.delete_sweep_outlined, size: 20, color: AppTheme.textSecondaryDark),
              tooltip: 'Очистить список',
              onPressed: () => provider.clearNodes(),
            ),
          IconButton(
            icon: const Icon(Icons.tune, size: 20, color: AppTheme.textSecondaryDark),
            tooltip: 'Настройки',
            onPressed: () async {
              final newConfig = await SettingsDialog.show(context, provider.config);
              if (newConfig != null) {
                provider.updateConfig(newConfig);
              }
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Top Mode Segmented Pill Switcher (Strict tap-only without swipe gestures)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Container(
                height: 44,
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  color: AppTheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: AppTheme.dividerDark),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: _buildSegmentButton(
                        index: 0,
                        icon: Icons.power_settings_new,
                        label: 'VPN КЛИЕНТ',
                        isSelected: _selectedTabIndex == 0,
                      ),
                    ),
                    Expanded(
                      child: _buildSegmentButton(
                        index: 1,
                        icon: Icons.speed,
                        label: 'ЧЕКЕР & БЕНЧ',
                        isSelected: _selectedTabIndex == 1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(height: 1, color: AppTheme.dividerDark),

            // Tab View Body (IndexedStack preserves state without reloading)
            Expanded(
              child: IndexedStack(
                index: _selectedTabIndex,
                children: const [
                  VpnScreen(),
                  CheckerScreen(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSegmentButton({
    required int index,
    required IconData icon,
    required String label,
    required bool isSelected,
  }) {
    return GestureDetector(
      onTap: () => setState(() => _selectedTabIndex = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeInOut,
        decoration: BoxDecoration(
          color: isSelected ? Colors.white : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : [],
        ),
        child: Center(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 16,
                color: isSelected ? Colors.black : AppTheme.textSecondaryDark,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.roboto(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.5,
                  color: isSelected ? Colors.black : AppTheme.textSecondaryDark,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
