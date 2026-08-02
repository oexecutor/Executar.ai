import { useState } from 'react';
import { Alert, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { Screen, Title, Muted, Field, Button } from '@/components/ui';

export default function EvidenceScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>(); const [content, setContent] = useState(''); const [imageUri, setImageUri] = useState<string | null>(null);
  async function pick() { const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 }); if (!result.canceled) setImageUri(result.assets[0]?.uri ?? null); }
  async function save() { if (!taskId) return; try { await api.addEvidence(taskId, { kind: 'NOTE', title: 'Evidência móvel', content: imageUri ? `${content}\nArquivo local pendente de upload: ${imageUri}` : content }); Alert.alert('Registrado', 'A evidência foi associada à tarefa.'); router.back(); } catch (e) { Alert.alert('Falha', e instanceof Error ? e.message : 'Erro inesperado'); } }
  return <Screen><Title>Evidência</Title><Muted>Nesta fundação, a anotação é sincronizada; o upload binário será ativado no módulo Storage.</Muted><Field multiline placeholder="O que foi executado?" value={content} onChangeText={setContent} style={{ minHeight: 120 }} /><Button secondary onPress={() => void pick()}>Selecionar foto</Button>{imageUri && <Image source={{ uri: imageUri }} style={{ height: 220, borderRadius: 10 }} resizeMode="cover" />}<Button disabled={!content.trim() && !imageUri} onPress={() => void save()}>Salvar evidência</Button></Screen>;
}
