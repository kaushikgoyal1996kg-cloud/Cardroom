// Native wrapper for The Card Room. The web build remains the source of UI truth.
// Keep the default secure https://localhost origin: voice uses getUserMedia(),
// which requires a secure context. The backend CORS allow-list must include
// https://localhost for installed Android builds.
export default {
  appId: 'com.thecardroom.private',
  appName: 'The Card Room',
  webDir: 'dist',
  backgroundColor: '#0a0908',
  loggingBehavior: 'debug',
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0a0908',
    zoomEnabled: false,
  },
};
