# Adaptação — Business Widget (container queries)

O widget responde ao **container**, não ao viewport (`container-type: inline-size`).

| Largura do container | Representação | Comportamento |
|---|---|---|
| >= 480px | métrica + mini-gráfico + comparação | full/compact |
| 280–479px | métrica + tendência | SUBSTITUTE (gráfico → sparkline) |
| < 280px | valor principal | REPRIORITIZE (oculta gráfico e detalhe) |

P1 (MET-nps) nunca oculto. Fonte preservada em tooltip. Fallback textual sempre presente.
