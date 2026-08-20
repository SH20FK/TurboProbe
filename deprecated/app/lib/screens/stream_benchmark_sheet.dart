import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/node_model.dart';
import '../services/stream_benchmark_service.dart';
import '../theme/app_theme.dart';

class StreamBenchmarkSheet extends StatefulWidget {
  final NodeModel node;

  const StreamBenchmarkSheet({super.key, required this.node});

  static void show(BuildContext context, NodeModel node) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => StreamBenchmarkSheet(node: node),
    );
  }

  @override
  State<StreamBenchmarkSheet> createState() => _StreamBenchmarkSheetState();
}

class _StreamBenchmarkSheetState extends State<StreamBenchmarkSheet> {
  bool _isLoading = true;
  StreamBenchmarkResult? _result;

  @override
  void initState() {
    super.initState();
    _runTest();
  }

  Future<void> _runTest() async {
    setState(() => _isLoading = true);
    final res = await StreamBenchmarkService.runBenchmark(widget.node);
    if (mounted) {
      setState(() {
        _result = res;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppTheme.surfaceContainerLow,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.dividerDark,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 18),

          // Title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '🎬 4K Stream Simulator',
                    style: GoogleFonts.roboto(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimaryDark,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    widget.node.name,
                    style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textTertiaryDark),
                  ),
                ],
              ),
              IconButton(
                icon: const Icon(Icons.close, color: AppTheme.textTertiaryDark),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 24),

          if (_isLoading) ...[
            const SizedBox(height: 30),
            const CircularProgressIndicator(color: AppTheme.accent),
            const SizedBox(height: 20),
            Text(
              'Замер пропускной способности видеопотока...',
              style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textSecondaryDark),
            ),
            const SizedBox(height: 30),
          ] else if (_result != null) ...[
            // Quality Badge Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppTheme.surfaceContainerLowest,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _result!.canStream4K ? AppTheme.statusFast.withOpacity(0.4) : AppTheme.accent.withOpacity(0.3),
                ),
              ),
              child: Column(
                children: [
                  Text(
                    _result!.canStream4K ? '🌟 4K 60FPS READY' : '🎬 HD READY',
                    style: GoogleFonts.robotoMono(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: _result!.canStream4K ? AppTheme.statusFast : AppTheme.accent,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _result!.streamQualityGrade,
                    style: GoogleFonts.roboto(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.textPrimaryDark,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _result!.verdict,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.roboto(fontSize: 13, color: AppTheme.textSecondaryDark, height: 1.4),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Metrics Row
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text('Скорость канала', style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textTertiaryDark)),
                        const SizedBox(height: 4),
                        Text(
                          '${_result!.speedMbps.toStringAsFixed(1)} Мбит/с',
                          style: GoogleFonts.robotoMono(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.accent),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: AppTheme.surfaceContainerLowest,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      children: [
                        Text('Пинг потока', style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textTertiaryDark)),
                        const SizedBox(height: 4),
                        Text(
                          '${_result!.latencyMs} мс',
                          style: GoogleFonts.robotoMono(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.statusFast),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              height: 46,
              child: OutlinedButton.icon(
                icon: const Icon(Icons.refresh, size: 16, color: AppTheme.textPrimaryDark),
                label: const Text('Повторить стресс-тест'),
                onPressed: _runTest,
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppTheme.dividerDark),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
