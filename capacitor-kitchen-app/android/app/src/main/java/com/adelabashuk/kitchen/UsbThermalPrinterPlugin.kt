package com.adelabashuk.kitchen

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Base64
import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

private const val TAG = "UsbThermalPrinter"
private const val ACTION_USB_PERMISSION = "com.adelabashuk.kitchen.USB_PERMISSION"

/**
 * מדפסת תרמית USB בלי root: אנדרואיד טוען אוטומטית את דרייבר הקרנל usblp על כל מכשיר
 * מסוג USB Printer Class, ו-Chrome/WebUSB לא יכול לתפוס (claim) ממשק שכבר מוחזק ע"י דרייבר
 * קרנל (מגבלת Chromium, אין עקיפה בלי root מהדפדפן). אפליקציה נייטיבית יכולה, דרך
 * claimInterface(iface, force=true) — זה בדיוק מה שהפלאגין הזה עושה.
 */
@CapacitorPlugin(name = "UsbThermalPrinter")
class UsbThermalPrinterPlugin : Plugin() {

    private var connection: UsbDeviceConnection? = null
    private var claimedInterface: UsbInterface? = null
    private var endpointOut: UsbEndpoint? = null
    private var pendingConnectCall: PluginCall? = null

    private val usbManager: UsbManager
        get() = getContext().getSystemService(Context.USB_SERVICE) as UsbManager

    private val permissionReceiver = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context, intent: Intent) {
            if (intent.action != ACTION_USB_PERMISSION) return
            val call = pendingConnectCall ?: return
            pendingConnectCall = null

            val granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
            @Suppress("DEPRECATION")
            val dev = intent.getParcelableExtra<UsbDevice>(UsbManager.EXTRA_DEVICE)
            if (granted && dev != null) {
                val ok = openDevice(dev)
                if (ok) call.resolve(JSObject().put("connected", true))
                else call.reject("claimInterface נכשל — ראה Logcat (tag: $TAG)")
            } else {
                call.reject("המשתמש דחה את הרשאת ה-USB למדפסת")
            }
        }
    }

    override fun load() {
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(permissionReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            getContext().registerReceiver(permissionReceiver, filter)
        }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        val vendorId = call.getInt("vendorId")
        val productId = call.getInt("productId")
        // silent=true: never show the OS permission dialog (used for an automatic
        // reconnect-on-page-load attempt) — fail instead if permission isn't already granted.
        val silent = call.getBoolean("silent", false) ?: false

        val target = findTargetDevice(vendorId, productId)
        if (target == null) {
            val hint = if (vendorId != null && productId != null) " (vendorId=$vendorId, productId=$productId)" else ""
            call.reject("לא נמצאה מדפסת USB מחוברת$hint")
            return
        }

        if (usbManager.hasPermission(target)) {
            val ok = openDevice(target)
            if (ok) call.resolve(JSObject().put("connected", true))
            else call.reject("claimInterface נכשל — ראה Logcat (tag: $TAG)")
            return
        }

        if (silent) {
            call.reject("אין עדיין הרשאת USB למדפסת (silent connect)")
            return
        }

        pendingConnectCall = call
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        val permissionIntent = PendingIntent.getBroadcast(getContext(), 0, Intent(ACTION_USB_PERMISSION), flags)
        usbManager.requestPermission(target, permissionIntent)
    }

    @PluginMethod
    fun isConnected(call: PluginCall) {
        call.resolve(JSObject().put("connected", connection != null && endpointOut != null))
    }

    @PluginMethod
    fun printBytes(call: PluginCall) {
        val b64 = call.getString("bytesBase64")
        if (b64.isNullOrEmpty()) {
            call.reject("bytesBase64 חסר")
            return
        }
        val conn = connection
        val ep = endpointOut
        if (conn == null || ep == null) {
            call.reject("המדפסת לא מחוברת — קרא ל-connect() קודם")
            return
        }

        val bytes = Base64.decode(b64, Base64.DEFAULT)
        // Some USB-printer bulk endpoints choke on very large single transfers — chunk it.
        val chunkSize = 4096
        var offset = 0
        while (offset < bytes.size) {
            val len = minOf(chunkSize, bytes.size - offset)
            val result = conn.bulkTransfer(ep, bytes, offset, len, 5000)
            if (result < 0) {
                Log.e(TAG, "bulkTransfer נכשל: offset=$offset len=$len result=$result")
                call.reject("שליחת נתונים למדפסת נכשלה (bulkTransfer=$result)")
                return
            }
            offset += len
        }
        call.resolve(JSObject().put("ok", true))
    }

    @PluginMethod
    fun disconnect(call: PluginCall) {
        closeConnection()
        call.resolve()
    }

    private fun findTargetDevice(vendorId: Int?, productId: Int?): UsbDevice? {
        val devices = usbManager.deviceList.values
        if (vendorId != null && productId != null) {
            devices.firstOrNull { it.vendorId == vendorId && it.productId == productId }?.let { return it }
        }
        // Fallback: any attached device that exposes the USB Printer Class interface (0x07).
        return devices.firstOrNull { dev ->
            (0 until dev.interfaceCount).any { i -> dev.getInterface(i).interfaceClass == UsbConstants.USB_CLASS_PRINTER }
        }
    }

    private fun openDevice(dev: UsbDevice): Boolean {
        val printerInterface = (0 until dev.interfaceCount)
            .map { dev.getInterface(it) }
            .firstOrNull { it.interfaceClass == UsbConstants.USB_CLASS_PRINTER }
            ?: dev.getInterface(0)

        val outEndpoint = (0 until printerInterface.endpointCount)
            .map { printerInterface.getEndpoint(it) }
            .firstOrNull { it.direction == UsbConstants.USB_DIR_OUT }

        if (outEndpoint == null) {
            Log.e(TAG, "לא נמצא OUT endpoint בממשק ${printerInterface.id} של ${dev.deviceName}")
            return false
        }

        val conn = usbManager.openDevice(dev)
        if (conn == null) {
            Log.e(TAG, "usbManager.openDevice() החזיר null עבור ${dev.deviceName}")
            return false
        }

        // The step that solves the no-root problem: force=true detaches the kernel's
        // usblp driver (which Chrome/WebUSB cannot do from inside the browser sandbox)
        // and claims the interface for this app instead.
        val claimed = conn.claimInterface(printerInterface, true)
        if (!claimed) {
            Log.e(TAG, "claimInterface(iface=${printerInterface.id}, force=true) נכשל עבור ${dev.deviceName}")
            conn.close()
            return false
        }

        closeConnection()
        connection = conn
        claimedInterface = printerInterface
        endpointOut = outEndpoint
        Log.i(TAG, "מדפסת USB חוברה: ${dev.deviceName} VID=${dev.vendorId} PID=${dev.productId} iface=${printerInterface.id}")
        return true
    }

    private fun closeConnection() {
        val conn = connection
        val ifc = claimedInterface
        if (conn != null && ifc != null) {
            try { conn.releaseInterface(ifc) } catch (e: Exception) { Log.w(TAG, "releaseInterface: ${e.message}") }
        }
        conn?.close()
        connection = null
        claimedInterface = null
        endpointOut = null
    }

    override fun handleOnDestroy() {
        try { getContext().unregisterReceiver(permissionReceiver) } catch (e: Exception) { /* not registered */ }
        closeConnection()
    }
}
