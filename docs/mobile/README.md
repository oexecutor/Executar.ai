# Executa.ai Mobile — fundação Expo

Esta pasta adiciona o aplicativo iOS/Android ao repositório canônico `P1.Executar.ai` sem substituir o backend Vercel ou o frontend Vite existentes.

## Arquitetura efetiva

```text
Expo / React Native
        ↓ HTTPS + JWT Supabase
/api/mobile/* na Vercel
        ↓ publishable key + JWT do usuário
Supabase Postgres + RLS + RPCs auditáveis
```

O aplicativo móvel nunca usa `service_role`, nunca acessa Prisma e não contém Capacitor.

## Executar localmente

```bash
cd apps/mobile
cp .env.example .env
npm install
npm run typecheck
npm test
npm start
```

## Gate de build

O workflow `.github/workflows/mobile-foundation.yml` executa instalação limpa, verificação do Expo, typecheck, testes e export web. O deploy atual da Vercel continua validando o backend e o frontend existentes.

## Próximos gates

1. Aprovar o preview Vercel da API móvel.
2. Criar o projeto EAS e preencher `EXPO_PUBLIC_EAS_PROJECT_ID`.
3. Gerar build `preview` Android.
4. Gerar build `preview` iOS/TestFlight.
5. Validar câmera, QR, evidência, offline e deep links em dispositivos reais.
