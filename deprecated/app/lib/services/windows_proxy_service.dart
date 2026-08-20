import 'dart:async';
import 'dart:io';
import '../models/node_model.dart';

class WindowsProxyService {
  static HttpServer? _localBridgeServer;
  static int localPort = 10808;
  static bool isProxyActive = false;

  /// Starts local proxy bridge and enables Windows System Proxy
  static Future<bool> start(NodeModel node) async {
    if (!Platform.isWindows) return true;

    try {
      // 1. Stop existing proxy if running
      await stop();

      // 2. Start local HTTP forwarding bridge
      _localBridgeServer = await HttpServer.bind(InternetAddress.loopbackIPv4, localPort);
      _localBridgeServer!.listen((HttpRequest request) async {
        try {
          if (request.method == 'CONNECT') {
            // HTTPS Tunneling
            final clientSocket = await request.response.detachSocket();
            try {
              final remoteSocket = await Socket.connect(node.server, node.port, timeout: const Duration(seconds: 5));
              clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
              await clientSocket.flush();

              // Pipe sockets bidirectionally
              clientSocket.listen(
                (data) => remoteSocket.add(data),
                onError: (_) {
                  try { clientSocket.destroy(); remoteSocket.destroy(); } catch (_) {}
                },
                onDone: () {
                  try { remoteSocket.close(); } catch (_) {}
                },
                cancelOnError: true,
              );

              remoteSocket.listen(
                (data) => clientSocket.add(data),
                onError: (_) {
                  try { remoteSocket.destroy(); clientSocket.destroy(); } catch (_) {}
                },
                onDone: () {
                  try { clientSocket.close(); } catch (_) {}
                },
                cancelOnError: true,
              );
            } catch (_) {
              try { clientSocket.destroy(); } catch (_) {}
            }
          } else {
            // Standard HTTP
            final client = HttpClient()..badCertificateCallback = (_, __, ___) => true;
            final req = await client.openUrl(request.method, request.uri);
            request.headers.forEach((name, values) {
              for (final v in values) {
                req.headers.add(name, v);
              }
            });
            final resp = await req.close();
            request.response.statusCode = resp.statusCode;
            resp.headers.forEach((name, values) {
              for (final v in values) {
                request.response.headers.add(name, v);
              }
            });
            await request.response.addStream(resp);
            await request.response.close();
          }
        } catch (_) {}
      });

      // 3. Set Windows System Proxy Registry (with Smart RU Direct bypass)
      await Process.run('reg', [
        'add',
        r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
        '/v',
        'ProxyServer',
        '/t',
        'REG_SZ',
        '/d',
        'http=127.0.0.1:$localPort;https=127.0.0.1:$localPort',
        '/f'
      ]);

      await Process.run('reg', [
        'add',
        r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
        '/v',
        'ProxyOverride',
        '/t',
        'REG_SZ',
        '/d',
        '<local>;*.ru;*.рф;*.gosuslugi.ru;*.sberbank.ru;*.vk.com;*.yandex.ru',
        '/f'
      ]);

      await Process.run('reg', [
        'add',
        r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
        '/v',
        'ProxyEnable',
        '/t',
        'REG_DWORD',
        '/d',
        '1',
        '/f'
      ]);

      isProxyActive = true;
      return true;
    } catch (e) {
      await stop();
      return false;
    }
  }

  /// Disables Windows System Proxy and shuts down local server
  static Future<bool> stop() async {
    if (!Platform.isWindows) return true;

    try {
      _localBridgeServer?.close(force: true);
      _localBridgeServer = null;

      await Process.run('reg', [
        'add',
        r'HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings',
        '/v',
        'ProxyEnable',
        '/t',
        'REG_DWORD',
        '/d',
        '0',
        '/f'
      ]);

      isProxyActive = false;
      return true;
    } catch (_) {
      return false;
    }
  }
}
