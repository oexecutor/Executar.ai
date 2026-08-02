import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { extractQrToken } from '@executa/qr-core';
import { Screen, Muted, Button } from '@/components/ui';

export default function QrScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission) return <Screen><Muted>Carregando câmera…</Muted></Screen>;
  if (!permission.granted) {
    return <Screen><Muted>A câmera é necessária para ler o QR.</Muted><Button onPress={() => void requestPermission()}>Permitir câmera</Button></Screen>;
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={locked ? undefined : ({ data }) => {
          setLocked(true);
          const token = extractQrToken(data);
          if (!token) {
            Alert.alert('QR inválido', 'O código não pertence ao Executa.ai.');
            setLocked(false);
            return;
          }
          router.replace(`/confirm/${encodeURIComponent(token)}`);
        }}
      />
      <Text style={{ position: 'absolute', bottom: 48, left: 20, right: 20, color: 'white', textAlign: 'center', fontWeight: '700' }}>
        Aponte para o QR. Nenhuma ação será aplicada até você revisar e confirmar.
      </Text>
    </View>
  );
}
