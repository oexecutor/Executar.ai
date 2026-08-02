import { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import type { ProjectSummary } from '@executa/domain';
import { api } from '@/lib/api';
import { Screen, Title, Muted, Card, Button, styles } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useConnectivity } from '@/hooks/use-connectivity';

export default function ProjectsScreen() {
  const { signOut } = useAuth(); const online = useConnectivity(); const [projects, setProjects] = useState<ProjectSummary[]>([]); const [loading, setLoading] = useState(true);
  const load = useCallback(async () => { try { setLoading(true); const result = await api.listProjects(); setProjects(result.projects); } catch (error) { Alert.alert('Projetos indisponíveis', error instanceof Error ? error.message : 'Erro inesperado'); } finally { setLoading(false); } }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return <Screen><View style={styles.row}><View style={styles.grow}><Title>Projetos</Title><Muted>{online === false ? 'Sem internet · alterações serão enfileiradas quando possível.' : 'Escolha sua posição atual.'}</Muted></View><Button secondary onPress={() => void signOut()}>Sair</Button></View>{loading && <Muted>Carregando…</Muted>}{projects.map((project) => <Pressable key={project.id} onPress={() => router.push(`/(app)/project/${project.id}`)}><Card><View style={styles.row}><Text style={[styles.grow, { fontSize: 18, fontWeight: '700' }]}>{project.name}</Text><Text style={styles.badge}>{project.status}</Text></View><Muted>{project.code}</Muted></Card></Pressable>)}{!loading && projects.length === 0 && <Card><Text>Nenhum projeto.</Text><Muted>Crie o primeiro pelo app web nesta etapa da fundação.</Muted></Card>}<Button secondary onPress={() => router.push('/qr')}>Ler QR de continuidade</Button></Screen>;
}
