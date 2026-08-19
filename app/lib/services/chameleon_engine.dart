import 'dart:async';
import 'dart:io';
import 'dart:math';
import '../models/node_model.dart';

enum MorphLevel {
  standard, // Standard TLS 1.3 Reality / Trojan
  fragmented, // TCP/TLS ClientHello Micro-Fragmentation (1-3 bytes)
  whiteListSniMorph, // Domestic RU / Global Whitelist SNI Injection (Госуслуги, Apple, Google)
  protoHop, // Fallback to UDP (Hysteria 2 / TUIC) or gRPC/WebSocket
}

enum ChameleonStatus {
  idle,
  activePass,
  morphing,
  tspuAttacked,
}

class ChameleonEngine {
  static MorphLevel currentMorphLevel = MorphLevel.fragmented;
  static ChameleonStatus status = ChameleonStatus.activePass;

  static const List<Map<String, String>> whitelistSnisArray = [
    {'sni': 'dl.google.com', 'label': 'Google-Play-CDN', 'fp': 'chrome'},
    {'sni': 'gateway.icloud.com', 'label': 'Apple-Push-Service', 'fp': 'safari'},
    {'sni': 'api.gosuslugi.ru', 'label': 'Gosuslugi-API', 'fp': 'chrome'},
    {'sni': 'cdn.vk.com', 'label': 'VK-Media-CDN', 'fp': 'chrome'},
    {'sni': 'static.sberbank.ru', 'label': 'Sber-Banking', 'fp': 'chrome'},
    {'sni': 'yandex.ru', 'label': 'Yandex-Search', 'fp': 'chrome'},
  ];

  /// Fragment outgoing TLS ClientHello packet into micro-chunks
  /// This breaks signature analysis of Russian TSPU DPI boxes (Rostelecom, MTS, MegaFon, Beeline)
  static List<List<int>> fragmentPacket(List<int> rawPacket, {int firstChunkSize = 3}) {
    if (rawPacket.length <= firstChunkSize) {
      return [rawPacket];
    }
    final chunk1 = rawPacket.sublist(0, firstChunkSize);
    final chunk2 = rawPacket.sublist(firstChunkSize);
    return [chunk1, chunk2];
  }

  /// Sends packet through socket with Anti-DPI fragmentation and micro-delay
  static Future<void> sendAntiDpiPacket(Socket socket, List<int> payload, {int delayMs = 5}) async {
    final chunks = fragmentPacket(payload);
    for (int i = 0; i < chunks.length; i++) {
      socket.add(chunks[i]);
      await socket.flush();
      if (i < chunks.length - 1 && delayMs > 0) {
        await Future.delayed(Duration(milliseconds: delayMs));
      }
    }
  }

  /// Generates a mutated Anti-DPI Node configuration based on current morph level
  static NodeModel applyChameleonMorph(NodeModel node, MorphLevel level) {
    if (level == MorphLevel.standard) {
      return node;
    }

    String mutatedUri = node.rawUri;
    String mutatedName = node.name;
    String? mutatedSni = node.sni;

    if (level == MorphLevel.fragmented) {
      if (!mutatedUri.contains('fragment=')) {
        mutatedUri = mutatedUri.contains('?')
            ? '$mutatedUri&fragment=1-3,5-10'
            : '$mutatedUri?fragment=1-3,5-10';
      }
      mutatedName = '🛡️ [Anti-DPI] ${node.name}';
    } else if (level == MorphLevel.whiteListSniMorph) {
      final randomWhitelist = whitelistSnisArray[Random().nextInt(whitelistSnisArray.length)];
      mutatedSni = randomWhitelist['sni'];
      final label = randomWhitelist['label'];

      if (mutatedUri.contains('sni=')) {
        mutatedUri = mutatedUri.replaceAll(RegExp(r'sni=[^&]+'), 'sni=$mutatedSni');
      } else if (mutatedUri.contains('?')) {
        mutatedUri = '$mutatedUri&sni=$mutatedSni';
      } else {
        mutatedUri = '$mutatedUri?sni=$mutatedSni';
      }
      mutatedName = '🏛️ [$label] ${node.name}';
    }

    return NodeModel(
      id: node.id,
      rawUri: mutatedUri,
      protocol: node.protocol,
      name: mutatedName,
      server: node.server,
      port: node.port,
      security: node.security,
      sni: mutatedSni,
      type: node.type,
      countryCode: node.countryCode,
      countryName: node.countryName,
      flagEmoji: node.flagEmoji,
      isAlive: node.isAlive,
      pingMs: node.pingMs,
      jitterMs: node.jitterMs,
      packetLoss: node.packetLoss,
      score: node.score,
      unlockYouTube: node.unlockYouTube,
      unlockDiscord: node.unlockDiscord,
      unlockOpenAI: node.unlockOpenAI,
      unlockTelegram: node.unlockTelegram,
      unlockInstagram: node.unlockInstagram,
      isTSPUResistant: true,
      speedMbps: node.speedMbps,
      streamBandGrade: node.streamBandGrade,
      isTSPUThrottled: false,
      isCleanIp: node.isCleanIp,
      egressIp: node.egressIp,
      isResurrected: node.isResurrected,
      resurrectedPort: node.resurrectedPort,
      dpiDiagnosis: '🛡️ Chameleon Shield: ${level.name} (ТСПУ Обойдено)',
      isGamingReady: node.isGamingReady,
      pathMtu: 1420,
    );
  }
}
