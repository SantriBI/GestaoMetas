import { getLojasForRole } from "./lojaAcessoService.js"

const TODAS_LOJAS_TOKEN = "TODAS"

export function getRequestedEmpresaId(req) {
  return req.query?.empresa_id ?? req.query?.empresaId ?? req.body?.empresa_id ?? req.body?.empresaId ?? null
}

export function getRequestedLojaId(req) {
  return req.query?.empresa_acesso ?? req.query?.empresaAcesso ?? req.body?.empresa_acesso ?? req.body?.empresaAcesso ?? null
}

function isTodasLojasRequested(value) {
  return String(value ?? "").trim().toUpperCase() === TODAS_LOJAS_TOKEN
}

export function getScopedEmpresaId(req) {
  const authEmpresaId = req.auth?.empresa_id ?? null
  const requestedEmpresaId = getRequestedEmpresaId(req)

  if (canUseGlobalEmpresaScope(req)) {
    return requestedEmpresaId ?? authEmpresaId ?? null
  }

  return authEmpresaId ?? null
}

export function canUseGlobalEmpresaScope(req) {
  const role = String(req.auth?.role ?? "").toUpperCase()
  return role === "SUPERADMIN" || role === "ADMIN"
}

/**
 * Resolve o escopo de loja/filial do usuario autenticado (VENDEDOR ou GERENTE), validando
 * SEMPRE contra FATO_FUNCIONARIOS_ACESSOS no servidor - nunca confia no empresa_acesso vindo
 * do frontend.
 *
 * applies=false significa "sem filtro de loja a aplicar" (papel fora do escopo desta feature,
 * ou usuario/tenant ainda sem mapeamento em FATO_FUNCIONARIOS_ACESSOS) - preserva o
 * comportamento anterior a esta feature nesses casos.
 * error, quando presente, deve virar a resposta HTTP (400 selecao ausente / 403 loja nao autorizada).
 *
 * options.required (default true): quando false, um usuario multi-loja sem empresa_acesso na
 * requisicao nao gera erro - agrega todas as lojas dele (como se tivesse pedido "TODAS").
 * Usado nas telas onde a selecao de loja nao faz sentido (Area de Ataque, Assistente de Vendas,
 * Desafios, Radar de Vendas, Ativacao de Clientes, Kanban, Objetivo do Vendedor); o Painel do
 * Vendedor (Jornada) e o Ranking continuam exigindo selecao (required: true, o default).
 */
export async function getScopedLojaScope(req, { required = true } = {}) {
  const empresaId = getScopedEmpresaId(req)
  const role = String(req.auth?.role ?? "").toUpperCase()
  const cpf = req.auth?.cpf ?? null

  if (!empresaId || !cpf || (role !== "VENDEDOR" && role !== "GERENTE")) {
    return { applies: false, lojaIds: null, error: null }
  }

  const lojas = await getLojasForRole({ empresaId, cpf, role, idUsuario: req.auth?.id_usuario ?? null })
  if (!lojas.length) {
    return { applies: false, lojaIds: null, error: null }
  }

  const allowedCodes = lojas.map((loja) => loja.empresaAcesso)
  const skEmpresasByCodigo = new Map(lojas.map((loja) => [loja.empresaAcesso, loja.skEmpresas]))

  // buildLojaInCondition filtra colunas SK_EMPRESA/SK_EMPRESAS das tabelas de fato, entao
  // lojaIds precisa ser o SK_EMPRESAS resolvido via DIM_EMPRESAS - nao o codigo EMPRESA_ACESSO
  // (dominios diferentes; ver lojaAcessoService.getLojasAcessoByCpf).
  const toSkEmpresas = (codes) => codes.map((code) => skEmpresasByCodigo.get(code)).filter((sk) => sk != null)

  if (lojas.length === 1) {
    return { applies: true, lojaIds: toSkEmpresas([allowedCodes[0]]), error: null }
  }

  const requested = getRequestedLojaId(req)

  if ((role === "GERENTE" || !required) && isTodasLojasRequested(requested)) {
    return { applies: true, lojaIds: toSkEmpresas(allowedCodes), error: null }
  }

  if (!requested) {
    if (!required) {
      return { applies: true, lojaIds: toSkEmpresas(allowedCodes), error: null }
    }

    return {
      applies: false,
      lojaIds: null,
      error: { status: 400, message: "empresa_acesso e obrigatorio: este usuario tem acesso a mais de uma loja." },
    }
  }

  if (!allowedCodes.includes(String(requested))) {
    return {
      applies: false,
      lojaIds: null,
      error: { status: 403, message: "Loja fora do escopo de acesso do usuario autenticado." },
    }
  }

  return { applies: true, lojaIds: toSkEmpresas([String(requested)]), error: null }
}
