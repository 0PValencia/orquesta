# Qué le falta a Orquesta para ser un agente “de verdad”

Especializado en informes, autónomo, con MCP. Estado actual vs siguiente nivel.

## Ya tienes

1. **Especialista de contenido** — LoRA `informes` en Modal (estilo SI I).
2. **CLI instalable** — `curl …/install.sh | bash` desde [0PValencia/orquesta](https://github.com/0PValencia/orquesta).
3. **MCP add/list/remove** — flujo tipo OpenCode.
4. **Bucle agente** — plan → `<tool_call>` → resultado → respuesta.
5. **Detección de MCP** — si no hay config o falló la conexión y piden Docs, lo dice y ofrece redactar en chat.

## Huecos importantes (prioridad)

### 1. Cerebro de orquestación (alto)
El LoRA actual redacta bien; **no** está entrenado en trazas de `razonamiento` + `mcp_google_docs`.
Sin eso, las decisiones de tools dependen solo del system prompt (frágil).

→ Fase 2 de fine-tune ([`training/FASE2.md`](../training/FASE2.md)).

### 2. MCP real de Google Docs (alto)
Hasta que `orquesta mcp add` apunte a tu servidor Docs con credenciales, no puede crear/editar documentos de verdad.

### 3. Confirmaciones y permisos (medio)
Un agente serio pide OK antes de borrar, exportar o escribir en Docs ajenos.

### 4. Memoria / sesiones (medio)
Hoy el REPL recuerda el hilo en RAM. Falta guardar sesiones, retomar informes, `documentId` del proyecto actual.

### 5. Observabilidad (medio)
Logs de tools, costos Modal, reintentos ante 503 (cold start).

### 6. Empaque tipo OpenCode binario (bajo)
Ahora instala vía git+npm. Releases con binario único serían más “producto”.

## Definición mínima de “agente general especializado en informes”

```text
Usuario → Orquesta decide:
  ¿Solo redactar? → Modal LoRA
  ¿Docs? → ¿MCP ok? → tools → Modal para texto → tools insertan
  ¿Falta dato? → pregunta
  ¿Sin MCP y hace falta? → lo declara + alternativa
```

Con (1) + (2) + lo ya hecho, cruzas ese umbral. El resto es pulido de producto.
