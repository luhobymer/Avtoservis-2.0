# Збірка APK (release)

## Передумови
- Windows
- Java: C:\Java\temurin-17\jdk-17.0.18+8
- Android SDK: E:\Avtoservis 2.1\android-sdk

## Разові підготовки
9) Встановити npm-залежності
10→   - Перейти в E:\Avtoservis 2.1\mobile
11→   - Запустити: `npm install`
12→   - Якщо npm лається на peer-deps (ERESOLVE) — запустити:
13→     - `npm install --legacy-peer-deps --no-audit --no-fund`

2) Переконатися, що CMake доступний
   - Має існувати E:\Avtoservis 2.1\android-sdk\cmake\3.22.1\bin\cmake.exe
   - Якщо відсутній, встановити через sdkmanager:
     - E:\Avtoservis 2.1\android-sdk\cmdline-tools\latest\bin\sdkmanager.bat --sdk_root=E:\Avtoservis 2.1\android-sdk "cmake;3.22.1"

3) Встановити VC++ Redistributable (x64 та x86)
   - https://aka.ms/vs/17/release/vc_redist.x64.exe
   - https://aka.ms/vs/17/release/vc_redist.x86.exe

4) Перевірити local.properties
   - Файл: E:\Avtoservis 2.1\mobile\android\local.properties
   - Має містити:
     - sdk.dir=E:\\Avtoservis 2.1\\android-sdk
     - cmake.dir=E:\\Avtoservis 2.1\\android-sdk\\cmake\\3.22.1

## Важливі налаштування
- Gradle памʼять: E:\Avtoservis 2.1\mobile\android\gradle.properties
  - org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=768m

- Metro конфіг:
  - E:\Avtoservis 2.1\mobile\metro.config.js
  - config.watcher.useWatchman = false

## API адреса
- Файл: E:\Avtoservis 2.1\mobile\app.json
- Поле: extra.API_BASE_URL
- Для Render:
  - https://avtoservis-server.onrender.com
- Для локального сервера в одній Wi‑Fi мережі:
  - http://192.168.1.10:5001

## Команди збірки
1) Перейти в E:\Avtoservis 2.1\mobile\android
2) Запустити в PowerShell:
   - $env:CI='true'
   - $env:JAVA_HOME="C:\Java\temurin-17\jdk-17.0.18+8"
   - $env:ANDROID_HOME="E:\Avtoservis 2.1\android-sdk"
   - $env:ANDROID_SDK_ROOT="E:\Avtoservis 2.1\android-sdk"
   - .\gradlew.bat assembleRelease --no-daemon --console=plain

## Збір логів крашу (release)
1) Підключити телефон по USB і дозволити налагодження
2) Перейти в E:\Avtoservis 2.1\android-sdk\platform-tools
3) Запустити:
   - .\adb.exe devices -l
   - .\adb.exe logcat -c
   - .\adb.exe logcat -s AndroidRuntime ReactNativeJS *:E

## Вихідний файл
- E:\Avtoservis 2.1\mobile\android\app\build\outputs\apk\release\app-release.apk

## Примітка по OCR
- OCR/авторозпізнавання номера тимчасово вимкнено до стабілізації базового функціоналу.
- Поточний режим: просте додавання фото та ручне внесення даних авто.

## Типові проблеми
- Якщо Metro/Gradle падає з помилкою на `react-native/index.js` типу
  `Missing semicolon` біля `} as ReactNativePublicAPI;`:
  - Перевірити, що у `E:\Avtoservis 2.1\mobile\package.json` в `devDependencies`
    стоїть `"@babel/core": "^7.27.6"`
  - Перезапустити `npm install` у теці `mobile` і повторити збірку
