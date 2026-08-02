import type { PropsWithChildren } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, typography } from '@executa/design-tokens';

export function Screen({ children }: PropsWithChildren) { return <SafeAreaView style={s.safe}><ScrollView contentContainerStyle={s.screen}>{children}</ScrollView></SafeAreaView>; }
export function Title({ children }: PropsWithChildren) { return <Text style={s.title}>{children}</Text>; }
export function Muted({ children }: PropsWithChildren) { return <Text style={s.muted}>{children}</Text>; }
export function Card({ children }: PropsWithChildren) { return <View style={s.card}>{children}</View>; }
export function Field(props: TextInputProps) { return <TextInput placeholderTextColor={colors.muted} {...props} style={[s.input, props.style]} />; }
export function Button({ children, onPress, disabled = false, secondary = false }: PropsWithChildren<{ onPress: () => void; disabled?: boolean; secondary?: boolean }>) { return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[s.button, secondary && s.secondary, disabled && s.disabled]}><Text style={[s.buttonText, secondary && s.secondaryText]}>{children}</Text></Pressable>; }
export const styles = s;

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  screen: { padding: spacing.lg, gap: spacing.md, minHeight: '100%' },
  title: { fontSize: typography.display, fontWeight: '800', letterSpacing: -1.2, color: colors.ink },
  muted: { fontSize: typography.small, color: colors.muted, lineHeight: 19 },
  card: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.paper },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, fontSize: typography.body, color: colors.ink },
  button: { borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.ink, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' },
  buttonText: { color: colors.inverse, fontSize: typography.body, fontWeight: '700' },
  secondary: { backgroundColor: colors.paper },
  secondaryText: { color: colors.ink },
  disabled: { opacity: .45 },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  badge: { borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, fontSize: 11, fontWeight: '700' }
});
