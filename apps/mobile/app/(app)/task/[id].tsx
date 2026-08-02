import { useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CurrentPosition } from '@executa/domain';
import { api } from '@/lib/api';
import { enqueue } from '@/lib/offline-queue';
import { useConnectivity } from '@/hooks/use-connectivity';
import { Screen, Title, Muted, Card, Button, styles } from '@/components/ui';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const online = useConnectivity(); const [position, setPosition] = useState<CurrentPosition | null>(null);
  async function load() { if (!id) return; const projects = await api.listProjects(); for (const project of projects.projects) { const candidate = await api.getPosition(project.id); if (candidate.task?.id === id) { setPosition(candidate); return; } } }
  useEffect(() => { void load().catch((e) => Alert.alert('Tarefa indisponível', e.message)); }, [id]);
  const task = position?.task;
  async function complete(positionNumber: 1 | 2 | 3) { if (!task) return; const key = crypto.randomUUID(); if (online === false) { await enqueue({ id: key, type: 'COMPLETE_STEP', payload: { taskId: task.id, position: positionNumber, idempotencyKey: key }, createdAt: new Date().toISOString() }); Alert.alert('Salvo offline', 'O passo será enviado quando a sincronização estiver ativa.'); return; } await api.completeStep(task.id, positionNumber, key); await load(); }
  if (!task) return <Screen><Muted>Carregando tarefa…</Muted></Screen>;
  return <Screen><Title>{task.title}</Title><Muted>{task.reference} · {task.status}</Muted>{task.steps.map((step) => <Card key={step.id}><View style={styles.row}><Text style={styles.badge}>{step.position}</Text><Text style={[styles.grow, { fontWeight: '700' }]}>{step.title}</Text></View>{step.isDone ? <Muted>Concluído</Muted> : <Button onPress={() => void complete(step.position)}>Concluir passo</Button>}</Card>)}<Button secondary onPress={() => router.push(`/(app)/evidence/${task.id}`)}>Registrar evidência</Button></Screen>;
}
