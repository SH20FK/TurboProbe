import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/probe_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/filter_bar.dart';
import '../widgets/node_card.dart';
import '../widgets/progress_bar.dart';
import '../widgets/stats_header.dart';
import 'export_sheet.dart';
import 'settings_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final TextEditingController _inputController = TextEditingController();
  bool _isInputExpanded = true;

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  void _pasteFromClipboard() async {
    final data = await Clipboard.getData('text/plain');
    if (data?.text != null && data!.text!.isNotEmpty) {
      setState(() {
        _inputController.text = data.text!;
      });
      _parseKeys();
    }
  }

  void _parseKeys() {
    final text = _inputController.text.trim();
    if (text.isNotEmpty) {
      context.read<ProbeProvider>().parseInput(text);
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<ProbeProvider>();
    final nodes = provider.filteredNodes;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppTheme.background,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.bolt_rounded, color: AppTheme.primaryAccent, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'TurboProbe VPN',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppTheme.surfaceLight,
                borderRadius: BorderRadius.circular(4),
              ),
              child: const Text('v1.0', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.tune_rounded, color: AppTheme.textPrimary),
            tooltip: 'Settings',
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => SettingsDialog(initialConfig: provider.config),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.file_upload_outlined, color: AppTheme.textPrimary),
            tooltip: 'Export Keys',
            onPressed: provider.nodes.isEmpty
                ? null
                : () {
                    showModalBottomSheet(
                      context: context,
                      backgroundColor: Colors.transparent,
                      isScrollControlled: true,
                      builder: (context) => ExportSheet(provider: provider),
                    );
                  },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Input Section (Collapsible)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppTheme.border),
            ),
            child: Column(
              children: [
                if (_isInputExpanded) ...[
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: TextField(
                      controller: _inputController,
                      maxLines: 3,
                      style: const TextStyle(fontSize: 13),
                      decoration: InputDecoration(
                        hintText: 'Paste subscription URL or raw keys (vless://, vmess://, ss://, trojan://, hy2://, tuic://, Base64)...',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                        contentPadding: EdgeInsets.zero,
                        suffixIcon: _inputController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear, size: 18),
                                onPressed: () {
                                  _inputController.clear();
                                  setState(() {});
                                },
                              )
                            : null,
                      ),
                      onChanged: (_) => setState(() {}),
                    ),
                  ),
                  const Divider(height: 1, color: AppTheme.border),
                ],
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      // Paste Button
                      OutlinedButton.icon(
                        icon: const Icon(Icons.paste_rounded, size: 16),
                        label: const Text('Paste', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.textPrimary,
                          side: const BorderSide(color: AppTheme.border),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        onPressed: _pasteFromClipboard,
                      ),
                      const SizedBox(width: 8),
                      // Parse Button if not parsed
                      if (_inputController.text.isNotEmpty && provider.nodes.isEmpty)
                        ElevatedButton.icon(
                          icon: const Icon(Icons.search_rounded, size: 16),
                          label: const Text('Parse Keys', style: TextStyle(fontSize: 12)),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.surfaceLight,
                            foregroundColor: AppTheme.textPrimary,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: _parseKeys,
                        ),
                      const Spacer(),
                      // Start / Stop Turbo-Probe Button
                      if (provider.isTesting)
                        ElevatedButton.icon(
                          icon: const Icon(Icons.stop_rounded, size: 18),
                          label: const Text('Stop Test'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.error,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: provider.stopBenchmark,
                        )
                      else
                        ElevatedButton.icon(
                          icon: const Icon(Icons.bolt_rounded, size: 18),
                          label: Text(
                            provider.nodes.isEmpty ? 'Load & Test' : 'Test ${provider.nodes.length} Keys',
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                          ),
                          onPressed: () async {
                            if (provider.nodes.isEmpty && _inputController.text.isNotEmpty) {
                              await provider.parseInput(_inputController.text.trim());
                            }
                            if (provider.nodes.isNotEmpty) {
                              setState(() => _isInputExpanded = false);
                              provider.startBenchmark();
                            }
                          },
                        ),
                      IconButton(
                        icon: Icon(
                          _isInputExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                          color: AppTheme.textSecondary,
                          size: 20,
                        ),
                        onPressed: () => setState(() => _isInputExpanded = !_isInputExpanded),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Progress Bar
          ProgressBar(percent: provider.percent, isTesting: provider.isTesting),

          // Stats Bar
          if (provider.nodes.isNotEmpty) StatsHeader(provider: provider),

          // Filters & Search Bar
          if (provider.nodes.isNotEmpty) FilterBar(provider: provider),

          // Main Nodes List
          Expanded(
            child: provider.isLoading
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(color: AppTheme.primary),
                        SizedBox(height: 12),
                        Text('Parsing subscription keys...', style: TextStyle(color: AppTheme.textSecondary)),
                      ],
                    ),
                  )
                : provider.nodes.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                color: AppTheme.surface,
                                shape: BoxShape.circle,
                                border: Border.all(color: AppTheme.border),
                              ),
                              child: const Icon(
                                Icons.vpn_key_rounded,
                                size: 48,
                                color: AppTheme.primaryAccent,
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'No VPN Keys Loaded',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: AppTheme.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Paste subscription links or configs above\nto test and filter working keys.',
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                            ),
                          ],
                        ),
                      )
                    : nodes.isEmpty
                        ? const Center(
                            child: Text(
                              'No nodes match your filter criteria',
                              style: TextStyle(color: AppTheme.textSecondary),
                            ),
                          )
                        : ListView.builder(
                            itemCount: nodes.length,
                            physics: const BouncingScrollPhysics(),
                            itemBuilder: (context, index) {
                              return NodeCard(node: nodes[index]);
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
