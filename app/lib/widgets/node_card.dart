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
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Flag & Country
                Text(
                  node.flagEmoji ?? '🌐',
                  style: const TextStyle(fontSize: 22),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        node.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                          color: AppTheme.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${node.server}:${node.port} • ${node.countryName ?? node.countryCode ?? 'Unknown'}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                // Copy Button
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18, color: AppTheme.textSecondary),
                  tooltip: 'Copy Raw URI',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: node.rawUri));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Key copied to clipboard!'),
                        duration: Duration(seconds: 1),
                        behavior: SnackBarBehavior.floating,
                      ),
                    );
                  },
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1, color: AppTheme.border),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Protocol Badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceLight,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppTheme.border),
                  ),
                  child: Text(
                    node.protocol.toUpperCase() +
                        (node.security == 'reality' ? ' REALITY' : ''),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: AppTheme.primaryAccent,
                    ),
                  ),
                ),
                // Status / Ping / Metrics
                if (node.isAlive)
                  Row(
                    children: [
                      if (node.jitterMs > 0)
                        Padding(
                          padding: const EdgeInsets.only(right: 12),
                          child: Text(
                            '±${node.jitterMs}ms jitter',
                            style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
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
                              width: 7,
                              height: 7,
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
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  )
                else
                  Text(
                    node.errorMsg != null ? 'Unreachable' : 'Not tested',
                    style: TextStyle(
                      fontSize: 12,
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
}
