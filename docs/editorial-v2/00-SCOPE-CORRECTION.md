# EXECUTA.AI Blog Integration V2 — Correção de Escopo

Status: **E0 — EM EXECUÇÃO**  
Epic: [#23](https://github.com/oexecutor/Executar.ai/issues/23)

## 1. Decisão

A trilha principal do produto é a automação editorial físico-digital:

```text
entrada editorial
→ tratamento e validação
→ artigo versionado
→ GitHub PR
→ Vercel Preview
→ aprovação humana
→ publicação no EXECUTA Journal
→ QR semântico
→ impressão
→ analytics e histórico
```

O motor de projetos 3–9–36 permanece disponível como infraestrutura auxiliar. Ele não é o modelo de domínio da publicação editorial e não deve orientar os gates desta iniciativa.

## 2. Produto

A EXECUTA.AI Blog Integration V2 transforma um briefing enviado por Leonardo, GPT, formulário ou MCP em uma publicação rastreável, revisável e publicável.

### Resultado esperado

Cada publicação deve possuir:

- identidade própria e slug estável;
- conteúdo e metadados editoriais;
- checklist de qualidade;
- branch e pull request;
- preview imutável da Vercel;
- decisão humana de aprovação;
- URL pública do artigo;
- quatro destinos de QR semântico;
- versão imprimível do painel;
- histórico de eventos e métricas.

## 3. Dependências e responsabilidades

| Componente | Responsabilidade |
|---|---|
| Executar MCP nativo | entrada e operações editoriais autorizadas |
| Desk&Go Business | seleção de formato, canal, densidade e estilo |
| Frankwatching Editor | estrutura editorial, critérios de qualidade e validação |
| AMES | contratos multiformato, adaptação, impressão e empacotamento |
| Identidade visual DESK-OS | tokens e aplicação visual transversal |
| GitHub | versionamento, branch, PR, revisão e auditoria |
| Vercel | preview e publicação do EXECUTA Journal |
| QR Router | resolução estável dos destinos QR-01 a QR-04 |
| Vault | artefatos, briefing, evidências e histórico editorial |

O pacote AMES permanece uma dependência de especificação/skill. Seu conteúdo não deve ser copiado indiscriminadamente para o runtime do aplicativo.

## 4. Fluxo operacional canônico

### Etapa A — Intake

1. receber briefing mínimo;
2. validar campos obrigatórios;
3. registrar autor, objetivo, audiência, formato e fontes;
4. gerar `publicationId` e slug candidato.

### Etapa B — Produção editorial

1. Desk&Go define formato e canal;
2. Frankwatching Editor organiza estrutura e critérios;
3. identidade visual e AMES adaptam as saídas;
4. o sistema produz um pacote editorial validável.

### Etapa C — Preview

1. criar branch dedicada;
2. gravar artigo e metadados;
3. abrir pull request;
4. aguardar Vercel Preview;
5. registrar a URL imutável no objeto da publicação.

### Etapa D — Aprovação

1. Leonardo revisa o preview;
2. decisão registrada como `APPROVED` ou `CHANGES_REQUESTED`;
3. merge só ocorre após autorização explícita;
4. rollback permanece disponível pelo histórico Git/Vercel.

### Etapa E — QR e impressão

1. gerar quatro tokens semânticos;
2. resolver tokens por router estável;
3. montar painel A4 com safe areas;
4. validar leitura dos QRs em celular real;
5. exportar versão P-1 para impressão de escritório.

## 5. QR Codes semânticos

| Código | Ação | Destino lógico |
|---|---|---|
| QR-01 | Criar/Processar | intake da publicação ou execução MCP autorizada |
| QR-02 | Revisar Preview | preview imutável da publicação |
| QR-03 | Aprovar/Publicar | tela de revisão e ação de aprovação |
| QR-04 | Medir | analytics e histórico da publicação |

### Regra obrigatória

O conteúdo impresso nunca aponta diretamente para uma URL efêmera. O QR contém um token estável, resolvido pelo router para o destino atual.

## 6. Estados do ciclo

```text
DRAFT
→ VALIDATING
→ READY_FOR_PREVIEW
→ PREVIEW_BUILDING
→ PREVIEW_READY
→ IN_REVIEW
→ CHANGES_REQUESTED | APPROVED
→ PUBLISHING
→ PUBLISHED
→ ARCHIVED
```

Estados de falha devem ser explícitos e recuperáveis:

```text
VALIDATION_FAILED
PREVIEW_FAILED
PUBLISH_FAILED
QR_FAILED
```

## 7. Gates editoriais

| Gate | Entrega | Situação |
|---|---|---|
| E0 | contrato, arquitetura e separação de domínio | EM EXECUÇÃO |
| E1 | intake e pacote editorial | NÃO INICIADO |
| E2 | branch, PR e Vercel Preview | NÃO INICIADO |
| E3 | aprovação, merge e publicação | NÃO INICIADO |
| E4 | QR Router semântico | NÃO INICIADO |
| E5 | painel e impressão | NÃO INICIADO |
| E6 | analytics e operação | NÃO INICIADO |

## 8. Primeiro vertical slice

O primeiro incremento funcional deve provar:

```text
briefing mínimo
→ objeto EditorialPublication válido
→ artigo versionado
→ branch e PR
→ preview Vercel registrado
→ revisão humana
```

Não faz parte deste primeiro incremento:

- publicação automática;
- geração LLM monolítica dentro do backend;
- impressão final;
- analytics completo;
- substituição do domínio editorial pelo 3–9–36.

## 9. Critério de encerramento do E0

E0 pode avançar quando:

- o contrato `EditorialPublication` estiver versionado;
- os estados e transições estiverem definidos;
- AMES, Desk&Go e Frankwatching estiverem mapeados sem acoplamento indevido;
- os quatro QRs tiverem semântica e destino lógico definidos;
- o vertical slice de E1/E2 possuir tarefas implementáveis e testes de aceite;
- a documentação de release não promover mais o 3–9–36 como próxima fase principal desta iniciativa.
