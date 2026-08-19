import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:qr_flutter/qr_flutter.dart';
import '../models/node_model.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';

class ExportSheet extends StatefulWidget {
  final ProbeProvider provider;

  const ExportSheet({super.key, required this.provider});

  static Future<void> show(BuildContext context, ProbeProvider provider) {
    FocusScope.of(context).unfocus();
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => ExportSheet(provider: provider),
    );
  }

  @override
  State<ExportSheet> createState() => _ExportSheetState();
}

class _ExportSheetState extends State<ExportSheet> {
  String _format = 'smart_tagged'; // smart_tagged, raw, base64, clash, singbox
  int _limit = 10;
  String _exportedContent = '';
  int _matchedCount = 0;
  bool _isGenerating = false;
  static HttpServer? _localSubServer;
  String? _localSubUrl;

  final List<Map<String, String>> _formats = const [
    {'id': 'smart_tagged', 'name': '⚡ С тегом [TOP-10] (для Happ)'},
    {'id': 'raw', 'name': 'Raw ссылки'},
    {'id': 'base64', 'name': 'Base64 подписка'},
    {'id': 'clash', 'name': 'Clash Meta Group (YAML)'},
    {'id': 'singbox', 'name': 'sing-box Group (JSON)'},
  ];

  @override
  void initState() {
    super.initState();
    _generateExport();
    _startLocalSubServer();
  }

  Future<void> _startLocalSubServer() async {
    try {
      _localSubServer?.close(force: true);
      _localSubServer = await HttpServer.bind(InternetAddress.loopbackIPv4, 8999);
      _localSubServer!.listen((HttpRequest request) {
        final nodes = widget.provider.nodes.where((n) => n.isAlive).toList();
        nodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));
        final targetNodes = nodes.take(_limit > 0 ? _limit : 10).toList();

        final content = _generateSmartTaggedList(targetNodes, _limit);
        final base64Content = base64.encode(utf8.encode(content));

        final groupTitle = '⚡ TurboProbe TOP-${_limit > 0 ? _limit : 10}';
        final b64Title = base64.encode(utf8.encode(groupTitle));

        request.response.headers
          ..set('Content-Type', 'text/plain; charset=utf-8')
          ..set('Profile-Title', 'base64:$b64Title')
          ..set('Profile-Update-Interval', '1')
          ..set('Subscription-Userinfo', 'upload=0; download=0; total=107374182400; expire=1790000000');

        request.response.write(base64Content);
        request.response.close();
      });

      if (mounted) {
        setState(() {
          _localSubUrl = 'http://127.0.0.1:8999/sub/top$_limit';
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _localSubServer?.close(force: true);
    _localSubServer = null;
    super.dispose();
  }

  Future<void> _generateExport() async {
    setState(() => _isGenerating = true);
    try {
      final nodes = widget.provider.nodes.where((n) => n.isAlive).toList();
      nodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));

      final countToTake = (_limit > 0 && _limit < nodes.length) ? _limit : nodes.length;
      final targetNodes = nodes.take(countToTake).toList();

      String content = '';
      if (_format == 'smart_tagged') {
        content = _generateSmartTaggedList(targetNodes, _limit);
      } else if (_format == 'base64') {
        final tagged = _generateSmartTaggedList(targetNodes, _limit);
        content = base64.encode(utf8.encode(tagged));
      } else if (_format == 'clash') {
        content = _generateClash(targetNodes);
      } else if (_format == 'singbox') {
        content = _generateSingBox(targetNodes);
      } else {
        content = targetNodes.map((e) => e.rawUri).join('\n');
      }

      setState(() {
        _matchedCount = targetNodes.length;
        _exportedContent = content;
        _isGenerating = false;
      });
    } catch (_) {
      setState(() => _isGenerating = false);
    }
  }

  String _generateSmartTaggedList(List<NodeModel> nodes, int limit) {
    final groupTag = limit > 0 ? 'TOP-$limit' : 'TOP';
    final List<String> taggedList = [];

    for (int i = 0; i < nodes.length; i++) {
      final n = nodes[i];
      final rank = (i + 1).toString().padLeft(2, '0');
      final flag = n.flagEmoji ?? '🌐';
      final country = n.countryName ?? 'Node';
      final cleanName = '⚡ [$groupTag #$rank] $flag $country · ${n.pingMs}ms';

      String uri = n.rawUri;
      if (uri.contains('#')) {
        uri = uri.split('#')[0] + '#' + Uri.encodeComponent(cleanName);
      } else {
        uri = uri + '#' + Uri.encodeComponent(cleanName);
      }
      taggedList.add(uri);
    }

    return taggedList.join('\n');
  }

