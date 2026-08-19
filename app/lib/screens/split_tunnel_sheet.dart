import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

class AppTunnelItem {
  final String name;
  final String packageName;
  final String iconEmoji;
  final String category;
  bool isProxied;

  AppTunnelItem({
    required this.name,
    required this.packageName,
    required this.iconEmoji,
    required this.category,
    this.isProxied = true,
  });
}

class SplitTunnelSheet extends StatefulWidget {
  const SplitTunnelSheet({super.key});

  static void show(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const SplitTunnelSheet(),
    );
  }

  @override
  State<SplitTunnelSheet> createState() => _SplitTunnelSheetState();
}

class _SplitTunnelSheetState extends State<SplitTunnelSheet> {
  // Preset list of popular apps in RU
  final List<AppTunnelItem> _apps = [
    AppTunnelItem(name: 'YouTube', packageName: 'com.google.android.youtube', iconEmoji: '🎬', category: 'Медиа', isProxied: true),
    AppTunnelItem(name: 'Discord', packageName: 'com.discord', iconEmoji: '💬', category: 'Связь', isProxied: true),
    AppTunnelItem(name: 'Instagram', packageName: 'com.instagram.android', iconEmoji: '📸', category: 'Соцсети', isProxied: true),
    AppTunnelItem(name: 'ChatGPT', packageName: 'com.openai.chatgpt', iconEmoji: '🤖', category: 'AI', isProxied: true),
    AppTunnelItem(name: 'Telegram', packageName: 'org.telegram.messenger', iconEmoji: '✈️', category: 'Мессенджер', isProxied: false),
    AppTunnelItem(name: 'Chrome / Браузер', packageName: 'com.android.chrome', iconEmoji: '🌐', category: 'Браузер', isProxied: true),
    AppTunnelItem(name: 'Госуслуги', packageName: 'ru.rostel.gosuslugi', iconEmoji: '🏛️', category: 'Гос. сервисы (Прямой)', isProxied: false),
    AppTunnelItem(name: 'СберБанк', packageName: 'ru.sberbankmobile', iconEmoji: '💳', category: 'Банки (Прямой)', isProxied: false),
    AppTunnelItem(name: 'Т-Банк', packageName: 'com.idamob.tinkoff.android', iconEmoji: '💛', category: 'Банки (Прямой)', isProxied: false),
    AppTunnelItem(name: 'VK / ВКонтакте', packageName: 'com.vkontakte.android', iconEmoji: '🔵', category: 'Соцсети (Прямой)', isProxied: false),
    AppTunnelItem(name: 'Яндекс Карты & Go', packageName: 'ru.yandex.yandexmaps', iconEmoji: '🚕', category: 'Транспорт (Прямой)', isProxied: false),
  ];

  String _searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _apps.where((a) =>
      a.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
      a.category.toLowerCase().contains(_searchQuery.toLowerCase())
    ).toList();

    final proxiedCount = _apps.where((a) => a.isProxied).length;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: AppTheme.surfaceContainerLow,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 12),
          Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: AppTheme.dividerDark,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '🎯 Раздельное туннелирование',
                      style: GoogleFonts.roboto(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppTheme.textPrimaryDark,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Через VPN: $proxiedCount из ${_apps.length} приложений',
                      style: GoogleFonts.roboto(
                        fontSize: 13,
                        color: AppTheme.accent,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppTheme.textTertiaryDark),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),

          // Search Field
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: TextField(
              style: GoogleFonts.roboto(color: AppTheme.textPrimaryDark, fontSize: 14),
              onChanged: (val) => setState(() => _searchQuery = val),
              decoration: InputDecoration(
                hintText: 'Поиск приложения...',
                hintStyle: GoogleFonts.roboto(color: AppTheme.textTertiaryDark, fontSize: 13),
                prefixIcon: const Icon(Icons.search, color: AppTheme.textTertiaryDark, size: 20),
                filled: true,
                fillColor: AppTheme.surfaceContainerLowest,
                contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Apps List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final app = filtered[index];
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceContainerLowest,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: app.isProxied ? AppTheme.accent.withOpacity(0.3) : AppTheme.dividerDark,
                    ),
                  ),
                  child: Row(
                    children: [
                      Text(app.iconEmoji, style: const TextStyle(fontSize: 24)),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              app.name,
                              style: GoogleFonts.roboto(
                                fontSize: 14.5,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.textPrimaryDark,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              app.category,
                              style: GoogleFonts.roboto(
                                fontSize: 11.5,
                                color: app.isProxied ? AppTheme.accent : AppTheme.textTertiaryDark,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Switch.adaptive(
                        value: app.isProxied,
                        activeColor: AppTheme.accent,
                        onChanged: (val) {
                          setState(() => app.isProxied = val);
                        },
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

          // Bottom Action
          Padding(
            padding: const EdgeInsets.all(20),
            child: SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('✅ Маршрутизация сохранена ($proxiedCount через VPN)'),
                      behavior: SnackBarBehavior.floating,
                      duration: const Duration(seconds: 2),
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.accent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text(
                  'Применить правила ($proxiedCount)',
                  style: GoogleFonts.roboto(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
