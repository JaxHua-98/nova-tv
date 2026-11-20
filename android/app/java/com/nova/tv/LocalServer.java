package com.nova.tv;

import android.content.res.AssetManager;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.LinkedBlockingDeque;

/**
 * 本地 HTTP 服务：
 *  1) 把 assets/www 通过 http://<本机IP>:PORT 暴露给 WebView 与手机浏览器
 *  2) /api/proxy 同源转发远端资源（图片 / 音视频 / WebAudio 频谱）
 *  3) /push 手机端推送页：在手机上粘订阅地址，推到电视（解决遥控器输入难题）
 */
public class LocalServer extends Thread {

    public interface PortListener {
        void onPort(int port);
    }

    private static final Map<String, String> MIME = new HashMap<>();

    static {
        MIME.put("html", "text/html; charset=utf-8");
        MIME.put("js", "application/javascript; charset=utf-8");
        MIME.put("css", "text/css; charset=utf-8");
        MIME.put("json", "application/json; charset=utf-8");
        MIME.put("webp", "image/webp");
        MIME.put("png", "image/png");
        MIME.put("jpg", "image/jpeg");
        MIME.put("svg", "image/svg+xml");
        MIME.put("ttf", "font/ttf");
        MIME.put("mp3", "audio/mpeg");
        MIME.put("m4a", "audio/mp4");
        MIME.put("mp4", "video/mp4");
        MIME.put("m3u8", "application/vnd.apple.mpegurl");
        MIME.put("ts", "video/mp2t");
    }

    /** 手机推过来的订阅，等着电视端轮询取走 */
    private static final LinkedBlockingDeque<String> PENDING = new LinkedBlockingDeque<>();
    private static String pairCode = "0000";
    private static long pairCodeAt = System.currentTimeMillis();

    private final AssetManager assets;
    private ServerSocket server;
    private PortListener listener;

    public LocalServer(AssetManager assets, String code, PortListener listener) {
        this.assets = assets;
        this.listener = listener;
        setPairCode(code);
    }

    public static void setPairCode(String code) {
        pairCode = code == null ? "0000" : code;
        pairCodeAt = System.currentTimeMillis();
    }

    public static String getPairCode() {
        return pairCode;
    }

    /** 5 分钟不活动就换码，避免同网段一直能推 */
    private static void rotateIfStale() {
        if (System.currentTimeMillis() - pairCodeAt > 5 * 60 * 1000L) {
            pairCode = String.format(Locale.US, "%04d", (int) (Math.random() * 10000));
            pairCodeAt = System.currentTimeMillis();
            PENDING.clear();
        }
    }

