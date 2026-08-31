import type { CapacitorConfig } from '@capacitor/cli';

// appId/appName are configurable via env vars (this is a template project —
// it may be reused as-is for other clients/sites), with defaults for the
// אדלה בשוק kitchen app.
const config: CapacitorConfig = {
  appId: process.env.APP_ID || 'com.adelabashuk.kitchen',
  appName: process.env.APP_NAME || 'אדלה בשוק — מטבח',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
