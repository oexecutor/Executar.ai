import { describe, expect, it } from "vitest";
import { buildProjectFromAiOutline, type AiProjectOutline } from "./ai-generator.js";
import { validateProject } from "./schema.js";

function outline(): AiProjectOutline {
  return {
    name: "Lançar consultoria de operações com IA",
    description: "Estruturar a oferta, validar clientes e publicar uma primeira versão comercial operável.",
    owner: "Leonardo",
    phases: ["Definir direção", "Construir e validar", "Lançar e aprender"],
    areas: Array.from({ length: 9 }, (_, areaIndex) => ({
      title: `Área específica ${areaIndex + 1}`,
      short_title: `Área ${areaIndex + 1}`,
      tasks: Array.from({ length: 3 }, (_, taskIndex) => ({
        title: `Executar tarefa ${areaIndex + 1}.${taskIndex + 1}`,
        evidence: `Evidência verificável da tarefa ${areaIndex + 1}.${taskIndex + 1}.`,
      })),
    })),
    deliverables: [
      { title: "Fundação aprovada", description: "Direção, público e oferta documentados." },
      { title: "Solução validada", description: "Fluxo testado com evidências reais." },
      { title: "Lançamento operável", description: "Oferta publicada e ciclo de aprendizado ativo." },
    ],
  };
}

describe("buildProjectFromAiOutline", () => {
  it("normaliza a saída da IA no contrato canônico", () => {
    const project = buildProjectFromAiOutline(outline());
    const validation = validateProject(project);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(project.phases).toHaveLength(3);
    expect(project.areas).toHaveLength(9);
    expect(project.areas.flatMap((area) => area.items)).toHaveLength(36);
    expect(project.areas.flatMap((area) => area.items.flatMap((item) => item.actions ?? []))).toHaveLength(81);
    expect(project.final_deliverables).toHaveLength(3);
  });

  it("recusa quantidade incorreta de áreas", () => {
    const invalid = outline();
    invalid.areas = invalid.areas.slice(0, 8);
    expect(() => buildProjectFromAiOutline(invalid)).toThrow(/3–9–36/);
  });
});
