import { useState } from 'react';
import { Alert } from 'react-native';
import { Screen, Title, Muted, Field, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [loading, setLoading] = useState(false);
  async function act(mode: 'login' | 'signup') { setLoading(true); const result = mode === 'login' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split('@')[0] } } }); setLoading(false); if (result.error) Alert.alert('Não foi possível continuar', result.error.message); else if (mode === 'signup' && !result.data.session) Alert.alert('Confirme seu e-mail', 'A conta foi criada e aguarda confirmação.'); }
  return <Screen><Title>Executa.ai</Title><Muted>Seu projeto, sua posição atual e três passos por vez.</Muted><Field autoCapitalize="none" keyboardType="email-address" placeholder="E-mail" value={email} onChangeText={setEmail} /><Field secureTextEntry placeholder="Senha" value={password} onChangeText={setPassword} /><Button disabled={loading} onPress={() => void act('login')}>{loading ? 'Entrando…' : 'Entrar'}</Button><Button secondary disabled={loading} onPress={() => void act('signup')}>Criar conta</Button></Screen>;
}
