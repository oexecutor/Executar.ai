# Fixtures

Casos para validar contra os schemas em `../../contracts/`:

- `content-block.valid.json` — deve VALIDAR contra `content-model.schema.json`.
- `content-block.invalid.json` — deve FALHAR (falta priority CT-001 e text_fallback CT-002).
- `skill-input.valid.yaml` — deve VALIDAR contra `skill-input.schema.json` (converter YAML→JSON).
- `skill-input.invalid.yaml` — deve FALHAR (mode/gate fora do enum, objective vazio — IN-001/IN-002).
- `skill-output.valid.yaml` — deve VALIDAR contra `skill-output.schema.json`.
