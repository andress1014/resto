---
agente: agy
tipo: Antigravity CLI (agente de código de Google DeepMind)
version: 1.3.3
modelo: Claude Sonnet 5.5 (Medium) — seleccionado por el usuario en la sesión actual
estado: completa
---

# Ficha de capacidades — agy

## Herramientas propias
- Leer archivos de texto, imagen y vídeo (`view_file`, máx. 800 líneas por vista).
- Crear y editar archivos (`write_to_file`, `replace_file_content`).
- Terminal PowerShell en Windows (`run_command`), con tareas en segundo plano gestionables (`manage_task`: list/kill/status/send_input).
- Búsqueda web (`search_web`) y lectura de URLs (`read_url_content`, HTML a markdown, sin JavaScript ni login).
- Preguntas interactivas al usuario (`ask_question`).
- Temporizadores y cron (`schedule`).
- Memoria engram vía MCP.
- NO tengo navegador interactivo como herramienta directa en este contexto (existe el comando `/browser`, pero yo no tengo una herramienta de navegador aquí). Tampoco tengo herramienta de generación de imágenes propia: la delego al subagente `image-generator`.

## Subagentes y modo multi-agente
- Se invocan con la herramienta `invoke_subagent`. Recibe un array `Subagents`; cada entrada lleva `TypeName`, `Role`, `Prompt`, y opcionalmente `Model` y `Workspace`.
- Tipos disponibles: `self` (copia de mí con mis mismas herramientas), `research` (solo lectura, web y archivos), `image-generator` (genera o edita imágenes). Se pueden definir tipos nuevos con `define_subagent` (nombre, descripción, system prompt, y permisos: escritura, MCP, subagentes).
- Comunicación: `send_message` con el conversationId devuelto. Gestión con `manage_subagents` (list, kill, kill_all). Cada subagente avisa al terminar; no hace falta sondear.
- Paralelismo: varias entradas en un mismo `invoke_subagent` corren concurrentes. No tengo un límite numérico documentado en mi contexto; no lo puedo afirmar.
- Asignación de modelo por subagente: parámetro `Model` de cada entrada, con valores `inherit` (por defecto, hereda mi modelo), `flash_lite`, `flash` o `pro`. Mi instrucción es usar `inherit` salvo que el usuario pida otro nivel explícitamente.
- `Workspace`: `inherit` (mismo), `branch` (clon aislado) o `share` (comparte repositorio, estilo worktree).

## Modelos disponibles y cómo elegirlos
| Nivel | Modelo que usas | Cómo se selecciona (flag, comando o parámetro) |
|---|---|---|
| potente | `pro` para subagentes (nombre de modelo concreto no expuesto). Mi modelo principal actual es Claude Sonnet 5.5 (Medium) | Subagentes: `Model: "pro"`. Principal: ajuste Model Selection de la interfaz |
| estándar | `inherit` (mismo modelo que el padre) | `Model: "inherit"` (por defecto) |
| ligero | `flash` (rápido) y `flash_lite` (muy ligero); nombres concretos no expuestos | `Model: "flash"` o `"flash_lite"` |

No conozco la lista completa de modelos que ofrece el selector principal ni sus nombres reales detrás de pro/flash/flash_lite. No lo invento.

## Comandos `/`
No puedo ejecutarlos yo; solo recomendarlos al usuario:
- `/goal`: tarea larga, el agente no para hasta cumplir el objetivo.
- `/schedule`: instrucciones recurrentes o temporizador.
- `/browser`: navegación y apps web.
- `/plan`: planificación paso a paso antes de ejecutar.
- `/grill-me`: entrevista interactiva para cerrar decisiones de diseño.
- `/teamwork-preview`: equipo de agentes autónomos para proyectos grandes.
- `/learn`: persistir correcciones o configuraciones para futuras tareas.
- `/boost`: proyectos complejos con razonamiento profundo y verificación rigurosa.

## Skills
Carpeta del proyecto: `C:\Users\jcgm1\OneDrive\Desktop\Resto\Resto\.agents\skills\` con banner-design, brand, design, design-system, slides, ui-styling, ui-ux-pro-max.
Integradas: `C:\Users\jcgm1\.gemini\antigravity-cli\builtin\skills\` con agy-customizations y antigravity-guide.
Globales: `C:\Users\jcgm1\.gemini\config\skills\` con herdr, team-bootstrap, team-resume.
Cada una es una carpeta con `SKILL.md`; debo leerlo antes de usarla.

## Plugins y MCP
- Tengo engram: SÍ (servidor MCP `engram`, carga perezosa vía `call_mcp_tool`). Herramientas: mem_save, mem_search, mem_context, mem_get_observation, mem_update, mem_session_start, mem_session_summary, mem_session_end, mem_capture_passive, mem_suggest_topic_key, mem_pin, mem_unpin, mem_review, mem_judge, mem_compare, mem_doctor, mem_list_projects, mem_current_project, mem_save_prompt.
- Esquemas en `C:\Users\jcgm1\.gemini\antigravity-cli\mcp\engram\`.
- No tengo otros servidores MCP ni plugins visibles en este contexto.

## Límites
- Sin navegador interactivo ni generación de imágenes directa.
- Lectura máxima de 800 líneas / 46 KB por vista.
- `read_url_content` no ejecuta JavaScript ni autentica.
- No conozco límite de paralelismo ni los nombres reales de los modelos de cada nivel.
- No puedo ejecutar comandos slash por mi cuenta.
- La herramienta `replace_file_content` solo admite un bloque contiguo por llamada.

## Cómo prefiero recibir trabajo
Handoff en markdown con: objetivo, rutas absolutas de archivos, criterios de aceptación, restricciones y qué devolver (formato de respuesta). Una tarea acotada por mensaje. Indicar si debo guardar en engram.

## Verificación del orquestador

| Dato | Declarado | Verificado (✅ / ⚠ / ❌) |
|---|---|---|
| Versión | desconocida | ✅ `agy --version` = 1.3.3 (completada por el orquestador) |
| Detección en Herdr | agy / Antigravity CLI | ✅ detectado como `agy` (pane w2:p1C, renombrado por el orquestador); hooks `antigravity-cli` current (v2) |
| Engram | Sí (MCP `engram`) | ✅ ENGRAM_DATA_DIR = ...\Desktop\Resto\engram (igual que claude y kimi; ⚠ dentro de carpeta de proyecto) |
| Rutas de skills | .agents/skills, builtin/skills, .gemini/config/skills | ⚠ proyecto y ~/.gemini/config/skills existen (incl. herdr, team-*). builtin existe pero con otros nombres: agy-customizations, antigravity_guide (con guion bajo), automation, generative_ui, migrate-workflows, permissioned-github, plugin, ui-plugin-navigation |
| Modelos declarados | Claude Sonnet 5.5 (Medium); subagentes pro/flash/flash_lite/inherit | ⚠ `agy --help` confirma `--model` y subcomando `models`; el modelo activo (Sonnet 5.5 Medium) se vio en el pane; los alias pro/flash/flash_lite son declarados, no verificados |
