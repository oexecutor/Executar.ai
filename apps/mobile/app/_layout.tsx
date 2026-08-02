import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

function Navigator() {
  const { claims, loading } = useAuth();
  if (loading) return null;
  return <Stack screenOptions={{ headerTintColor: '#0A0A0A', headerTitle: 'Executa.ai', headerBackTitle: 'Voltar' }}><Stack.Protected guard={Boolean(claims)}><Stack.Screen name="(app)" options={{ headerShown: false }} /><Stack.Screen name="qr" options={{ title: 'Ler QR' }} /><Stack.Screen name="confirm/[token]" options={{ title: 'Confirmar QR' }} /></Stack.Protected><Stack.Protected guard={!claims}><Stack.Screen name="sign-in" options={{ headerShown: false }} /></Stack.Protected></Stack>;
}

export default function RootLayout() { return <AuthProvider><Navigator /><StatusBar style="dark" /></AuthProvider>; }
