import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/node_model.dart';
import '../theme/app_theme.dart';

class NodeCard extends StatelessWidget {
  final NodeModel node;

  const NodeCard({super.key, required this.node});

  @override
  Widget build(BuildContext context) {
    final pingColor = AppTheme.getPingColor(node.pingMs);

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 5),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Country Flag
                Text(
                  node.flagEmoji ?? '🌐',
                  style: const TextStyle(fontSize: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        node.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: AppTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${node.server}:${node.port} • ${node.countryName ?? node.countryCode ?? 'Unknown'}${node.isp != null ? ' (${node.isp})' : ''}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                // Copy Raw URI
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18, color: AppTheme.textSecondary),
                  tooltip: 'Копировать ключ',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: node.rawUri));
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: const Text('Ключ скопирован в буфер!'),
                        duration: const Duration(seconds: 1),
                        behavior: SnackBarBehavior.floating,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    );
                  },
                ),
              ],
            ),

            // RU Unlock Badges Row (if alive)
            if (node.isAlive) ...[
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 4,
                children: [
                  if (node.unlockYouTube)
                    _buildUnlockBadge('🎬 YouTube 4K', AppTheme.error.withOpacity(0.2), AppTheme.error),
                  if (node.unlockDiscord)
                    _buildUnlockBadge('💬 Discord', AppTheme.primary.withOpacity(0.2), AppTheme.primary),
                  if (node.unlockOpenAI)
                    _buildUnlockBadge('🤖 ChatGPT', AppTheme.success.withOpacity(0.2), AppTheme.success),
                  if (node.isTSPUResistant)
                    _buildUnlockBadge('🛡 Анти-ТСПУ', AppTheme.secondary.withOpacity(0.2), AppTheme.secondary),
                ],
              ),
            ],

            const SizedBox(height: 10),
            const Divider(height: 1, color: AppTheme.outlineVariant),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Protocol Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerHigh,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.outlineVariant),
                  ),
                  child: Text(
                    node.protocol.toUpperCase() +
                        (node.security == 'reality' ? ' REALITY' : ''),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primary,
                    ),
                  ),
                ),
                // Ping & Metrics
                if (node.isAlive)
                  Row(
                    children: [
                      if (node.score > 0)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Text(
                            '★ ${node.score} pts',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.warning),
                          ),
                        ),
                      if (node.jitterMs > 0)
                        Padding(
                          padding: const EdgeInsets.only(right: 10),
                          child: Text(
                            '±${node.jitterMs}ms',
                            style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                          ),
                        ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: pingColor.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: pingColor.withOpacity(0.4)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: pingColor,
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              '${node.pingMs} ms',
                              style: TextStyle(
                                color: pingColor,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  )
                else
                  Text(
                    node.errorMsg != null ? 'Недоступен' : 'Ожидает проверки',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: node.errorMsg != null ? AppTheme.error : AppTheme.textSecondary,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUnlockBadge(String label, Color bgColor, Color textColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        label,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: textColor),
      ),
    );
  }
}
