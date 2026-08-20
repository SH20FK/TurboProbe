import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_v2ray/flutter_v2ray.dart';
import '../models/node_model.dart';
import 'windows_proxy_service.dart';

enum VpnState {
  disconnected,
  connecting,
  connected,
  disconnecting,
  error,
}

class VpnService {
  static final ValueNotifier<V2RayStatus?> statusNotifier = ValueNotifier<V2RayStatus?>(null);
  static final ValueNotifier<String> stateNotifier = ValueNotifier<String>('DISCONNECTED');
  static bool _isInitialized = false;

  static final FlutterV2ray _flutterV2ray = FlutterV2ray(
    onStatusChanged: (status) {
      statusNotifier.value = status;
      stateNotifier.value = status.state;
      debugPrint('[V2Ray] Status change: ${status.state} - DL: ${status.downloadSpeed} UL: ${status.uploadSpeed}');
    },
  );

  static FlutterV2ray get engine => _flutterV2ray;

  static Future<void> initialize() async {
    if (Platform.isAndroid && !_isInitialized) {
      try {
        await _flutterV2ray.initializeV2Ray();
        _isInitialized = true;
        debugPrint('[V2Ray] Native core initialized successfully.');
      } catch (e) {
        debugPrint('[V2Ray] Core initialization error: $e');
      }
    }
  }

  static Future<bool> prepareVpn() async {
    if (!Platform.isAndroid) return true;
    try {
      await initialize();
      return await _flutterV2ray.requestPermission();
    } catch (e) {
      debugPrint('[V2Ray] Permission request error: $e');
      return false;
    }
  }

  static Future<bool> startVpn(NodeModel node, {List<String>? blockedApps, List<String>? bypassSubnets}) async {
    if (Platform.isAndroid) {
      try {
        await initialize();
        final hasPermission = await _flutterV2ray.requestPermission();
        if (!hasPermission) {
          debugPrint('[V2Ray] VPN Permission denied by user');
          return false;
        }

        String config = '';
        try {
          final v2rayURL = FlutterV2ray.parseFromURL(node.rawUri);
          config = v2rayURL.getFullConfiguration();
        } catch (parseErr) {
          debugPrint('[V2Ray] Standard parser error ($parseErr), generating manual Xray config...');
          config = _buildUniversalXrayConfig(node);
        }

        if (config.isEmpty) {
          config = _buildUniversalXrayConfig(node);
        }

        await _flutterV2ray.startV2Ray(
          remark: '${node.flagEmoji ?? "🌐"} ${node.name}',
          config: config,
          blockedApps: blockedApps,
          bypassSubnets: bypassSubnets,
          proxyOnly: false,
        );
        debugPrint('[V2Ray] VPN tunnel started successfully for ${node.name}');
        return true;
      } catch (e) {
        debugPrint('[V2Ray] startVpn error: $e');
        return false;
      }
    } else if (Platform.isWindows) {
      return await WindowsProxyService.start(node);
    } else {
      await Future.delayed(const Duration(milliseconds: 300));
      return true;
    }
  }

  static Future<bool> stopVpn() async {
    if (Platform.isAndroid) {
      try {
        await _flutterV2ray.stopV2Ray();
        debugPrint('[V2Ray] VPN tunnel stopped');
        return true;
      } catch (e) {
        debugPrint('[V2Ray] stopVpn error: $e');
        return false;
      }
    } else if (Platform.isWindows) {
      return await WindowsProxyService.stop();
    } else {
      return true;
    }
  }

  static Future<bool> isVpnConnected() async {
    if (Platform.isAndroid) {
      return stateNotifier.value == 'CONNECTED';
    } else if (Platform.isWindows) {
      return WindowsProxyService.isProxyActive;
    }
    return false;
  }

  /// Universal fallback Xray JSON config generator
  static String _buildUniversalXrayConfig(NodeModel node) {
    final uri = Uri.tryParse(node.rawUri);
    final params = uri?.queryParameters ?? {};
    final scheme = uri?.scheme.toLowerCase() ?? 'vless';
    final userInfo = uri?.userInfo ?? '00000000-0000-0000-0000-000000000000';
    final host = uri?.host.isNotEmpty == true ? uri!.host : node.server;
    final port = uri?.hasPort == true ? uri!.port : node.port;

    final security = params['security'] ?? (params['tls'] == '1' ? 'tls' : 'none');
    final sni = params['sni'] ?? params['peer'] ?? host;
    final pbk = params['pbk'] ?? '';
    final sid = params['sid'] ?? '';
    final fp = params['fp'] ?? 'chrome';
    final flow = params['flow'] ?? '';

    Map<String, dynamic> outbound = {
      "tag": "proxy",
      "protocol": scheme == 'trojan' ? 'trojan' : 'vless',
      "settings": {
        "vnext": [
          {
            "address": host,
            "port": port,
            "users": [
              {
                "id": userInfo,
                "encryption": "none",
                if (flow.isNotEmpty) "flow": flow,
              }
            ]
          }
        ]
      },
      "streamSettings": {
        "network": params['type'] ?? 'tcp',
        "security": security,
      }
    };

    if (security == 'reality') {
      outbound['streamSettings']['realitySettings'] = {
        "serverName": sni,
        "fingerprint": fp,
        "publicKey": pbk,
        "shortId": sid,
        "spiderX": params['spx'] ?? ""
      };
    } else if (security == 'tls') {
      outbound['streamSettings']['tlsSettings'] = {
        "serverName": sni,
        "fingerprint": fp,
        "allowInsecure": true
      };
    }

    final fullConfig = {
      "log": {"loglevel": "warning"},
      "inbounds": [
        {
          "tag": "socks",
          "port": 10808,
          "listen": "127.0.0.1",
          "protocol": "socks",
          "settings": {"auth": "noauth", "udp": true}
        },
        {
          "tag": "http",
          "port": 10809,
          "listen": "127.0.0.1",
          "protocol": "http"
        }
      ],
      "outbounds": [
        outbound,
        {"tag": "direct", "protocol": "freedom"},
        {"tag": "block", "protocol": "blackhole"}
      ]
    };

    return jsonEncode(fullConfig);
  }
}
