import crypto from "node:crypto";
import type { ProjectArea, ProjectDoc, ProjectItem } from "./types.js";

const AREA_BLUEPRINTS = [
  ["Contexto e direção", "Direção", ["Definir resultado", "Mapear contexto", "Alinhar responsáveis"]],
  ["Pesquisa e evidências", "Evidências", ["Reunir fatos", "Testar premissas", "Registrar decisões"]],
  ["Escopo e plano", "Plano", ["Delimitar escopo", "Ordenar entregas", "Planejar capacidade"]],
  ["Arquitetura da solução", "Arquitetura", ["Desenhar solução", "Definir contratos", "Preparar fundação"]],
  ["Construção principal", "Construção", ["Construir núcleo", "Integrar componentes", "Documentar operação"]],
  ["Validação", "Validação", ["Testar qualidade", "Corrigir lacunas", "Validar aceite"]],
  ["Preparação operacional", "Operação", ["Preparar suporte", "Treinar responsáveis", "Ensaiar operação"]],
  ["Lançamento", "Lançamento", ["Preparar comunicação", "Executar publicação", "Acompanhar adoção"]],
  ["Evolução e encerramento", "Evolução", ["Medir resultado", "Consolidar aprendizados", "Definir próximo ciclo"]],
] as const;

function task(itemNumber: number, title: string, objective: string): ProjectItem {
  const id = `T${String(itemNumber).padStart(2, "0")}`;
  return {
    id,
    type: "task",
    title,
    owner: "Responsável do projeto",
    evidence: `Evidência verificável de “${title}”`,
    actions: [
      { id: `${id}.1`, title: "Preparar", stop_condition: `Contexto, entradas e critério de aceite de “${title}” estão definidos.` },
      { id: `${id}.2`, title: "Executar", stop_condition: `O resultado de “${title}” foi produzido para o objetivo: ${objective}.` },
      { id: `${id}.3`, title: "Evidenciar", stop_condition: `A evidência foi anexada e revisada por uma pessoa responsável.` },
    ],
  };
}
export function buildCanonicalProject(input: {
  name: string;
  description: string;
  owner?: string;
}): ProjectDoc {
  const areas: ProjectArea[] = AREA_BLUEPRINTS.map(([title, shortTitle, tasks], areaIndex) => {
    const checkpointNumber = areaIndex * 4 + 1;
    const checkpointId = `T${String(checkpointNumber).padStart(2, "0")}`;
    const taskItems = tasks.map((taskTitle, index) => task(checkpointNumber + index + 1, taskTitle, input.description));
    return {
      id: `A${String(areaIndex + 1).padStart(2, "0")}`,
      title,
      short_title: shortTitle,
      items: [
        {
          id: checkpointId,
          type: "checkpoint",
          title: `Validar ${title.toLowerCase()}`,
          owner: input.owner || "Responsável do projeto",
          evidence: `As três tarefas de ${title.toLowerCase()} foram concluídas e aprovadas.`,
          predecessors: taskItems.map((item) => item.id),
        },
        ...taskItems,
      ],
    };
  });
  const now = new Date().toISOString();
  return {
    meta: {
      id: `PRJ-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      name: input.name.trim(),
      description: input.description.trim(),
      owner: input.owner?.trim() || "Responsável do projeto",
      created_at: now,
      updated_at: now,
    },
    phases: [
      { id: "F1", title: "Clareza e fundação", areas: ["A01", "A02", "A03"] },
      { id: "F2", title: "Construção e validação", areas: ["A04", "A05", "A06"] },
      { id: "F3", title: "Operação e lançamento", areas: ["A07", "A08", "A09"] },
    ],
    areas,
    final_deliverables: [
      { id: "D01", title: "Fundação aprovada", description: "Direção, evidências e plano consolidados.", linked_areas: ["A01", "A02", "A03"] },
      { id: "D02", title: "Solução validada", description: "Arquitetura e construção aprovadas por testes.", linked_areas: ["A04", "A05", "A06"] },
      { id: "D03", title: "Lançamento operável", description: "Operação, lançamento e evolução documentados.", linked_areas: ["A07", "A08", "A09"] },
    ],
  };
}
