import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { CurrentPosition } from '@executa/domain';
import { api } from '@/lib/api';
import { Screen, Title, Muted, Card, styles } from '@/components/ui';

export default function PositionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const [position, setPosition] = useState<CurrentPosition | null>(null);
  useEffect(() => { if (!id) return; api.getPosition(id).then(setPosition).catch((error) => Alert.alert('Posição indisponível', error.message)); }, [id]);
  if (!position) return <Screen><Muted>Carregando posição atual…</Muted></Screen>;
  return <Screen><Title>{position.project.name}</Title><Muted>{position.completedTasks}/{position.totalTasks} tarefas · {position.progressPercent}%</Muted>{position.task ? <Pressable onPress={() => router.push(`/(app)/task/${position.task!.id}`)}><Card><Text style={styles.badge}>PRÓXIMA AÇÃO</Text><Text style={{ fontSize: 20, fontWeight: '800' }}>{position.task.title}</Text><Muted>{position.task.reference} · {position.task.status}</Muted>{position.task.steps.map((step) => <View key={step.id} style={styles.row}><Text style={styles.badge}>{step.position}</Text><Text style={styles.grow}>{step.title}</Text><Text>{step.isDone ? '✓' : '○'}</Text></View>)}</Card></Pressable> : <Card><Text>Sem próxima tarefa.</Text></Card>}</Screen>;
}
