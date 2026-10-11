---
agente: kimi
tipo: Kimi Code CLI
version: 2.1.1
modelo: moonshot-ai/kimi-k3 (default_model en config.toml)
estado: completa
---

# Ficha de capacidades — Kimi Code CLI

## Herramientas propias
- Leer/escribir/editar archivos (Read, Write, Edit, Glob, Grep).
- Terminal Bash (Git Bash en Windows) con tareas en background (Bash, TaskList, TaskOutput, TaskStop, WaitFor).
- Búsqueda web y lectura de URLs (WebSearch, FetchURL).
- Lectura de imágenes y video (ReadMediaFile).
- Preguntas estructuradas al usuario (AskUserQuestion), lista de tareas (TodoList), modo plan (EnterPlanMode/ExitPlanMode), recordatorios cron (CronCreate/CronList/CronDelete), metas autónomas (CreateGoal/UpdateGoal/SetGoalBudget).
- NO tengo navegador controlado, ni acceso directo a GitHub salvo vía `gh` CLI si está instalado y autenticado.

## Subagentes y modo multi-agente
Tengo dos herramientas nativas, no un "modo" aparte:

1. **`Agent`** — lanza UN subagente. Parámetros clave:
   - `subagent_type`: `plan` (solo lectura, planificación), `coder` (único con edición de archivos), `explore` (exploración rápida de código, solo lectura).
   - `prompt`: el subagente arranca con contexto CERO; hay que briefearlo como a un colega nuevo (objetivo, rutas exactas, lo que ya sé).
   - `resume`: id de un subagente previo para continuar su contexto.
   - `run_in_background=true/false`: background solo si no necesito su resultado para seguir.
2. **`AgentSwarm`** — lanza MUCHOS subagentes en paralelo desde una plantilla `prompt_template` con placeholder `{{item}}` y una lista `items` (un subagente por item).
   - **Paralelismo: hasta 128 subagentes**; los lanzamientos se encolan automáticamente.

**Asignación de modelo a subagentes: NO existe.** Siendo honesto: no tengo ningún parámetro para asignar un modelo distinto a cada subagente; heredan el modelo activo de la sesión. Tampoco puedo elegir qué tipo de herramientas tiene cada uno más allá de los 3 tipos fijos. Además, los subagentes no ven la conversación con el usuario ni entre ellos: su resultado solo vuelve a mí y yo lo resumo.

## Modelos disponibles y cómo elegirlos
Declarados en `C:/Users/jcgm1/.kimi-code/config.toml`:

| Nivel | Modelo que usas | Cómo se selecciona (flag, comando o parámetro) |
|---|---|---|
| potente | `moonshot-ai/kimi-k3` (default actual) | `default_model` en `~/.kimi-code/config.toml` o comando `/model` en el TUI |
| estándar | `moonshot-ai/kimi-k2.7-code` | ídem (`/model` o config.toml) |
| ligero | `moonshot-ai/kimi-k2.7-code-highspeed` (rápido) y `moonshot-ai/kimi-k2.6` | ídem |

El cambio de modelo es por sesión completa, no por tarea ni por subagente.

## Comandos `/`
Siendo honesto: no puedo enumerarlos programáticamente desde aquí; la lista completa la ve el usuario escribiendo `/` en el TUI. Los que tengo confirmados por mi contexto:
- `/goal` — crea una meta autónoma (tengo la skill `write-goal` para redactarla bien).

## Skills
Se invocan con la herramienta `Skill` (nombre exacto + args). Disponibles:

- **Proyecto** (`.agents/skills/` del repo): `banner-design`, `brand`, `design`, `design-system`, `slides`, `ui-styling`, `ui-ux-pro-max`.
- **Usuario** (`C:/Users/jcgm1/.agents/skills/`): `herdr` (controlar Herdr/panes/pestañas — solo si el usuario lo menciona), `team-bootstrap`, `team-resume`.
- **Built-in**: `check-kimi-code-docs` (documentación oficial de Kimi Code), `update-config` (editar config.toml/tui.toml), `write-goal`.

## Plugins y MCP
- **Sí tengo Engram** (MCP `engram`): memoria persistente entre sesiones — `mem_save`, `mem_search`, `mem_context`, `mem_session_start/end`, `mem_session_summary`, `mem_judge`, `mem_compare`, `mem_pin`, `mem_review`, etc.
- No tengo otros servidores MCP ni plugins conectados que pueda ver.

## Límites
- No elijo modelo por subagente ni por tarea (ver arriba).
- No veo el TUI ni los paneles de Herdr salvo vía la skill `herdr` (y solo si el usuario la pide).
- No ejecuto comandos interactivos ni de larga duración en foreground; no uso sudo.
- Los archivos sensibles (.env, claves SSH) me están bloqueados por las herramientas dedicadas.
- Mis subagentes `plan` y `explore` no pueden editar archivos; solo `coder` edita.

## Cómo prefiero recibir trabajo
Handoff con: objetivo en una frase, rutas exactas de archivos relevantes, criterio de "terminado" verificable (comando de build/test que debe pasar) y restricciones (qué NO tocar). Si es para un subagente mío, el brief debe ser autocontenido porque arranca sin contexto.

## Verificación del orquestador

| Dato | Declarado | Verificado (✅ / ⚠ / ❌) |
|---|---|---|
| Versión | 2.1.1 | ✅ `kimi --version` = 2.1.1 |
| Detección en Herdr | No detectado (declaración previa al registro) | ✅ detectado como `kimi` (pane w2:p19), hooks `current` (v7) |
| Engram | Sí, MCP conectado | ✅ ENGRAM_DATA_DIR = ...\Desktop\Resto\engram (igual que claude y agy; ⚠ dentro de carpeta de proyecto) |
| Rutas de skills | .agents/skills/ (proyecto), ~/.agents/skills/ (usuario), built-in | ✅ proyecto (7 skills) y usuario (9, incl. herdr, team-bootstrap, team-resume) existen; built-in no verificable |
| Modelos declarados | kimi-k3, kimi-k2.7-code, kimi-k2.6, kimi-k2.7-code-highspeed | ✅ los 4 en [models.*] de ~/.kimi-code/config.toml; default_model = kimi-k3 |
