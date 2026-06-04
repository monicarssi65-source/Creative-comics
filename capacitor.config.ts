import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.comiclab.app',
  appName: 'Comic Lab AI',
  webDir: 'dist',
  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },
  server: {
    // In produzione APK usa i file locali (no server remoto)
    androidScheme: 'https',
  },
  plugins: {
    // StatusBar dark per tema scuro dell'app
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#090d16',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#090d16',
      showSpinner: false,
    },
  },
};

export default config;
