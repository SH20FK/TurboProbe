import 'dart:async';
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
    },
  );

  static FlutterV2ray get engine => _flutterV2ray;

  static Future<void> initialize() async {
    if (Platform.isAndroid && !_isInitialized) {
      try {
        await _flutterV2ray.initializeV2Ray();
        _isInitialized = true;
      } catch (_) {}
    }
  }

  static Future<bool> prepareVpn() async {
    if (!Platform.isAndroid) return true;
    try {
      await initialize();
      return await _flutterV2ray.requestPermission();
    } catch (_) {
      return false;
    }
  }

  static Future<bool> startVpn(NodeModel node, {List<String>? blockedApps, List<String>? bypassSubnets}) async {
    if (Platform.isAndroid) {
      try {
        await initialize();
        final hasPermission = await _flutterV2ray.requestPermission();
        if (!hasPermission) return false;

        final v2rayURL = FlutterV2ray.parseFromURL(node.rawUri);
        await _flutterV2ray.startV2Ray(
          remark: '${node.flagEmoji ?? "🌐"} ${node.name}',
          config: v2rayURL.getFullConfiguration(),
          blockedApps: blockedApps,
          bypassSubnets: bypassSubnets,
          proxyOnly: false,
        );
        return true;
      } catch (_) {
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
        return true;
      } catch (_) {
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
}
