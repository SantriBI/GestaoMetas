import { getScopedEmpresaId } from "../services/requestScope.js"
import { getLojasForRole } from "../services/lojaAcessoService.js"
import { resolveLojaColumnName } from "../services/lojaScopeService.js"
import { queryOracleByEmpresaId } from "../db/oracle-tenants.js"

const RANKING_VIEW = "VW_RANKING_VENDEDORES"

/**
 * Descobre em qual das lojas do vendedor existe registro de ranking (onde meta/receita
 * realmente aparecem) e devolve o empresaAcesso correspondente, para pre-selecionar essa loja
 * no seletor em vez da primeira da lista (que pode nao ter nenhum dado).
 */
async function resolveEmpresaAcessoPadrao(empresaId, skVendedor, lojas) {
  if (!skVendedor || lojas.length < 2) return null

  try {
    const column = await resolveLojaColumnName(empresaId, RANKING_VIEW)
    if (!column) return null

    const rows = await queryOracleByEmpresaId(
      empresaId,
      `SELECT ${column} AS sk_empresa FROM ${RANKING_VIEW} WHERE sk_vendedor = :sk_vendedor AND ROWNUM = 1`,
      { sk_vendedor: skVendedor }
    )

    const skEmpresa = rows[0]?.sk_empresa ?? rows[0]?.SK_EMPRESA
    if (skEmpresa === null || skEmpresa === undefined) return null

    const match = lojas.find((loja) => loja.skEmpresas === String(skEmpresa))
    return match?.empresaAcesso ?? null
  } catch (error) {
    console.error("Erro ao resolver loja padrao do vendedor:", error)
    return null
  }
}

export async function getMinhasLojas(req, res) {
  try {
    const empresaId = getScopedEmpresaId(req)
    const role = String(req.auth?.role ?? "").toUpperCase()
    const cpf = req.auth?.cpf ?? null

    if (!empresaId || !cpf || (role !== "VENDEDOR" && role !== "GERENTE")) {
      return res.json({ lojas: [], exibirSeletor: false, permiteTodasLojas: false, empresaAcessoPadrao: null })
    }

    const lojas = await getLojasForRole({ empresaId, cpf, role, idUsuario: req.auth?.id_usuario ?? null })
    const skVendedor = role === "VENDEDOR" ? req.auth?.sk_vendedor ?? null : null
    const empresaAcessoPadrao = await resolveEmpresaAcessoPadrao(empresaId, skVendedor, lojas)

    return res.json({
      lojas: lojas.map((loja) => ({
        empresaAcesso: loja.empresaAcesso,
        nomeResumido: loja.nomeResumido,
      })),
      exibirSeletor: lojas.length > 1,
      permiteTodasLojas: role === "GERENTE" && lojas.length > 1,
      empresaAcessoPadrao,
    })
  } catch (error) {
    console.error("Erro ao buscar lojas do usuario:", error)
    res.status(500).json({ error: "Erro ao buscar lojas do usuario." })
  }
}
