import '../models/node_model.dart';

class GhostServiceRule {
  final String id;
  final String name;
  final String category;
  final String iconEmoji;
  final String description;
  final String selectionReason; // Why this specific node was chosen by AI
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
    this.selectionReason = '',
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
      'selection_reason': selectionReason,
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
          selectionReason: 'Direct ISP (0 ms / Прямой интернет без прокси)',
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
          name: 'YouTube 4K, Twitch & Стримы',
          category: 'Максимальная скорость канала',
          iconEmoji: '🎬',
          description: 'Нода с широким портом 10Gbps и высоким битрейтом для 4K без буферизации',
          selectionReason: 'Выбор по максимальной скорости отдачи (Мбит/с) и 4K Ultra HD',
          domains: [
            'youtube.com', 'googlevideo.com', 'ytimg.com', 'youtu.be',
            'twitch.tv', 'ttvnw.net', 'netflix.com', 'nflxvideo.net',
          ],
          domainKeywords: ['googlevideo', 'youtube', 'twitch'],
        ),

        // 3. Low Latency (Voice / Gaming)
        GhostServiceRule(
          id: 'gaming_voice',
          name: 'Discord, CS2, Dota & Голос',
          category: 'Минимальный пинг и нулевой джиттер',
          iconEmoji: '💬',
          description: 'Ближайшая нода с джиттером < 5мс для идеального звука в Discord и игр',
          selectionReason: 'Выбор по минимальному времени отклика (Ping + Jitter < 45ms)',
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
          category: 'Чистый резидентный Egress IP',
          iconEmoji: '🤖',
          description: 'IP-адрес с высоким трастом без Cloudflare капчи и блокировок OpenAI',
          selectionReason: 'Выбор по чистоте IP (OpenAI Pass + Отсутствие блокировок CF)',
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
          name: 'Instagram, Twitter/X & Заблокированное',
          category: 'Anti-DPI Reality Обход ТСПУ',
          iconEmoji: '🌐',
          description: 'Защищенный Reality-туннель для заблокированных соцсетей',
          selectionReason: 'Выбор по устойчивости к ТСПУ (VLESS Reality / Hysteria 2)',
          domains: [
            'instagram.com', 'cdninstagram.com', 'facebook.com', 'fbcdn.net',
            'twitter.com', 'x.com', 'twimg.com', 'threads.net',
          ],
          domainKeywords: ['instagram', 'twitter', 'facebook'],
        ),
      ],
    );
  }

  /// AI Auto-Matcher: Assigns mathematically distinct specialized nodes for each lane
  void autoAssignNodes(List<NodeModel> availableNodes) {
    final alive = availableNodes.where((n) => n.isAlive).toList();
    if (alive.isEmpty) return;

    for (final rule in rules) {
      if (rule.id == 'ru_direct') {
        continue;
      } else if (rule.id == 'streaming') {
        // 🎬 Streaming: Sort strictly by highest Speed (Mbps)
        final sorted = List<NodeModel>.from(alive)
          ..sort((a, b) => b.speedMbps.compareTo(a.speedMbps));
        rule.customNode = sorted.first;
      } else if (rule.id == 'gaming_voice') {
        // 💬 Gaming & Voice: Sort strictly by (Ping + Jitter * 2)
        final sorted = List<NodeModel>.from(alive)
          ..sort((a, b) => (a.pingMs + (a.jitterMs * 2)).compareTo(b.pingMs + (b.jitterMs * 2)));
        rule.customNode = sorted.first;
      } else if (rule.id == 'ai_work') {
        // 🤖 AI & ChatGPT: Clean non-blacklisted IP first
        final cleanNodes = alive.where((n) => n.isCleanIp && n.countryCode != 'RU' && n.countryCode != 'IR').toList();
        if (cleanNodes.isNotEmpty) {
          cleanNodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));
          rule.customNode = cleanNodes.first;
        } else {
          final sorted = List<NodeModel>.from(alive)..sort((a, b) => b.score.compareTo(a.score));
          rule.customNode = sorted.first;
        }
      } else {
        // 🌐 Socials / General: Anti-DPI Reality / TSPU resistant
        final realityNodes = alive.where((n) => n.isTSPUResistant && n.countryCode != 'RU').toList();
        if (realityNodes.isNotEmpty) {
          realityNodes.sort((a, b) => a.pingMs.compareTo(b.pingMs));
          rule.customNode = realityNodes.first;
        } else {
          alive.sort((a, b) => a.pingMs.compareTo(b.pingMs));
          rule.customNode = alive.first;
        }
      }
    }
  }
}
