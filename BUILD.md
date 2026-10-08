# 构建 3.0

这个仓库包含独立发布所需的游戏资源与平台外壳。以下命令在仓库根目录执行，使用 Node.js 22 或更新版本。Windows 和安卓构建脚本针对 Windows 环境。

## 运行与校验

```powershell
npm ci
npm run verify
npm start
```

verify 校验全部运行资源的 SHA-256、动态商店图片、关卡和角色数量，并实际验证首次海啸对干地角色造成伤害。

## Windows

```powershell
npm run build:windows
```

产物位于 dist：NSIS 安装程序与完整免安装 ZIP。目前不包含 Authenticode 商业签名。程序使用隔离的本地协议、沙箱和关闭的 Node 页面权限。

可通过已打包程序的 --smoke-test 参数进行离线启动检查；设置 EIBON_QA_DIR 后会保存 windows-smoke.json。检查成功时进程退出码为 0。

## 安卓

安装 JDK 21、Android SDK Platform 35 与 Build Tools 35.0.0，然后设置以下变量。Windows 上 SDK 和构建临时目录需使用不含中文的路径。

```powershell
$env:JAVA_HOME='C:\Tools\jdk-21'
$env:ANDROID_HOME='C:\Tools\android-sdk'
$env:EIBON_ANDROID_BUILD_DIR='C:\Build\eibon-android'
$env:EIBON_SIGNING_DIR='C:\Private\eibon-signing'
npm run build:android
```

脚本编译离线 WebView 外壳，打包 game 内的资源，对 APK 进行对齐、签名和签名校验。最低 Android 9，目标 API 35，包名 site.zhisan.eibon，安卓外壳版本 3.0.1 / 30001；游戏内容与其他平台仍为 3.0。

NormalizeApk.java 将 Windows 资源路径转换为正斜杠，并以 ZIP STORED（方法 0）写入 resources.arsc，再执行 zipalign。不能用 .NET Framework 的 CompressionLevel.NoCompression 代替 STORED：它仍会产生 DEFLATED（方法 8）条目，导致 Android 11+ 拒绝安装。构建结束会检查签名 APK 内资源索引的真实压缩方法和 4 字节对齐、所有条目的 CRC 与 357 个运行文件的 SHA-256；失败则不输出发布包。

也可单独校验已打包文件：

```powershell
node tools/verify-android.mjs dist/Eibon-Tower-Defense-3.0.1-Android.apk
```

签名目录必须位于仓库之外。首次构建会创建私人密钥，后续升级必须保留并复用同一份密钥和 credentials.json。不要上传这些文件。不同密钥构建的 APK 无法覆盖安装原来的正式版本。

安卓构建还会将 33 个脚本和样式转换为 Chromium 80+ 可用的版本，补充 Array.at、replaceChildren、Canvas roundRect、容器尺寸与卡片比例兼容处理。game 目录保持原始 3.0 快照；APK 校验对这些文件计算转换后的预期哈希，其余素材直接与源清单比对。旧设备需更新系统 WebView 或 Chrome。

已在 Android 11 官方模拟器复现旧 APK 安装失败（错误 -124），确认修复包安装成功并完成启动、编队、进入战斗与触屏拖放部署；运行日志未出现脚本异常。同时完成签名、全部资源及浏览器触屏事件检查。尚未进行实体安卓设备安装测试。

## Wallpaper Engine

使用 FFmpeg 将菜单视频转换为本地 WebM：

```powershell
$env:EIBON_FFMPEG='C:\Tools\ffmpeg\bin\ffmpeg.exe'
npm run build:wallpaper
node tools/test-wallpaper-input.mjs
```

也可设置 EIBON_CACHED_WEBM 复用同一菜单视频的既有 WebM。输出目录 dist/wallpaper 可直接导入壁纸编辑器。

构建过程生成离线敌人头像，适配 file 协议、鼠标拖放与 Wallpaper Engine 暂停通知。输入测试包含部署、叠卡、撤回、失焦等 17 项场景。使用项目导入和 [官方工坊发布流程](https://docs.wallpaperengine.io/en/web/first/gettingstarted.html) 上传；不要把 project.json 的格式版本字段当作游戏版本号。

## 更新资源快照

game 为本次发行使用的完整快照，runtime-manifest.json 记录适配后的文件哈希。如从网站工程重新同步，可运行：

```powershell
node tools/sync-game.mjs C:\Source\website\public\eibon-tower-defense
npm run verify
```

同步脚本只收集运行时素材，排除素材参考、提示词和 QA 文件。它同时注入跨平台暂停适配；修改 game 后应重新生成清单，并重新构建平台产物。
