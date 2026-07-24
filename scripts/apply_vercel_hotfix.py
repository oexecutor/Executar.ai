#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import shutil
import sys

ROOT = Path.cwd()
PACKAGE_ROOT = Path(__file__).resolve().parents[1]
ADAPTER_SOURCE = PACKAGE_ROOT / "src/lib/vercel-node-adapter.ts"
ADAPTER_TARGET = ROOT / "src/lib/vercel-node-adapter.ts"


def install_adapter() -> None:
    ADAPTER_TARGET.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ADAPTER_SOURCE, ADAPTER_TARGET)


def patch_handler(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "createVercelNodeHandler" in text:
        return False

    original = text
    handler_name: str | None = None

    named = re.search(
        r"export\s+default\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(",
        text,
    )
    if named:
        handler_name = named.group(1)
        tail = text[named.start():]
        tail = re.sub(r"^export\s+default\s+", "", tail, count=1)
        text = text[:named.start()] + tail
    else:
        anonymous = re.search(
            r"export\s+default\s+(async\s+)?function\s*\(",
            text,
        )
        if anonymous:
            handler_name = "__webHandler"
            async_kw = anonymous.group(1) or ""
            replacement = f"const {handler_name} = {async_kw}function("
            text = text[:anonymous.start()] + replacement + text[anonymous.end():]
            text = text.rstrip() + ";\n"
        else:
            identifier = re.search(
                r"export\s+default\s+([A-Za-z_$][\w$]*)\s*;",
                text,
            )
            if identifier:
                handler_name = identifier.group(1)
                text = text[:identifier.start()] + text[identifier.end():]

    if not handler_name:
        print(f"WARN: export default não reconhecido em {path}", file=sys.stderr)
        return False

    import_line = (
        'import { createVercelNodeHandler } '
        'from "../src/lib/vercel-node-adapter";\n'
    )
    text = import_line + text.lstrip()
    text = (
        text.rstrip()
        + f"\n\nexport default createVercelNodeHandler({handler_name});\n"
    )

    if text == original:
        return False

    path.write_text(text, encoding="utf-8")
    return True


def patch_api_handlers() -> list[str]:
    api_dir = ROOT / "api"
    if not api_dir.exists():
        raise RuntimeError("Diretório api/ não encontrado.")

    patched: list[str] = []
    for path in sorted(api_dir.glob("*.ts")):
        if path.name.startswith("_"):
            continue
        if patch_handler(path):
            patched.append(str(path.relative_to(ROOT)))

    if not patched and not any(
        "createVercelNodeHandler" in p.read_text(encoding="utf-8")
        for p in api_dir.glob("*.ts")
        if not p.name.startswith("_")
    ):
        raise RuntimeError("Nenhum handler api/*.ts pôde ser adaptado.")

    return patched


def patch_landing() -> list[str]:
    patched: list[str] = []

    for path in ROOT.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        if any(part in {"node_modules", "dist", ".git"} for part in path.parts):
            continue

        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue

        if (
            "Começar a executar" not in text
            and "Acessar workspace" not in text
            and "landing-nav-actions" not in text
        ):
            continue

        changed = (
            text.replace('"/entrar"', '"/app"')
            .replace("'/entrar'", "'/app'")
            .replace("`/entrar`", "`/app`")
        )

        if changed != text:
            path.write_text(changed, encoding="utf-8")
            patched.append(str(path.relative_to(ROOT)))

    return patched


def main() -> int:
    install_adapter()
    handlers = patch_api_handlers()
    landing = patch_landing()

    print("Adapter instalado: src/lib/vercel-node-adapter.ts")
    print("Handlers adaptados:")
    for item in handlers:
        print(f"- {item}")

    print("Arquivos da landing ajustados:")
    if landing:
        for item in landing:
            print(f"- {item}")
    else:
        print("- nenhum localizado; verifique manualmente os links /entrar")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
