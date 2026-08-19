import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/node_model.dart';
import '../theme/app_theme.dart';

class NodeCard extends StatefulWidget {
  final NodeModel node;

  const NodeCard({super.key, required this.node});

  @override
  State<NodeCard> createState() => _NodeCardState();
}

class _NodeCardState extends State<NodeCard> {
  bool _isExpanded = false;

  void _copyKey() {
    Clipboard.setData(ClipboardData(text: widget.node.rawUri));
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Ключ скопирован в буфер: ${widget.node.name}'),
        duration: const Duration(seconds: 1),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final node = widget.node;
    final pingColor = AppTheme.getPingColor(node.pingMs);
    final pingText = node.isAlive
        ? '${node.pingMs} ms'
        : (node.pingMs > 0 && node.pingMs < 9999 ? '${node.pingMs} ms' : 'dead');

    return Dismissible(
      key: ValueKey('swipe_${node.id}'),
      direction: DismissDirection.horizontal,
      confirmDismiss: (dir) async {
        _copyKey();
        return false; // Don't delete, just copy on swipe!
      },
      background: Container(
        color: AppTheme.accent.withOpacity(0.2),
        alignment: Alignment.centerLeft,
        padding: const EdgeInsets.only(left: 20),
        child: const Icon(Icons.copy, color: AppTheme.accent, size: 20),
      ),
      secondaryBackground: Container(
        color: AppTheme.accent.withOpacity(0.2),
        alignment: Alignment.centerRight,
        padding: const EdgeInsets.only(right: 20),
        child: const Icon(Icons.copy, color: AppTheme.accent, size: 20),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () => setState(() => _isExpanded = !_isExpanded),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  // 1. Country Flag
                  Text(
                    node.flagEmoji ?? '🌐',
                    style: const TextStyle(fontSize: 20),
                  ),
                  const SizedBox(width: 12),

                  // 2. Name & Server:Port (Roboto + Roboto Mono)
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                node.name,
                                style: GoogleFonts.roboto(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w500,
                                  color: node.isAlive ? AppTheme.textPrimaryDark : AppTheme.textSecondaryDark,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            if (node.isDuplicate) ...[
                              const SizedBox(width: 4),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0.5),
                                decoration: BoxDecoration(
                                  color: AppTheme.surfaceContainerHighest,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                                child: Text(
                                  'КЛОН',
                                  style: GoogleFonts.roboto(fontSize: 8.5, fontWeight: FontWeight.bold, color: AppTheme.textSecondaryDark),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              '${node.server}:${node.port}',
                              style: GoogleFonts.robotoMono(
                                fontSize: 11.5,
                                color: AppTheme.textSecondaryDark,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(width: 6),
                            const Text('·', style: TextStyle(color: AppTheme.textTertiaryDark, fontSize: 11)),
                            const SizedBox(width: 6),
                            Text(
                              node.protocol.toUpperCase(),
                              style: GoogleFonts.roboto(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textSecondaryDark,
                              ),
                            ),
                            if (node.streamBandGrade != null && node.isAlive) ...[
                              const SizedBox(width: 6),
                              const Text('·', style: TextStyle(color: AppTheme.textTertiaryDark, fontSize: 11)),
                              const SizedBox(width: 6),
                              Text(
                                node.streamBandGrade!,
                                style: GoogleFonts.roboto(
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w600,
                                  color: node.speedMbps >= 50 ? AppTheme.statusFast : AppTheme.textSecondaryDark,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(width: 10),

                  // 3. Trailing: Realistic Monospace Ping + Status Dot
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        pingText,
                        style: GoogleFonts.robotoMono(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: node.isAlive ? pingColor : AppTheme.textTertiaryDark,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: pingColor,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Icon(
                        _isExpanded ? Icons.expand_less : Icons.expand_more,
                        size: 18,
                        color: AppTheme.textTertiaryDark,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          // Expanded Details Row (5 Author Mechanics Details)
          if (_isExpanded)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.fromLTRB(48, 4, 16, 12),
              color: AppTheme.surfaceContainerLowest,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Service Badges
                  if (node.isAlive) ...[
                    Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: [
                        if (node.unlockYouTube) _buildServiceBadge('🎬 YouTube 4K'),
                        if (node.unlockDiscord) _buildServiceBadge('💬 Discord'),
                        if (node.unlockOpenAI) _buildServiceBadge('🤖 ChatGPT'),
                        if (node.isTSPUResistant) _buildServiceBadge('🛡 Анти-ТСПУ (DPI Pass)'),
                        if (node.isTSPUThrottled)
                          _buildServiceBadge('⚠️ Глушится ТСПУ (DPI Drop)', isWarning: true),
                        if (node.isCleanIp)
                          _buildServiceBadge('✨ Чистый IP (Без капчи)')
                        else
                          _buildServiceBadge('⚠️ Cloudflare Captcha Risk', isWarning: true),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],

                  // Connection Metrics
                  if (node.isAlive) ...[
                    Text(
                      'Реалистичный пинг (CRL): ${node.pingMs} мс (джиттер ±${node.jitterMs} мс)',
                      style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textPrimaryDark),
                    ),
                    Text(
                      'Скорость потока: ~${node.speedMbps.toStringAsFixed(1)} Мбит/с (${node.streamBandGrade ?? "HD"})',
                      style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textSecondaryDark),
                    ),
                  ],
                  if (node.egressIp != null)
                    Text('Реальный Egress IP: ${node.egressIp}', style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textSecondaryDark)),
                  if (node.isDuplicate && node.duplicateOfName != null)
                    Text('Дубликат хоста: ${node.duplicateOfName}', style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.textTertiaryDark)),
                  if (node.sni != null && node.sni!.isNotEmpty)
                    Text('SNI: ${node.sni}', style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textSecondaryDark)),
                  if (node.errorMsg != null && node.errorMsg!.isNotEmpty)
                    Text('Ошибка: ${node.errorMsg}', style: GoogleFonts.roboto(fontSize: 11, color: AppTheme.statusSlow)),

                  const SizedBox(height: 10),

                  // Copy Action
                  InkWell(
                    onTap: _copyKey,
                    borderRadius: BorderRadius.circular(4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        border: Border.all(color: AppTheme.dividerDark, width: 1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.copy, size: 14, color: AppTheme.accent),
                          const SizedBox(width: 6),
                          Text('Скопировать ключ', style: GoogleFonts.roboto(fontSize: 12, fontWeight: FontWeight.w500, color: AppTheme.accent)),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

          const Divider(height: 1, color: AppTheme.dividerDark),
        ],
      ),
    );
  }

  Widget _buildServiceBadge(String label, {bool isWarning = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: isWarning ? AppTheme.statusSlow.withOpacity(0.15) : AppTheme.surfaceContainer,
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: isWarning ? AppTheme.statusSlow : AppTheme.dividerDark, width: 1),
      ),
      child: Text(
        label,
        style: GoogleFonts.roboto(
          fontSize: 10.5,
          fontWeight: FontWeight.w500,
          color: isWarning ? AppTheme.statusSlow : AppTheme.textPrimaryDark,
        ),
      ),
    );
  }
}
