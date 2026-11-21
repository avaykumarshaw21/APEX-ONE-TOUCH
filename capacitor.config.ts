import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.apexracing.onetouch',
  appName: 'Apex 1-Touch Racing',
  webDir: 'dist',
  backgroundColor: '#090a0f',
  server: {
    androidScheme: 'https',
    iosScheme: 'capacitor',
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#090a0f',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#090a0f',
  },
};

export default config;
