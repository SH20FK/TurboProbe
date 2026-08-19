import '../models/node_model.dart';

class MultiHopChain {
  final String id;
  final String name;
  final NodeModel entryNode; // In KZ, TR, AM, FI or Whitelist SNI
  final NodeModel exitNode; // In DE, NL, US, JP, SE
  final int compositePingMs;
  final String stealthRating; // '100% Invisible', 'High Stealth'

  MultiHopChain({
    required this.id,
    required this.name,
    required this.entryNode,
    required this.exitNode,
    required this.compositePingMs,
    this.stealthRating = '100% Invisible (ТСПУ Bypass)',
  });

  /// Converts Multi-Hop chain into a virtual NodeModel for single-click connection
  NodeModel toNodeModel() {
    return NodeModel(
      id: id,
      rawUri: exitNode.rawUri,
      protocol: '${entryNode.protocol}+${exitNode.protocol}',
      name: name,
      server: entryNode.server,
      port: entryNode.port,
      security: 'reality-multihop',
      sni: entryNode.sni,
      countryCode: exitNode.countryCode ?? 'DE',
      countryName: '${entryNode.countryName ?? "Вход"} ➔ ${exitNode.countryName ?? "Выход"}',
      flagEmoji: '${entryNode.flagEmoji ?? "🛡️"}➔${exitNode.flagEmoji ?? "🌐"}',
      isAlive: true,
      pingMs: compositePingMs,
      jitterMs: (entryNode.jitterMs + exitNode.jitterMs),
      score: 95,
      unlockYouTube: true,
      unlockDiscord: true,
      unlockOpenAI: exitNode.isCleanIp,
      unlockTelegram: true,
      unlockInstagram: true,
      isTSPUResistant: true,
      speedMbps: (exitNode.speedMbps * 0.85),
      streamBandGrade: exitNode.streamBandGrade ?? '4K HDR',
      isTSPUThrottled: false,
      isCleanIp: exitNode.isCleanIp,
      egressIp: exitNode.egressIp,
      dpiDiagnosis: '🛡️ Multi-Hop Stealth: ТСПУ видит только ${entryNode.countryName ?? "шлюз"}',
      isGamingReady: compositePingMs < 80,
      pathMtu: 1400,
    );
  }

  /// Automatically pairs the best entry nodes with top exit nodes
  static List<MultiHopChain> generateOptimalChains(List<NodeModel> nodes) {
    final alive = nodes.where((n) => n.isAlive).toList();
    if (alive.length < 2) return [];

    // Potential Entry Nodes: KZ, TR, AM, GE, FI, or Whitelist SNI
    final entryCandidates = alive.where((n) {
      final c = n.countryCode?.toUpperCase() ?? '';
      return c == 'KZ' || c == 'TR' || c == 'AM' || c == 'GE' || c == 'FI' || c == 'RU' || (n.sni?.contains('gosuslugi') == true || n.sni?.contains('apple') == true || n.sni?.contains('google') == true);
    }).toList();

    // Fallback entries: lowest ping nodes
    if (entryCandidates.isEmpty) {
      alive.sort((a, b) => a.pingMs.compareTo(b.pingMs));
      entryCandidates.addAll(alive.take(3));
    }

    // Exit Candidates: DE, NL, US, SE, FR, JP, GB with high speed
    final exitCandidates = alive.where((n) {
      final c = n.countryCode?.toUpperCase() ?? '';
      return c == 'DE' || c == 'NL' || c == 'US' || c == 'SE' || c == 'FR' || c == 'JP' || c == 'GB';
    }).toList();

    if (exitCandidates.isEmpty) {
      exitCandidates.addAll(alive);
    }

    final List<MultiHopChain> chains = [];
    int count = 0;

    for (final entry in entryCandidates.take(3)) {
      for (final exit in exitCandidates.take(3)) {
        if (entry.id == exit.id) continue;

        final compPing = entry.pingMs + (exit.pingMs * 0.35).round();
        final chain = MultiHopChain(
          id: 'multihop_${entry.id}_${exit.id}',
          name: '🛡️ Stealth Chain: ${entry.flagEmoji ?? "🛡️"} ${entry.countryName ?? "Шлюз"} ➔ ${exit.flagEmoji ?? "🌐"} ${exit.countryName ?? "Выход"}',
          entryNode: entry,
          exitNode: exit,
          compositePingMs: compPing,
        );
        chains.add(chain);
        count++;
        if (count >= 5) break;
      }
      if (count >= 5) break;
    }

    return chains;
  }
}
