import "dotenv/config"

export type QaRole = "GERENTE" | "VENDEDOR"

export interface RoleCredential {
  role: QaRole
  login: string
  senha: string
}

function optional(name: string, fallback: string): string {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : fallback
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw || !raw.trim()) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const env = {
  baseUrl: optional("BASE_URL", "http://localhost:3000").replace(/\/$/, ""),
  headless: optional("HEADLESS", "true") !== "false",
  defaultTimeoutMs: optionalNumber("DEFAULT_TIMEOUT_MS", 15000),
  actionTimeoutMs: optionalNumber("ACTION_TIMEOUT_MS", 10000),
  navigationTimeoutMs: optionalNumber("NAVIGATION_TIMEOUT_MS", 30000),
  slowMoMs: optionalNumber("SLOWMO_MS", 0),
  workers: optional("WORKERS", ""),
}

/**
 * Credenciais de teste sao lidas sob demanda (nao na carga do modulo) para que
 * a ausencia de um papel derrube apenas os testes daquele papel, nao a suite inteira.
 */
export function requireCredential(role: QaRole): RoleCredential {
  const login = process.env[`QA_${role}_LOGIN`]
  const senha = process.env[`QA_${role}_SENHA`]

  if (!login || !senha) {
    throw new Error(
      `[qa-agent] Credencial de teste para o papel ${role} nao configurada. ` +
        `Defina QA_${role}_LOGIN e QA_${role}_SENHA no arquivo .env do qa-agent (veja .env.example).`
    )
  }

  return { role, login, senha }
}
