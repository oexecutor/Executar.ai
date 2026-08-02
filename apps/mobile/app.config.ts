import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Executa.ai',
  slug: 'executa-ai',
  scheme: 'executa',
  version: '0.2.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ai.executa.app'
  },
  android: {
    package: 'ai.executa.app',
    adaptiveIcon: { backgroundColor: '#FFFFFF' },
    permissions: ['CAMERA']
  },
  plugins: [
    'expo-router',
    ['expo-camera', { cameraPermission: 'Permitir que o Executa.ai leia QRs e registre evidências.' }],
    ['expo-image-picker', { photosPermission: 'Permitir que o Executa.ai selecione evidências visuais.' }]
  ],
  experiments: { typedRoutes: true },
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } }
});