    public static String lanIp() {
        try {
            List<NetworkInterface> interfaces = Collections.list(NetworkInterface.getNetworkInterfaces());
            for (NetworkInterface ni : interfaces) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        String ip = addr.getHostAddress();
                        if (ip != null && ip.startsWith("192.168.")) return ip;
                    }
                }
            }
            for (NetworkInterface ni : interfaces) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        return addr.getHostAddress();
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return "127.0.0.1";
    }

    public int getPort() {
        return server == null ? 0 : server.getLocalPort();
    }

    @Override
    public void run() {
        try {
            server = new ServerSocket(0, 32, InetAddress.getByName("0.0.0.0"));
            if (listener != null) listener.onPort(server.getLocalPort());
            while (!isInterrupted()) {
                Socket socket = server.accept();
                new Thread(new Session(socket)).start();
            }
        } catch (IOException ignored) {
        }
    }

    public void shutdown() {
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
        interrupt();
    }

    /* ---------------- 手机推送页 ---------------- */

    private static String pushPage() {
        return "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\" />"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />"
                + "<title>推送到 NOVA TV</title><style>"
                + "body{margin:0;background:#0a0c1e;color:#eef;font:16px/1.6 system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center}"
                + ".card{width:min(92vw,460px);background:#151833;border:1px solid #2c3163;border-radius:18px;padding:26px}"
                + "h1{font-size:20px;margin:0 0 6px}p.sub{margin:0 0 18px;color:#9aa0c8;font-size:13px}"
                + "label{display:block;font-size:13px;color:#9aa0c8;margin:14px 0 6px}"
                + "input,textarea{width:100%;box-sizing:border-box;background:#0e1130;border:1px solid #313769;color:#fff;border-radius:10px;padding:12px;font-size:15px}"
                + "textarea{height:120px;resize:vertical}"
                + ".row{display:flex;gap:10px;margin-top:18px}"
                + "button{flex:1;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:600;background:#6f5cf0;color:#fff}"
                + ".code{font:600 22px/1 ui-monospace,monospace;letter-spacing:6px;color:#b9a9ff;text-align:center;margin:6px 0 0}"
                + ".msg{margin-top:14px;font-size:14px;min-height:20px;color:#7ee2a8}.msg.err{color:#ff8b8b}"
                + "input.code-input{text-align:center;letter-spacing:8px;font:600 20px/1 ui-monospace,monospace}"
                + "</style></head><body><div class=\"card\">"
                + "<h1>推送到 NOVA TV</h1><p class=\"sub\">在手机上粘好，电视上就会自动添加</p>"
                + "<label>电视上显示的配对码</label><input class=\"code-input\" id=\"code\" inputmode=\"numeric\" maxlength=\"4\" />"
                + "<label>订阅地址</label><input id=\"url\" placeholder=\"http://.../tvbox.json\" />"
                + "<label>或者直接粘 JSON 配置</label><textarea id=\"raw\" placeholder=\"{ &quot;sites&quot;: [ ... ] }\"></textarea>"
                + "<div class=\"row\"><button id=\"send\">发送到电视</button></div>"
                + "<div class=\"msg\" id=\"msg\"></div></div><script>"
                + "const $=id=>document.getElementById(id);const m=$('msg');"
                + "$('send').onclick=async()=>{const c=$('code').value.trim(),u=$('url').value.trim(),r=$('raw').value.trim();"
                + "if(c.length!==4){m.className='msg err';m.textContent='配对码是电视上显示的 4 位数字';return}"
                + "if(!u&&!r){m.className='msg err';m.textContent='订阅地址和 JSON 至少填一个';return}"
                + "m.className='msg';m.textContent='发送中…';"
                + "const body=new URLSearchParams({c,url:u,raw:r});"
                + "try{const res=await fetch('/push/api/submit',{method:'POST',body});const j=await res.json();"
                + "if(j.ok){m.className='msg';m.textContent='已发送，回电视看一眼 😀';$('url').value='';$('raw').value=''}"
                + "else{m.className='msg err';m.textContent=j.error||'配对码不对'}}catch(e){m.className='msg err';m.textContent='发送失败：'+e.message}};"
                + "</script></body></html>";
    }

    private final class Session implements Runnable {
        private final Socket socket;

        Session(Socket socket) {
            this.socket = socket;
        }

        @Override
        public void run() {
            try {
                InputStream in = new BufferedInputStream(socket.getInputStream());
                String requestLine = readLine(in);
                if (requestLine == null || requestLine.isEmpty()) {
                    socket.close();
                    return;
                }
                String[] parts = requestLine.split(" ");
                if (parts.length < 2) {
                    socket.close();
                    return;
                }
                String method = parts[0];
                String path = parts[1];

                Map<String, String> headers = new HashMap<>();
                String line;
                while ((line = readLine(in)) != null && !line.isEmpty()) {
                    int idx = line.indexOf(':');
                    if (idx > 0) headers.put(line.substring(0, idx).trim().toLowerCase(Locale.US), line.substring(idx + 1).trim());
                }

                if ("OPTIONS".equalsIgnoreCase(method)) {
                    writeEmpty(204);
                    return;
                }

                if (path.startsWith("/push/api/")) {
                    handlePushApi(method, path, headers, in);
                    return;
                }
                if (path.startsWith("/push")) {
                    writeBytes(200, "text/html; charset=utf-8", pushPage().getBytes("UTF-8"));
                    return;
                }
                if (path.startsWith("/api/proxy")) {
                    proxy(path, headers.get("range"));
                    return;
                }
                serveAsset(path);
            } catch (Exception ignored) {
                try {
                    socket.close();
                } catch (IOException e) {
                }
            }
        }

        private void handlePushApi(String method, String path, Map<String, String> headers, InputStream in) throws IOException {
            rotateIfStale();
            if (path.startsWith("/push/api/info")) {
                String json = "{\"ok\":true,\"code\":\"" + pairCode + "\",\"ip\":\"" + lanIp() + "\",\"port\":" + getPort() + "}";
                writeBytes(200, "application/json; charset=utf-8", json.getBytes("UTF-8"));
                return;
            }
            if (path.startsWith("/push/api/submit") && "POST".equalsIgnoreCase(method)) {
                int len = 0;
                try {
                    len = Integer.parseInt(headers.getOrDefault("content-length", "0"));
                } catch (NumberFormatException ignored) {
                }
                byte[] body = new byte[len];
                int read = 0;
                while (read < len) {
                    int n = in.read(body, read, len - read);
                    if (n < 0) break;
                    read += n;
                }
                String form = new String(body, 0, read, "UTF-8");
                Map<String, String> fields = parseForm(form);
                String code = fields.getOrDefault("c", "");
                if (!pairCode.equals(code)) {
                    writeBytes(200, "application/json; charset=utf-8", "{\"ok\":false,\"error\":\"配对码不对\"}".getBytes("UTF-8"));
                    return;
                }
                String url = fields.getOrDefault("url", "").trim();
                String raw = fields.getOrDefault("raw", "").trim();
                if (url.isEmpty() && raw.isEmpty()) {
                    writeBytes(200, "application/json; charset=utf-8", "{\"ok\":false,\"error\":\"内容为空\"}".getBytes("UTF-8"));
                    return;
                }
                PENDING.offer("{\"url\":" + quote(url) + ",\"raw\":" + quote(raw) + "}");
                pairCodeAt = System.currentTimeMillis();
                writeBytes(200, "application/json; charset=utf-8", "{\"ok\":true}".getBytes("UTF-8"));
                return;
            }
            if (path.startsWith("/push/api/poll")) {
                String code = "";
                int q = path.indexOf("c=");
                if (q >= 0) code = URLDecoder.decode(path.substring(q + 2).split("&")[0], "UTF-8");
                if (!pairCode.equals(code)) {
                    writeBytes(200, "application/json; charset=utf-8", "{\"ok\":false,\"items\":[]}".getBytes("UTF-8"));
                    return;
                }
                List<String> items = new ArrayList<>();
                String item;
                while ((item = PENDING.poll()) != null) items.add(item);
                StringBuilder sb = new StringBuilder("{\"ok\":true,\"code\":\"" + pairCode + "\",\"items\":[");
                for (int i = 0; i < items.size(); i++) {
                    if (i > 0) sb.append(',');
                    sb.append(items.get(i));
                }
                sb.append("]}");
                writeBytes(200, "application/json; charset=utf-8", sb.toString().getBytes("UTF-8"));
                return;
            }
            writeBytes(404, "application/json; charset=utf-8", "{\"ok\":false}".getBytes("UTF-8"));
        }

        private Map<String, String> parseForm(String form) {
            Map<String, String> out = new HashMap<>();
            for (String pair : form.split("&")) {
                int idx = pair.indexOf('=');
                if (idx < 0) continue;
                try {
                    out.put(URLDecoder.decode(pair.substring(0, idx), "UTF-8"),
                            URLDecoder.decode(pair.substring(idx + 1), "UTF-8"));
                } catch (Exception ignored) {
                }
            }
            return out;
        }

        private String quote(String value) {
            if (value == null) return "\"\"";
            StringBuilder sb = new StringBuilder("\"");
            for (char ch : value.toCharArray()) {
                switch (ch) {
                    case '"': sb.append("\\\""); break;
                    case '\\': sb.append("\\\\"); break;
                    case '\n': sb.append("\\n"); break;
                    case '\r': sb.append("\\r"); break;
                    case '\t': sb.append("\\t"); break;
                    default:
                        if (ch < 0x20) sb.append(String.format("\\u%04x", (int) ch));
                        else sb.append(ch);
                }
            }
            return sb.append('"').toString();
        }

        private String readLine(InputStream in) throws IOException {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            int c;
            while ((c = in.read()) != -1) {
                if (c == '\n') break;
                if (c != '\r') buf.write(c);
                if (buf.size() > 16384) break;
            }
            if (c == -1 && buf.size() == 0) return null;
            return new String(buf.toByteArray(), "UTF-8");
        }

        private void writeEmpty(int code) throws IOException {
            OutputStream out = socket.getOutputStream();
            out.write(("HTTP/1.1 " + code + " No Content\r\n"
                    + "Access-Control-Allow-Origin: *\r\n"
                    + "Access-Control-Allow-Headers: *\r\n"
                    + "Access-Control-Allow-Methods: GET,HEAD,POST,OPTIONS\r\n"
                    + "Content-Length: 0\r\n\r\n").getBytes("UTF-8"));
            out.flush();
            socket.close();
        }

        private void writeBytes(int code, String mime, byte[] body) throws IOException {
            OutputStream out = socket.getOutputStream();
            out.write(("HTTP/1.1 " + code + " OK\r\n"
                    + "Content-Type: " + mime + "\r\n"
                    + "Content-Length: " + body.length + "\r\n"
                    + "Access-Control-Allow-Origin: *\r\n"
                    + "Cache-Control: no-store\r\n\r\n").getBytes("UTF-8"));
            out.write(body);
            out.flush();
            socket.close();
        }

        private void serveAsset(String rawPath) throws IOException {
            String path = rawPath.split("\\?")[0];
            if (path.equals("/") || path.isEmpty()) path = "/index.html";
            String assetPath = "www" + path;
            try {
                InputStream src = assets.open(assetPath);
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int n;
                while ((n = src.read(chunk)) > 0) buf.write(chunk, 0, n);
                src.close();
                String ext = assetPath.substring(assetPath.lastIndexOf('.') + 1).toLowerCase(Locale.US);
                writeBytes(200, MIME.containsKey(ext) ? MIME.get(ext) : "application/octet-stream", buf.toByteArray());
            } catch (IOException missing) {
                writeBytes(404, "text/plain; charset=utf-8", "not found".getBytes("UTF-8"));
            }
        }

        private void proxy(String rawPath, String range) throws IOException {
            int q = rawPath.indexOf("url=");
            if (q < 0) {
                writeBytes(400, "text/plain; charset=utf-8", "missing url".getBytes("UTF-8"));
                return;
            }
            String target = URLDecoder.decode(rawPath.substring(q + 4), "UTF-8");
            HttpURLConnection conn = (HttpURLConnection) new URL(target).openConnection();
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(20000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android TV) NOVA/1.0");
            if (range != null) conn.setRequestProperty("Range", range);

            int code = conn.getResponseCode();
            if (code >= 400) {
                writeBytes(code, "text/plain; charset=utf-8", ("upstream " + code).getBytes("UTF-8"));
                return;
            }
            InputStream src;
            try {
                src = conn.getInputStream();
            } catch (IOException e) {
                src = conn.getErrorStream();
            }
            String type = conn.getContentType();
            if (type == null) type = "application/octet-stream";
            int length = conn.getContentLength();

            OutputStream out = socket.getOutputStream();
            StringBuilder head = new StringBuilder();
            head.append("HTTP/1.1 ").append(code == 206 ? "206 Partial Content" : "200 OK").append("\r\n");
            head.append("Content-Type: ").append(type).append("\r\n");
            head.append("Access-Control-Allow-Origin: *\r\n");
            head.append("Accept-Ranges: bytes\r\n");
            if (length >= 0) head.append("Content-Length: ").append(length).append("\r\n");
            String cr = conn.getHeaderField("Content-Range");
            if (cr != null) head.append("Content-Range: ").append(cr).append("\r\n");
            head.append("\r\n");
            out.write(head.toString().getBytes("UTF-8"));
            if (src != null) {
                byte[] chunk = new byte[32768];
                int n;
                while ((n = src.read(chunk)) > 0) out.write(chunk, 0, n);
                src.close();
            }
            out.flush();
            conn.disconnect();
            socket.close();
        }
    }

    /* 保留一个占位，避免 LinkedList 未使用告警 */
    private static final LinkedList<String> UNUSED = new LinkedList<>();
}
