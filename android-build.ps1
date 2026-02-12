$projectRoot = "C:\Users\BMW\Desktop\Avtoservis 2.0"
$sdkRoot = Join-Path $projectRoot "android-sdk"
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:JAVA_HOME = "C:\Java\temurin-17\jdk-17.0.18+8"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
$env:GRADLE_OPTS = "-Dorg.gradle.internal.http.connectionTimeout=60000 -Dorg.gradle.internal.http.socketTimeout=60000"
$log = Join-Path $env:TEMP "gradle-build.log"
Set-Location (Join-Path $projectRoot "mobile\android")
& .\gradlew.bat assembleRelease --no-daemon --console=plain -Dkotlin.compiler.execution.strategy=in-process 2>&1 | Tee-Object -FilePath $log
Write-Output "LOG:$log"
