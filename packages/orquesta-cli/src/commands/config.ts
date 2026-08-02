import { loadConfig } from "../config.js";

export function configCommand(): void {
  const cfg = loadConfig();
  console.log(
    JSON.stringify(
      {
        ORQUESTA_BASE_URL: cfg.baseUrl || "(no definido)",
        ORQUESTA_API_KEY: cfg.apiKey ? "(definido)" : "(vacío)",
        ORQUESTA_MODEL: cfg.model,
        ORQUESTA_HOME: cfg.configDir,
        mcpPath: cfg.mcpPath,
        maxToolRounds: cfg.maxToolRounds,
      },
      null,
      2
    )
  );
  if (!cfg.baseUrl) {
    console.error("\nDefine ORQUESTA_BASE_URL tras modal deploy.");
  }
}