  String _generateClash(List<NodeModel> nodes) {
    final sb = StringBuffer();
    final groupName = '⚡ TurboProbe TOP-${_limit > 0 ? _limit : 10}';
    final proxyNames = <String>[];

    sb.writeln('port: 7890\nsocks-port: 7891\nmode: rule\n\nproxies:');
    for (int i = 0; i < nodes.length; i++) {
      final n = nodes[i];
      final name = '⚡ [TOP-#${i + 1}] ${n.flagEmoji ?? "🌐"} ${n.countryName ?? "Node"} ${n.pingMs}ms';
      proxyNames.add('"$name"');
      sb.writeln('  - name: "$name"');
      sb.writeln('    type: ${n.protocol}');
      sb.writeln('    server: ${n.server}');
      sb.writeln('    port: ${n.port}');
      final userPart = n.rawUri.contains('@') ? n.rawUri.split('//')[1].split('@')[0] : '';
      if (userPart.isNotEmpty) sb.writeln('    uuid: $userPart');
      if (n.sni != null && n.sni!.isNotEmpty) sb.writeln('    sni: ${n.sni}');
    }

    sb.writeln('\nproxy-groups:');
    sb.writeln('  - name: "$groupName"');
    sb.writeln('    type: select');
    sb.writeln('    proxies:');
    for (final p in proxyNames) {
      sb.writeln('      - $p');
    }

    return sb.toString();
  }

  String _generateSingBox(List<NodeModel> nodes) {
    final groupName = '⚡ TurboProbe TOP-${_limit > 0 ? _limit : 10}';
    final tags = <String>[];

    final outbounds = nodes.map((n) {
      final tag = '⚡ [TOP] ${n.flagEmoji ?? "🌐"} ${n.name} · ${n.pingMs}ms';
      tags.add(tag);
      return {
        'type': n.protocol,
        'tag': tag,
        'server': n.server,
        'server_port': n.port,
      };
    }).toList();

    return const JsonEncoder.withIndent('  ').convert({
      'outbounds': [
        {
          'type': 'selector',
          'tag': groupName,
          'outbounds': tags,
        },
        ...outbounds,
      ]
    });
  }

