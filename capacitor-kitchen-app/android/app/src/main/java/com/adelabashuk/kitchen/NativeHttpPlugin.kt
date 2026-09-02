package com.adelabashuk.kitchen

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Plain HTTP request via HttpURLConnection, entirely outside the WebView — so it is
 * NOT subject to CORS at all (CORS is a browser/WebView-JS-engine concept; a native
 * HTTP call has no origin to enforce it against). Used as a fallback for the site's
 * own Netlify Functions when the app's fetch() calls (from https://localhost) hit a
 * CORS rejection ("Failed to fetch", no HTTP status ever received) that couldn't be
 * resolved or verified server-side from this environment.
 */
@CapacitorPlugin(name = "NativeHttp")
class NativeHttpPlugin : Plugin() {
    private val executor = Executors.newCachedThreadPool()

    @PluginMethod
    fun request(call: PluginCall) {
        val urlStr = call.getString("url")
        val method = (call.getString("method") ?: "GET").uppercase()
        val headersObj = call.getObject("headers")
        val body = call.getString("body")

        if (urlStr.isNullOrEmpty()) {
            call.reject("url חסר")
            return
        }

        executor.execute {
            var conn: HttpURLConnection? = null
            try {
                conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                    requestMethod = method
                    connectTimeout = 15000
                    readTimeout = 15000
                    doInput = true
                }

                if (headersObj != null) {
                    val keys = headersObj.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        conn.setRequestProperty(k, headersObj.getString(k))
                    }
                }

                if (!body.isNullOrEmpty() && method in setOf("POST", "PUT", "PATCH", "DELETE")) {
                    conn.doOutput = true
                    OutputStreamWriter(conn.outputStream, Charsets.UTF_8).use { it.write(body) }
                }

                val status = conn.responseCode
                val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                val respBody = stream?.let {
                    BufferedReader(InputStreamReader(it, Charsets.UTF_8)).use { r -> r.readText() }
                } ?: ""

                val respHeaders = JSObject()
                for ((key, values) in conn.headerFields) {
                    if (key != null && values.isNotEmpty()) respHeaders.put(key, values[0])
                }

                val result = JSObject()
                result.put("status", status)
                result.put("body", respBody)
                result.put("headers", respHeaders)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("בקשת HTTP נייטיבית נכשלה: ${e.message}", e)
            } finally {
                conn?.disconnect()
            }
        }
    }
}
