const LEGACY_JOURNAL_PROJECT_ID = "prj_SMaYVWIDqomDGV4hYYjtwQGMAabv";

if (process.env.VERCEL_PROJECT_ID === LEGACY_JOURNAL_PROJECT_ID) {
  console.log(
    "Build ignorado: executa-journal-preview é legado e redireciona para executar-ai.vercel.app.",
  );
  process.exit(0);
}

// Vercel interpreta exit 1 como “continuar o build”. Isso mantém o
// projeto canônico e qualquer execução local/CI funcionando normalmente.
process.exit(1);
