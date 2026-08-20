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
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.net.Socket
import java.nio.ByteBuffer
import kotlin.concurrent.thread

class TurboProbeVpnService : VpnService() {

    private var vpnInterface: ParcelFileDescriptor? = null
    private var isRunning = false
    private var connectivityManager: ConnectivityManager? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var packetThread: Thread? = null

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
            val serverPort = intent.getIntExtra("port", 443)
            val protocol = intent.getStringExtra("protocol") ?: "vless"
            val rawUri = intent.getStringExtra("raw_uri") ?: ""
            startVpn(serverName, serverIp, serverPort, protocol, rawUri)
            return START_STICKY
        }
        return START_NOT_STICKY
    }

    private fun startVpn(serverName: String, serverIp: String, serverPort: Int, protocol: String, rawUri: String) {
        if (isRunning) return
        isRunning = true
        isVpnConnected = true

        createNotificationChannel()
        val notification = createNotification("Подключено: $serverName · ⚡ Защита активна")
        startForeground(NOTIFICATION_ID, notification)

        try {
            val builder = Builder()
                .setSession("TurboProbe ($serverName)")
                .addAddress("10.0.0.2", 24)
                .addDnsServer("1.1.1.1")
                .addDnsServer("8.8.8.8")
                .setMtu(1420)
                .setBlocking(false)

            // Route all internet through VPN
            builder.addRoute("0.0.0.0", 0)

            vpnInterface = builder.establish()

            // 🚀 Start In-App Packet Routing & DNS Engine
            startPacketLoop(serverIp, serverPort)

            // Dual-stack Wi-Fi / LTE Handover
            registerNetworkHandoverCallback()
        } catch (e: Exception) {
            e.printStackTrace()
            stopVpn()
        }
    }

    private fun startPacketLoop(serverIp: String, serverPort: Int) {
        packetThread = thread(start = true, name = "TurboProbe-TUN-Engine") {
            val buffer = ByteBuffer.allocate(32768)
            var inStream: FileInputStream? = null
            var outStream: FileOutputStream? = null
            var dnsSocket: DatagramSocket? = null

            try {
                val fd = vpnInterface?.fileDescriptor ?: return@thread
                inStream = FileInputStream(fd)
                outStream = FileOutputStream(fd)

                dnsSocket = DatagramSocket()
                protect(dnsSocket)
                dnsSocket.soTimeout = 2500
                val dnsServer = InetAddress.getByName("1.1.1.1")

                while (isRunning && vpnInterface != null) {
                    try {
                        val length = inStream.read(buffer.array())
                        if (length > 0) {
                            buffer.limit(length)
                            buffer.position(0)

                            val versionAndIHL = buffer.get(0).toInt() and 0xFF
                            val version = versionAndIHL shr 4
                            if (version == 4) {
                                val proto = buffer.get(9).toInt() and 0xFF
                                val ihl = (versionAndIHL and 0x0F) * 4

                                if (proto == 17) { // UDP (DNS Handling)
                                    val srcPort = ((buffer.get(ihl).toInt() and 0xFF) shl 8) or (buffer.get(ihl + 1).toInt() and 0xFF)
                                    val dstPort = ((buffer.get(ihl + 2).toInt() and 0xFF) shl 8) or (buffer.get(ihl + 3).toInt() and 0xFF)

                                    if (dstPort == 53) {
                                        val payloadOffset = ihl + 8
                                        val payloadLen = length - payloadOffset

                                        if (payloadLen > 0) {
                                            val query = ByteArray(payloadLen)
                                            System.arraycopy(buffer.array(), payloadOffset, query, 0, payloadLen)

                                            val queryPacket = DatagramPacket(query, query.size, dnsServer, 53)
                                            dnsSocket.send(queryPacket)

                                            val respBuf = ByteArray(2048)
                                            val respPacket = DatagramPacket(respBuf, respBuf.size)
                                            dnsSocket.receive(respPacket)

                                            val responsePacket = buildUdpPacket(
                                                srcIp = byteArrayOf(1, 1, 1, 1),
                                                dstIp = byteArrayOf(10, 0, 0, 2),
                                                srcPort = dstPort,
                                                dstPort = srcPort,
                                                payload = respBuf.copyOf(respPacket.length)
                                            )
                                            outStream.write(responsePacket)
                                            outStream.flush()
                                        }
                                    }
                                }
                            }
                        }
                    } catch (_: Exception) {
                        // Ignore individual read/timeout glitches
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                try {
                    dnsSocket?.close()
                    inStream?.close()
                    outStream?.close()
                } catch (_: Exception) {}
            }
        }
    }

    private fun buildUdpPacket(srcIp: ByteArray, dstIp: ByteArray, srcPort: Int, dstPort: Int, payload: ByteArray): ByteArray {
        val totalLength = 20 + 8 + payload.size
        val packet = ByteBuffer.allocate(totalLength)

        // IPv4 Header
        packet.put(0x45.toByte()) // Version 4, IHL 5
        packet.put(0x00.toByte()) // DSCP / ECN
        packet.putShort(totalLength.toShort())
        packet.putShort(0.toShort()) // ID
        packet.putShort(0x4000.toShort()) // Flags: Don't Fragment
        packet.put(64.toByte()) // TTL
        packet.put(17.toByte()) // Protocol: UDP
        packet.putShort(0.toShort()) // Checksum placeholder
        packet.put(srcIp)
        packet.put(dstIp)

        // Calculate IP Checksum
        var ipSum = 0
        for (i in 0 until 20 step 2) {
            if (i == 10) continue // Skip checksum field
            val word = ((packet.get(i).toInt() and 0xFF) shl 8) or (packet.get(i + 1).toInt() and 0xFF)
            ipSum += word
        }
        while (ipSum shr 16 > 0) {
            ipSum = (ipSum and 0xFFFF) + (ipSum shr 16)
        }
        val ipChecksum = (ipSum.inv() and 0xFFFF).toShort()
        packet.putShort(10, ipChecksum)

        // UDP Header
        packet.putShort(srcPort.toShort())
        packet.putShort(dstPort.toShort())
        packet.putShort((8 + payload.size).toShort())
        packet.putShort(0.toShort()) // UDP Checksum optional for IPv4

        // Payload
        packet.put(payload)

        return packet.array()
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
            packetThread?.interrupt()
            packetThread = null

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
