---
agente: claude
tipo: claude (Claude Code)
version: 2.1.296
modelo: Claude Sonnet 5.5 (claude-sonnet-5-5)
estado: completa
---

# Ficha de capacidades — claude (orquestador)

## Herramientas propias
- Leer, escribir y editar archivos (Read, Write, Edit, Glob, Grep).
- Terminal Bash (Git Bash) y PowerShell, con ejecución en segundo plano.
- Búsqueda web y lectura de URLs (WebSearch, WebFetch).
- Navegador Chrome controlado (claude-in-chrome), Canva, Figma, Vercel, Microsoft 365, Gmail/Calendar/Drive y otros conectores MCP.
- Preguntas estructuradas al usuario (AskUserQuestion), modo plan, cron y recordatorios.

## Subagentes y modo multi-agente
- Herramienta `Agent` con `subagent_type` (general-purpose, Explore, Plan, claude-code-guide, familia `gsd-*`, etc.) o `fork` (hereda mi contexto).
- Cada subagente corre en segundo plano y avisa al terminar; se continúa con `SendMessage`.
- Paralelismo: varias llamadas `Agent` en un mismo turno corren a la vez. No tengo un límite numérico documentado.
- Modelo por subagente: parámetro `model` (`sonnet`, `opus`, `haiku`, `fable`); un `fork` ignora el override y usa el mío.

## Modelos disponibles y cómo elegirlos
| Nivel | Modelo que usas | Cómo se selecciona (flag, comando o parámetro) |
|---|---|---|
| potente | Opus 5.5 (`claude-opus-5-5`) o Fable 5.1 (`claude-fable-5-1`) | `/model` o parámetro `model` del subagente |
| estándar | Sonnet 5.5 (`claude-sonnet-5-5`), el actual | `/model` o `model: "sonnet"` |
| ligero | Haiku 5.5 (`claude-haiku-5-5`) | `/model` o `model: "haiku"` |

## Comandos `/`
`/clear`, `/model`, `/fast`, `/loop`, `/schedule`, `/code-review`, `/init`, `/security-review`, y los skills instalados (`/team-bootstrap`, `/team-resume`, `/gsd-*`, `/superpowers:*`, entre otros).

## Skills
Carpeta de usuario `C:\Users\jcgm1\.claude\skills\` más los skills de plugins (superpowers, gsd, ui-ux-pro-max, small-business, sales, finance, etc.). Se invocan con la herramienta `Skill`.

## Plugins y MCP
- Engram: SÍ (servidor MCP `engram`).
- Otros: claude-in-chrome, Canva, Figma, Vercel, Microsoft 365, Gmail, Google Calendar, Google Drive, Shopify, TestSprite, pdf-viewer, Claude Docs.
- `claude.ai n8n` falló al conectar en esta sesión.

## Límites
- Soy el orquestador: no elijo el stack ni escribo el código del producto (eso es del ejecutor).
- No respondo diálogos de aprobación de otros agentes ni cierro panes que no creé.
- Los comandos Bash en Git Bash necesitan cuidado con rutas de Windows y el escapado de backslashes.

## Cómo prefiero recibir trabajo
Handoff en markdown en `brain\Handoffs\` con: objetivo, rutas absolutas, criterio de terminado verificable (comando que debe pasar), restricciones y qué devolver.

## Verificación del orquestador

| Dato | Declarado | Verificado (✅ / ⚠ / ❌) |
|---|---|---|
| Versión | 2.1.296 | ✅ `claude --version` |
| Detección en Herdr | claude, pane w2:pZ | ✅ `herdr agent list`; hooks `current` (v8) |
| Engram | Sí | ✅ ENGRAM_DATA_DIR = ...\Desktop\Resto\engram (⚠ dentro de carpeta de proyecto) |
| Rutas de skills | ~/.claude/skills/ y plugins | ✅ existe `team-bootstrap`/`team-resume` |
| Modelos declarados | Sonnet 5.5 activo | ✅ indicado por el entorno de la sesión |
