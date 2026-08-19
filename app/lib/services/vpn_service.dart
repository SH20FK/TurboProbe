import 'dart:async';
import 'dart:io';
import 'package:flutter/services.dart';
import '../models/node_model.dart';

enum VpnState {
  disconnected,
  connecting,
  connected,
  disconnecting,
  error,
}

class VpnService {
  static const MethodChannel _channel = MethodChannel('com.turboprobe.vpn/engine');

  static Future<bool> prepareVpn() async {
    if (!Platform.isAndroid) return true;
    try {
      final res = await _channel.invokeMethod<bool>('prepareVpn');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> startVpn(NodeModel node) async {
    if (Platform.isAndroid) {
      try {
        final res = await _channel.invokeMethod<bool>('startVpn', {
          'server_name': '${node.flagEmoji ?? "🌐"} ${node.name}',
          'server_ip': node.server,
          'port': node.port,
          'protocol': node.protocol,
          'raw_uri': node.rawUri,
        });
        return res ?? false;
      } catch (_) {
        return false;
      }
    } else {
      // Desktop Fallback: Local proxy simulation / SOCKS5 connection
      await Future.delayed(const Duration(milliseconds: 500));
      return true;
    }
  }

  static Future<bool> stopVpn() async {
    if (Platform.isAndroid) {
      try {
        final res = await _channel.invokeMethod<bool>('stopVpn');
        return res ?? true;
      } catch (_) {
        return false;
      }
    } else {
      await Future.delayed(const Duration(milliseconds: 300));
      return true;
    }
  }

  static Future<bool> isVpnConnected() async {
    if (Platform.isAndroid) {
      try {
        final res = await _channel.invokeMethod<bool>('isVpnConnected');
        return res ?? false;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}
