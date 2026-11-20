# NOVA TV · Android TV APK

包名 `com.nova.tv` · v1.0 · 横屏 · Leanback

## 产物

```
dist/nova-tv.apk      0.62 MB   sha256 见下
app/assets/www/       1.72 MB   精简后的 web 资源（39 个文件）
```

## 架构

WebView 不直接加载 `file://`，而是先起一个**进程内本地 HTTP 服务**：

```
LocalServer（ServerSocket，127.0.0.1:随机端口）
  GET /            → 读 assets/www 静态文件
  GET /api/proxy   → 转发远端资源，支持 Range，剥 Referer
WebView ← http://127.0.0.1:PORT/index.html
```

原因：应用内所有海报、电台流都走 `/api/proxy`，且音乐频谱用 WebAudio
接 analyser —— 跨域音源会被静音。只有同源 HTTP 才能两者都正常。

## 电视适配

- `LEANBACK_LAUNCHER` + `LAUNCHER` 双入口
- 横屏锁定、全屏沉浸、保持常亮
- 返回键先派发 `Escape` 给页面（逐级返回），长按返回直接退出
- 菜单键派发 `ContextMenu`
- `setTextZoom(100)` 锁字体缩放，避免系统大字号撑坏布局

## 体积

| 项 | 原 | 现 |
|---|---|---|
| 图片 8 张 | 1.58 MB JPG | 150 KB WebP（480×720 q78） |
| 字体 | 465 KB / 5 字重 | 188 KB / 2 字重（500→400，600/800→700） |
| JS | 1.22 MB / 28 个 | 1.08 MB / 20 个（删 8 个死模块） |
| CSS | 330 KB / 11 个 | 278 KB / 8 个 |
| data / admin / tools / bak / 设计页 | 500 KB | 不进包 |
| **web 合计** | 4.3 MB | **1.72 MB** |
| **APK** | — | **0.62 MB** |

## 重建

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

依赖：`Android SDK build-tools 34.0.0` + `platforms/android-34` + `JDK 17`
（本机路径已写死在脚本顶部，换机器改这三行即可）

## 已验证

- `aapt2 compile / link` 通过
- `javac`（UTF-8 源码）通过，10 个 class
- `d8` 产出 classes.dex（626 KB）
- `zipalign` + `apksigner` 通过，签名校验 OK
- APK 内含 39 个 assets：`index.html`、`app.js`、`hls.min.js`、字体、WebP 全部命中

## 未验证（无设备连接）

- 真机安装与启动
- 遥控器键位手感
- 海报代理、电台播放、localStorage 持久化
- 4K 电视上的画布缩放

## 已知边界

- 需要联网才能拉到片源与海报（本地只是壳，不含版权内容）
- 老盒子 WebView < Chromium 60 时 HLS 可能不可用
- 仅横屏 TV 布局；手机上会拉伸，未做适配

## 证书

调试证书 `debug.keystore`，口令 `novatv`，别名 `nova`，有效期 10000 天。
正式发布前应换正式签名。
