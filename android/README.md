# NOVA TV · Android TV 原生试玩工程

这是在现有 NOVA TV 交互原型基础上落地的 Kotlin + Jetpack Compose Android TV
工程。当前目标是先评审原生 UI、遥控器焦点和模块结构，不交付 APK。

## 当前可试用内容

- Apple TV 风格首页，1920×1080 逻辑画布，等比适配 4K；
- 19 个首页焦点目标，完整方向键、Enter、Back 导航；
- 搜索、结果筛选、详情与收藏切换；
- 电视直播、聚合片库、音乐、收藏历史、设置页面；
- 标准 M3U/TXT 直播源解析器；
- Media3 全屏影视/直播播放器，支持 HLS 与 MP4、播放暂停、快进快退、静音和重试；
- 直播频道与片库详情均已接入公开测试信号；
- Media3 独立后台音乐域，内置 24 秒原创合成试听音轨；
- 内容源管理只存在于设置页，首页没有单独内容源模块；
- 明确不包含虎牙/抖音房间号换地址与平台专用防盗链逻辑。

## 工程结构

```text
app/src/main/java/com/novatv/app/
  MainActivity.kt
  data/        演示模型、农历日期、标准直播源解析
  playback/    MediaSessionService 与音乐控制器
  ui/
    components/ 流体背景、玻璃、图标、焦点组件
    home/       首页与 19 点焦点图
    search/     搜索层
    detail/     详情层
    live/       标准直播
    library/    聚合片库
    music/      独立音乐模块
    player/     Media3 全屏 HLS / MP4 播放器
    saved/      收藏与历史
    settings/   内容源与系统设置
```

更多迁移分析见：

- `docs/PROJECT_ANALYSIS.md`
- `docs/IMPLEMENTATION_STATUS.md`

## 构建环境

- JDK 17
- Android SDK Platform 35
- Android Build Tools 35.0.0
- Gradle 8.9 Wrapper
- 最低 Android 6.0（API 23），建议 Android TV 9+ 实机

仓库内的 Gradle Wrapper 使用腾讯镜像并固定官方 SHA-256；如需切换官方源，可修改
`gradle/wrapper/gradle-wrapper.properties`。

如果本机已有 Android Studio，直接用 Android Studio 打开本目录并等待 Gradle
同步即可。没有 Android Studio 时，可配置 `JAVA_HOME`、`ANDROID_HOME` 后执行：

```powershell
.\gradlew.bat :app:compileDebugKotlin :app:testDebugUnitTest
```

本轮不执行 `assembleDebug`，因此不会生成或交付 APK。

## 当前验证结果

- `:app:compileDebugKotlin`：通过；
- `:app:testDebugUnitTest`：通过，直播源解析与音乐目录共 4 项测试全部成功；
- `:app:lintDebug`：通过，无阻断错误；
- Gradle Wrapper 8.9：下载、SHA-256 校验和启动验证通过；
- 当前没有连接 Android TV 实机或电视模拟器，因此尚未完成原生画面截图与真机遥控器
  手感验证。

## 试用方式

本轮没有生成 APK，优先使用浏览器中的 `../nova-tv-preview` 评审首页视觉和遥控器
操作。Android 原生工程用于下一步在 Android Studio、电视盒子或模拟器中继续调试。

原生影视播放使用 W3C 公开授权 MP4 测试片源，直播播放使用公开 HLS 测试信号。
条目名称仅用于界面演示，测试片源不代表对应正片或真实频道。替换播放地址时修改
`DemoCatalog.kt` 与 `LiveScreen.kt` 中的演示源配置即可。

原生操作约定：

- 方向键：移动焦点；
- Enter / OK：确认；
- Back：关闭弹层或返回上一层；
- 搜索框：Enter 打开第一条结果，方向键下移进入结果区。

## 素材说明

演示图片仅用于 UI 评审，正式发布前必须替换为有明确授权的素材。来源和演示音轨
说明见 `ASSET_CREDITS.md`。
