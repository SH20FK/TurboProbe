import '../models/node_model.dart';

class GhostServiceRule {
  final String id;
  final String name;
  final String category;
  final String iconEmoji;
  final String description;
  final List<String> domains;
  final List<String> domainKeywords;
  bool isEnabled;
  NodeModel? customNode; // If null, AI auto-selects best suited node

  GhostServiceRule({
    required this.id,
    required this.name,
    required this.category,
    required this.iconEmoji,
    required this.description,
    required this.domains,
    this.domainKeywords = const [],
    this.isEnabled = true,
    this.customNode,
  });

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'category': category,
      'icon_emoji': iconEmoji,
      'description': description,
      'domains': domains,
      'is_enabled': isEnabled,
      'custom_node': customNode?.toJson(),
    };
  }
}

class GhostMatrixConfig {
  bool isMatrixEnabled;
  final List<GhostServiceRule> rules;

  GhostMatrixConfig({
    this.isMatrixEnabled = true,
    required this.rules,
  });

  static GhostMatrixConfig defaultPresets() {
    return GhostMatrixConfig(
      isMatrixEnabled: true,
      rules: [
        // 1. RU Domestic Direct Route
        GhostServiceRule(
          id: 'ru_direct',
          name: 'Банки, Госуслуги, VK и РФ',
          category: 'Прямой доступ (0% задержки)',
          iconEmoji: '🏛️',
          description: 'Сбер, Т-Банк, Госуслуги, VK, Ozon идут напрямую на скорости 1 Гбит/с',
          domains: [
            '.ru', '.рф', 'gosuslugi.ru', 'sberbank.ru', 'tinkoff.ru',
            'alfabank.ru', 'vtb.ru', 'yandex.ru', 'yandex.net', 'ya.ru',
            'vk.com', 'vk.ru', 'mail.ru', 'ozon.ru', 'wildberries.ru',
            'avito.ru', 'kinopoisk.ru', 'mos.ru', 'nalog.ru', '2gis.ru',
          ],
          domainKeywords: ['sberbank', 'tinkoff', 'gosuslugi', 'yandex', 'vkontakte', 'ozon', 'wildberries', 'avito'],
        ),

        // 2. Video Streaming (Bandwidth Priority)
        GhostServiceRule(
          id: 'streaming',
          name: 'YouTube 4K & Стримы',
          category: 'Максимальная скорость (4K HDR)',
          iconEmoji: '🎬',
          description: 'Авто-выбор ноды с широким каналом для 4K без буферизации',
          domains: [
            'youtube.com', 'googlevideo.com', 'ytimg.com', 'youtu.be',
            'twitch.tv', 'ttvnw.net', 'netflix.com', 'nflxvideo.net',
          ],
          domainKeywords: ['googlevideo', 'youtube', 'twitch'],
        ),

        // 3. Low Latency (Voice / Gaming)
        GhostServiceRule(
          id: 'gaming_voice',
          name: 'Discord, Игры и Telegram',
          category: 'Минимальный пинг (CRL < 40ms)',
          iconEmoji: '💬',
          description: 'Минимальный джиттер и нулевая потеря пакетов для голосовых и CS2/Dota',
          domains: [
            'discord.gg', 'discord.com', 'discordapp.com', 'discord.media',
            'discordapp.net', 't.me', 'telegram.org', 'telegram.me',
            'steampowered.com', 'steamcommunity.com', 'valvesoftware.com',
          ],
          domainKeywords: ['discord', 'telegram', 'steam'],
        ),

        // 4. Clean IP (AI & Work)
        GhostServiceRule(
          id: 'ai_work',
          name: 'ChatGPT, Claude & Work',
          category: 'Чистый Egress IP (Без капчи)',
          iconEmoji: '🤖',
          description: 'Выходной IP с высоким трастом без Cloudflare 1020 / Verify Captcha',
          domains: [
            'openai.com', 'chatgpt.com', 'oaistatic.com', 'oaiusercontent.com',
            'anthropic.com', 'claude.ai', 'notion.so', 'github.com',
            'gitlab.com', 'stackoverflow.com',
          ],
          domainKeywords: ['openai', 'chatgpt', 'claude', 'anthropic'],
        ),

        // 5. Censored Socials & General VPN
        GhostServiceRule(
          id: 'socials_general',
          name: 'Instagram, Twitter/X & Остальное',
          category: 'Обход блокировок ТСПУ',
          iconEmoji: '🌐',
          description: 'Защищенный туннель для всех остальных заблокированных ресурсов',
          domains: [
            'instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net',
            'twitter.com', 'x.com', 'twimg.com', 'threads.net',
          ],
          domainKeywords: ['instagram', 'twitter', 'facebook'],
        ),
      ],
    );
  }

  /// AI Auto-Matcher: Assigns the mathematically best node for each service
  void autoAssignNodes(List<NodeModel> availableNodes) {
    final alive = availableNodes.where((n) => n.isAlive).toList();
    if (alive.isEmpty) return;

    for (final rule in rules) {
      if (rule.id == 'ru_direct') {
        // Handled by direct routing
        continue;
      } else if (rule.id == 'streaming') {
        // Best streaming: Highest speed + 4K grade
        final sorted = List<NodeModel>.from(alive)
          ..sort((a, b) => b.speedMbps.compareTo(a.speedMbps));
        rule.customNode = sorted.first;
      } else if (rule.id == 'gaming_voice') {
        // Best gaming: Lowest ping + lowest jitter
        final sorted = List<NodeModel>.from(alive)
          ..sort((a, b) => (a.pingMs + a.jitterMs).compareTo(b.pingMs + b.jitterMs));
        rule.customNode = sorted.first;
      } else if (rule.id == 'ai_work') {
        // Best AI: Clean IP first, then lowest ping
        final cleanNodes = alive.where((n) => n.isCleanIp).toList();
        if (cleanNodes.isNotEmpty) {
          cleanNodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));
          rule.customNode = cleanNodes.first;
        } else {
          alive.sort((a, b) => a.pingMs.compareTo(b.pingMs));
          rule.customNode = alive.first;
        }
      } else {
        // General: Lowest ping
        alive.sort((a, b) => a.pingMs.compareTo(b.pingMs));
        rule.customNode = alive.first;
      }
    }
  }
}
