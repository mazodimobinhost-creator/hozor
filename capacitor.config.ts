import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'ir.hozor.attendance',
  appName: 'حضور و غیاب من',
  // مسیر بستهٔ وب؛ برای APK از dist-native (ساخته‌شده با base=/) استفاده می‌شود
  webDir: process.env.CAP_WEB_DIR || 'dist',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#f4f6f9',
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: '#0f9b8e',
      showSpinner: false,
    },
  },
}

export default config
