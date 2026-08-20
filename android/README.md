# SautiLink Cloud Engine for Android

Official Android Trusted Web Activity for `https://cloudengine.sautilink.com`.

## Identity

- App name: SautiLink Cloud Engine
- Application ID: `com.sautilink.cloudengine`
- Developer: SautiLink Corporation
- Minimum Android: Android 8.0 (API 26)
- Target Android: Android 16 (API 36)

## Build locally

Use JDK 17 and Android SDK Platform 36:

```bash
cd android
./gradlew assembleDebug bundleRelease
```

The debug APK is written to `app/build/outputs/apk/debug/`. Without signing
environment variables, the release AAB is intentionally unsigned.

## Release signing

Never commit a keystore or password. Configure these GitHub Actions secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The workflow decodes the keystore only inside the temporary build runner. The
Gradle project reads the resulting values through environment variables.

## Digital Asset Links

After enrolling in Play App Signing, copy the SHA-256 fingerprint from Play
Console and replace the placeholder in `assetlinks.template.json`. Publish the
completed file as `public/.well-known/assetlinks.json`. The fingerprint must be
the **App signing key certificate**, not merely the upload key certificate.

The public endpoint must return HTTP 200, JSON content, and no redirect:

`https://cloudengine.sautilink.com/.well-known/assetlinks.json`

## Store artifacts

- Google Play: signed `app-release.aab`
- Device testing and compatible third-party stores: `app-debug.apk` for testing,
  then a release-signed APK generated from the same permanent signing identity
- Privacy policy: `https://cloudengine.sautilink.com/privacy`
- Support: `https://cloudengine.sautilink.com/faq`
