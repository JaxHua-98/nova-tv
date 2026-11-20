# NOVA TV · 一键重建 APK
# 用法：powershell -ExecutionPolicy Bypass -File build.ps1
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$app  = Join-Path $root "app"
$build = Join-Path $root "build"
$dist  = Join-Path $root "dist"
$sdk  = "C:\Users\win\AppData\Local\Android\Sdk"
$bt   = Join-Path $sdk "build-tools\34.0.0"
$plat = Join-Path $sdk "platforms\android-34\android.jar"
$jdk  = "C:\Users\win\AppData\Local\Android\jdk17\jdk-17.0.21.0.2+1"

$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$bt;$env:PATH"

New-Item -ItemType Directory -Force $build, $dist, "$build\gen", "$build\classes" | Out-Null
Remove-Item "$build\*" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force "$build\gen", "$build\classes" | Out-Null

# 从 ../web 同步前端资源
$webSrc = Join-Path (Split-Path -Parent $root) "web"
$wwwDst = Join-Path $app "assets\www"
if (Test-Path $webSrc) {
  New-Item -ItemType Directory -Force $wwwDst | Out-Null
  Copy-Item "$webSrc\*" $wwwDst -Recurse -Force
  Write-Host "[0/6] 已同步 web -> assets/www"
}

Write-Host "[1/6] aapt2 compile"
& "$bt\aapt2.exe" compile --dir "$app\res" -o "$build\res.zip"

Write-Host "[2/6] aapt2 link"
& "$bt\aapt2.exe" link -o "$build\base.apk" -I $plat `
  --manifest "$app\AndroidManifest.xml" -R "$build\res.zip" -A "$app\assets" `
  --java "$build\gen" --min-sdk-version 21 --target-sdk-version 34 `
  --version-code 1 --version-name 1.0 --auto-add-overlay

Write-Host "[3/6] javac"
$srcs = @(Get-ChildItem "$app\java" -Recurse -Filter *.java | ForEach-Object { $_.FullName })
$srcs += Get-ChildItem "$build\gen" -Recurse -Filter *.java | ForEach-Object { $_.FullName }
& "$jdk\bin\javac.exe" -encoding UTF-8 -nowarn -source 8 -target 8 `
  -bootclasspath $plat -classpath $plat -d "$build\classes" $srcs

Write-Host "[4/6] d8"
$classes = Get-ChildItem "$build\classes" -Recurse -Filter *.class | ForEach-Object { $_.FullName }
& "$bt\d8.bat" --lib $plat --min-api 21 --output $build $classes

Write-Host "[5/6] 注入 classes.dex"
python -c @"
import zipfile, os
b = r'$build'
src, out, dex = os.path.join(b,'base.apk'), os.path.join(b,'unsigned.apk'), os.path.join(b,'classes.dex')
zin = zipfile.ZipFile(src); zout = zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED)
for it in zin.infolist(): zout.writestr(it, zin.read(it.filename))
zout.write(dex,'classes.dex'); zout.close(); zin.close()
print('dex ok')
"@
& "$bt\zipalign.exe" -f 4 "$build\unsigned.apk" "$build\aligned.apk"

Write-Host "[6/6] 签名"
if (-not (Test-Path "$root\debug.keystore")) {
  & "$jdk\bin\keytool.exe" -genkeypair -keystore "$root\debug.keystore" -alias nova `
    -keyalg RSA -keysize 2048 -validity 10000 `
    -storepass novatv -keypass novatv -dname "CN=NOVA TV"
}
& "$bt\apksigner.bat" sign --ks "$root\debug.keystore" --ks-pass pass:novatv `
  --key-pass pass:novatv --ks-key-alias nova --out "$dist\nova-tv.apk" "$build\aligned.apk"
& "$bt\apksigner.bat" verify "$dist\nova-tv.apk"

$size = (Get-Item "$dist\nova-tv.apk").Length / 1MB
Write-Host ("Done: " + $dist + "\nova-tv.apk  (" + [math]::Round($size,2) + " MB)")
