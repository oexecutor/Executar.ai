import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@executa/offline-queue/v1';
export interface QueuedCommand { id: string; type: 'COMPLETE_STEP' | 'ADD_EVIDENCE'; payload: Record<string, unknown>; createdAt: string; }

export async function enqueue(command: QueuedCommand) {
  const current = await readQueue();
  await AsyncStorage.setItem(KEY, JSON.stringify([...current, command]));
}
export async function readQueue(): Promise<QueuedCommand[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try { return JSON.parse(raw) as QueuedCommand[]; } catch { return []; }
}
export async function removeQueued(id: string) {
  const current = await readQueue();
  await AsyncStorage.setItem(KEY, JSON.stringify(current.filter((item) => item.id !== id)));
}
