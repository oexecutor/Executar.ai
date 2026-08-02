import { useEffect, useState } from 'react';
import { Alert, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { QrResolution } from '@executa/domain';
import { api } from '@/lib/api';
import { Screen, Title, Muted, Card, Button } from '@/components/ui';

function idempotencyKey() {
  return `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ConfirmQrScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [record, setRecord] = useState<QrResolution | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.resolveQr(token)
      .then(setRecord)
      .catch((error) => Alert.alert('QR indisponível', error instanceof Error ? error.message : 'Erro inesperado'))
      .finally(() => setLoading(false));
  }, [token]);

  async function confirm() {
    if (!token || !record || record.status !== 'ACTIVE') return;
    setConfirming(true);
    try {
      await api.confirmQr(token, idempotencyKey());
      Alert.alert('Ação confirmada', 'A alteração foi registrada com auditoria.', [
        { text: 'OK', onPress: () => router.replace(record.projectId ? `/(app)/project/${record.projectId}` : '/(app)') }
      ]);
    } catch (error) {
      Alert.alert('Não confirmado', error instanceof Error ? error.message : 'Erro inesperado');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) return <Screen><Muted>Consultando QR…</Muted></Screen>;
  if (!record) return <Screen><Title>Código não encontrado</Title><Button secondary onPress={() => router.back()}>Voltar</Button></Screen>;

  const available = record.status === 'ACTIVE';
  return (
    <Screen>
      <Muted>QR SEMÂNTICO</Muted>
      <Title>Confirmar ação</Title>
      <Card>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>{record.taskTitle ?? 'Continuidade do projeto'}</Text>
        <Muted>{record.taskReference ?? record.projectId}</Muted>
        <Text>Status atual: {record.currentStatus ?? 'não aplicável'}</Text>
        <Text>Ação: {record.intent}</Text>
        <Text>Resultado: {record.targetStatus ?? 'abrir contexto sem alterar status'}</Text>
      </Card>
      <Card>
        <Text style={{ fontWeight: '800' }}>Confirmação obrigatória</Text>
        <Muted>O QR apenas trouxe o contexto. A ação só será executada após tocar no botão abaixo.</Muted>
      </Card>
      {!available && <Muted>Este código está {record.status.toLowerCase()} e não pode ser aplicado.</Muted>}
      <Button onPress={() => void confirm()} disabled={!available || confirming}>{confirming ? 'Confirmando…' : 'Confirmar ação'}</Button>
      <Button secondary onPress={() => router.back()}>Cancelar</Button>
    </Screen>
  );
}
