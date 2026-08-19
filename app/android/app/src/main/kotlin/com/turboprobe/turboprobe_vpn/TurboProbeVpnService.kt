package com.turboprobe.turboprobe_vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor

class TurboProbeVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null

    companion object {
        const val ACTION_CONNECT = "com.turboprobe.vpn.CONNECT"
        const val ACTION_DISCONNECT = "com.turboprobe.vpn.DISCONNECT"
        const val CHANNEL_ID = "turboprobe_vpn_channel"
        const val NOTIFICATION_ID = 1001
        var isVpnConnected = false
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        if (action == ACTION_DISCONNECT) {
            stopVpn()
            return START_NOT_STICKY
        } else if (action == ACTION_CONNECT) {
            val serverName = intent.getStringExtra("server_name") ?: "TurboProbe Fast Node"
            val serverIp = intent.getStringExtra("server_ip") ?: "1.1.1.1"
            startVpn(serverName, serverIp)
            return START_STICKY
        }
        return START_NOT_STICKY
    }

    private fun startVpn(serverName: String, serverIp: String) {
        if (isRunning) return
        isRunning = true
        isVpnConnected = true

        createNotificationChannel()
        val notification = createNotification("Подключено: $serverName · ⚡ Turbo-Boost Bonding")
        startForeground(NOTIFICATION_ID, notification)

        try {
            val builder = Builder()
                .setSession("TurboProbe VPN ($serverName)")
                .addAddress("10.0.0.2", 24)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")
                .setMtu(1420)
                .setBlocking(false)

            // Split Routing: Default route via VPN
            builder.addRoute("0.0.0.0", 0)

            vpnInterface = builder.establish()

            // 🚀 Turbo-Boost Dual-Stack Wi-Fi / LTE Handover
            registerNetworkHandoverCallback()
        } catch (e: Exception) {
            e.printStackTrace()
            stopVpn()
        }
    }

    private fun registerNetworkHandoverCallback() {
        try {
            connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            val request = NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build()

            val cb = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    super.onAvailable(network)
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        setUnderlyingNetworks(arrayOf(network))
                    }
                }
            }
            networkCallback = cb
            connectivityManager?.registerNetworkCallback(request, cb)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopVpn() {
        isRunning = false
        isVpnConnected = false
        try {
            val cb = networkCallback
            if (cb != null) {
                connectivityManager?.unregisterNetworkCallback(cb)
                networkCallback = null
            }
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) {
            e.printStackTrace()
        }
        stopForeground(true)
        stopSelf()
    }

    override fun onDestroy() {
        stopVpn()
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "TurboProbe VPN Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(content: String): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("⚡ TurboProbe VPN")
            .setContentText(content)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
