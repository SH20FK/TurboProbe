package com.turboprobe.turboprobe_vpn

import android.app.Activity
import android.content.Intent
import android.net.VpnService
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.turboprobe.vpn/engine"
    private val VPN_REQUEST_CODE = 24601
    private var pendingResult: MethodChannel.Result? = null
    private var pendingServerName: String? = null
    private var pendingServerIp: String? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "prepareVpn" -> {
                    val intent = VpnService.prepare(this)
                    if (intent != null) {
                        pendingResult = result
                        startActivityForResult(intent, VPN_REQUEST_CODE)
                    } else {
                        result.success(true)
                    }
                }
                "startVpn" -> {
                    val serverName = call.argument<String>("server_name") ?: "TurboProbe Fast Node"
                    val serverIp = call.argument<String>("server_ip") ?: "1.1.1.1"
                    val serverPort = call.argument<Int>("port") ?: 443
                    val protocol = call.argument<String>("protocol") ?: "vless"
                    val rawUri = call.argument<String>("raw_uri") ?: ""

                    val intent = VpnService.prepare(this)
                    if (intent != null) {
                        pendingResult = result
                        pendingServerName = serverName
                        pendingServerIp = serverIp
                        startActivityForResult(intent, VPN_REQUEST_CODE)
                    } else {
                        startVpnService(serverName, serverIp, serverPort, protocol, rawUri)
                        result.success(true)
                    }
                }
                "stopVpn" -> {
                    val intent = Intent(this, TurboProbeVpnService::class.java).apply {
                        action = TurboProbeVpnService.ACTION_DISCONNECT
                    }
                    startService(intent)
                    result.success(true)
                }
                "isVpnConnected" -> {
                    result.success(TurboProbeVpnService.isVpnConnected)
                }
                else -> {
                    result.notImplemented()
                }
            }
        }
    }

    private fun startVpnService(serverName: String, serverIp: String, serverPort: Int = 443, protocol: String = "vless", rawUri: String = "") {
        val intent = Intent(this, TurboProbeVpnService::class.java).apply {
            action = TurboProbeVpnService.ACTION_CONNECT
            putExtra("server_name", serverName)
            putExtra("server_ip", serverIp)
            putExtra("port", serverPort)
            putExtra("protocol", protocol)
            putExtra("raw_uri", rawUri)
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == VPN_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK) {
                val sName = pendingServerName
                val sIp = pendingServerIp
                if (sName != null && sIp != null) {
                    startVpnService(sName, sIp)
                }
                pendingResult?.success(true)
            } else {
                pendingResult?.success(false)
            }
            pendingResult = null
            pendingServerName = null
            pendingServerIp = null
        }
    }
}