  void _copyToClipboard(String text, String message) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }

  void _showQrDialog(BuildContext context, String data, String title) {
    if (data.isEmpty) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppTheme.surfaceDark,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Row(
          children: [
            const Icon(Icons.qr_code_2, color: AppTheme.accent, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: GoogleFonts.roboto(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8),
              ),
              child: QrImageView(
                data: data,
                version: QrVersions.auto,
                size: 220.0,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Наведите камеру в Happ / v2rayNG / Hiddify для импорта всей папки или ключа!',
              style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textSecondaryDark),
              textAlign: TextAlign.center,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Закрыть'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.88,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Экспорт с авто-группировкой',
                  style: GoogleFonts.roboto(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimaryDark),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.qr_code_2, size: 22, color: AppTheme.accent),
                      tooltip: 'Показать QR-код',
                      onPressed: () => _showQrDialog(
                        context,
                        _localSubUrl ?? 'http://127.0.0.1:8999/sub/top$_limit',
                        'QR-код авто-папки TOP-$_limit',
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, size: 20, color: AppTheme.textSecondaryDark),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(height: 1, color: AppTheme.dividerDark),

          // Scrollable Body
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
              children: [
                // 1. Live Local Subscription URL (Auto-Folder in Happ/Hiddify)
                _buildSectionHeader('📁 1. Авто-папка / Подписка для Happ и Hiddify'),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerLow,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.accent.withOpacity(0.4)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Вставьте эту ссылку в Happ («Добавить подписку») — создастся отдельная папка «⚡ TurboProbe TOP-$_limit»:',
                        style: GoogleFonts.roboto(fontSize: 12, color: AppTheme.textSecondaryDark, height: 1.3),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Expanded(
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: AppTheme.surfaceContainerLowest,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(color: AppTheme.dividerDark),
                              ),
                              child: Text(
                                _localSubUrl ?? 'http://127.0.0.1:8999/sub/top$_limit',
                                style: GoogleFonts.robotoMono(fontSize: 12, color: AppTheme.accent, fontWeight: FontWeight.w600),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton.icon(
                            icon: const Icon(Icons.link, size: 16, color: Colors.white),
                            label: const Text('Копировать ссылку'),
                            style: FilledButton.styleFrom(
                              backgroundColor: AppTheme.accent,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                            ),
                            onPressed: () => _copyToClipboard(
                              _localSubUrl ?? 'http://127.0.0.1:8999/sub/top$_limit',
                              'Ссылка на подписку-группу скопирована! Вставьте в Happ как подписку.',
                            ),
                          ),
                          const SizedBox(width: 6),
                          IconButton(
                            icon: const Icon(Icons.qr_code_2, size: 20, color: AppTheme.accent),
                            tooltip: 'QR-код подписки',
                            style: IconButton.styleFrom(
                              backgroundColor: AppTheme.surfaceContainerHighest,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                            ),
                            onPressed: () => _showQrDialog(
                              context,
                              _localSubUrl ?? 'http://127.0.0.1:8999/sub/top$_limit',
                              'QR-код подписки TOP-$_limit',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // 2. 1-Click Copy with Smart Tags [TOP-10 #01]
                _buildSectionHeader('⚡ 2. Быстрое копирование ключей с тегом [TOP-$_limit]'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildClientButton('В Happ (Тег [TOP-$_limit])', () {
                      final tagged = _generateSmartTaggedList(
                        widget.provider.nodes.where((e) => e.isAlive).take(_limit > 0 ? _limit : 10).toList(),
                        _limit,
                      );
                      _copyToClipboard(tagged, 'ТОП-$_limit ключей с тегами скопированы для Happ!');
                    }),
                    _buildClientButton('В Incy', () {
                      final tagged = _generateSmartTaggedList(
                        widget.provider.nodes.where((e) => e.isAlive).take(_limit > 0 ? _limit : 10).toList(),
                        _limit,
                      );
                      _copyToClipboard(tagged, 'ТОП-$_limit ключей скопированы для Incy!');
                    }),
                    _buildClientButton('В Hiddify', () {
                      final tagged = _generateSmartTaggedList(
                        widget.provider.nodes.where((e) => e.isAlive).take(_limit > 0 ? _limit : 10).toList(),
                        _limit,
                      );
                      _copyToClipboard(tagged, 'ТОП-$_limit ключей скопированы для Hiddify!');
                    }),
                    _buildClientButton('В v2rayNG', () {
                      final tagged = _generateSmartTaggedList(
                        widget.provider.nodes.where((e) => e.isAlive).take(_limit > 0 ? _limit : 10).toList(),
                        _limit,
                      );
                      _copyToClipboard(tagged, 'ТОП-$_limit ключей скопированы для v2rayNG!');
                    }),
                  ],
                ),
                const SizedBox(height: 20),

                // 3. Limit selector
                _buildSectionHeader('Количество лучших нод'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildChoiceChip('ТОП 5', _limit == 5, () {
                      setState(() => _limit = 5);
                      _generateExport();
                      _startLocalSubServer();
                    }),
                    _buildChoiceChip('ТОП 10', _limit == 10, () {
                      setState(() => _limit = 10);
                      _generateExport();
                      _startLocalSubServer();
                    }),
                    _buildChoiceChip('ТОП 20', _limit == 20, () {
                      setState(() => _limit = 20);
                      _generateExport();
                      _startLocalSubServer();
                    }),
                    _buildChoiceChip('ТОП 50', _limit == 50, () {
                      setState(() => _limit = 50);
                      _generateExport();
                      _startLocalSubServer();
                    }),
                  ],
                ),
                const SizedBox(height: 20),

                // 4. Format selector
                _buildSectionHeader('Формат выгрузки'),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _formats.map((f) {
                    final isSelected = _format == f['id'];
                    return _buildChoiceChip(f['name']!, isSelected, () {
                      setState(() => _format = f['id']!);
                      _generateExport();
                    });
                  }).toList(),
                ),
                const SizedBox(height: 20),

                // 5. Preview Box (Roboto Mono)
                _buildSectionHeader('Предпросмотр структуры ($_matchedCount ключей)'),
                Container(
                  height: 120,
                  width: double.infinity,
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: AppTheme.dividerDark, width: 1),
                  ),
                  child: SingleChildScrollView(
                    child: Text(
                      _exportedContent.isEmpty ? 'Нет доступных ключей' : _exportedContent,
                      style: GoogleFonts.robotoMono(fontSize: 11, color: AppTheme.textSecondaryDark),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Action Button
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: AppTheme.surfaceDark,
              border: Border(top: BorderSide(color: AppTheme.dividerDark, width: 1)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 44,
                    child: FilledButton.icon(
                      icon: const Icon(Icons.copy, size: 16, color: Colors.black),
                      label: Text(
                        'Скопировать пак ($_matchedCount нод)',
                        style: GoogleFonts.roboto(fontSize: 13.5, fontWeight: FontWeight.w600, color: Colors.black),
                      ),
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: Colors.black,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      onPressed: _exportedContent.isEmpty
                          ? null
                          : () => _copyToClipboard(_exportedContent, 'Успешно скопировано $_matchedCount ключей с тегами!'),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 44,
                  width: 48,
                  child: FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppTheme.surfaceContainerHighest,
                      foregroundColor: AppTheme.accent,
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    onPressed: _exportedContent.isEmpty
                        ? null
                        : () => _showQrDialog(context, _exportedContent, 'QR-код выгрузки ($_matchedCount ключей)'),
                    child: const Icon(Icons.qr_code_2, size: 22),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        title.toUpperCase(),
        style: GoogleFonts.roboto(fontSize: 11, fontWeight: FontWeight.w700, color: AppTheme.textTertiaryDark, letterSpacing: 0.5),
      ),
    );
  }

  Widget _buildClientButton(String label, VoidCallback onTap) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        side: const BorderSide(color: AppTheme.dividerDark),
        foregroundColor: AppTheme.textPrimaryDark,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
      child: Text(label, style: GoogleFonts.roboto(fontSize: 12, fontWeight: FontWeight.w500)),
    );
  }

  Widget _buildChoiceChip(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.accent.withOpacity(0.18) : AppTheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(
            color: isSelected ? AppTheme.accent : AppTheme.dividerDark,
          ),
        ),
        child: Text(
          label,
          style: GoogleFonts.roboto(
            fontSize: 12.5,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            color: isSelected ? Colors.white : AppTheme.textPrimaryDark,
          ),
        ),
      ),
    );
  }
}
