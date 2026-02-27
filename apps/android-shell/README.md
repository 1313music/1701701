# Android Shell (Capacitor)

该目录用于生成安卓壳应用，不影响现有网页工程。

默认模式为远程加载：`https://1701701.xyz`。
这意味着网站更新后，APP 打开即看到最新内容，无需重新发 APK（除非你修改壳配置或原生能力）。

## 常用命令（在项目根目录执行）

```bash
npm run android:init
npm run android:signing:init
npm run android:sync
npm run android:open
npm run android:apk:debug
npm run android:apk:release
```

## APK 输出路径

- Debug: `apps/android-shell/android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `apps/android-shell/android/app/build/outputs/apk/release/app-release.apk`

## Release 签名

`npm run android:signing:init` 会自动生成：

- `apps/android-shell/android/keystore/release.keystore`
- `apps/android-shell/android/signing.properties`

这两个文件默认不会进入 Git。
