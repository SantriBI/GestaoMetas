"use client"

import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import {
  ChallengeTargetAutocomplete,
  type ChallengeTargetAutocompleteOption,
} from "@/components/challenges/ChallengeTargetAutocomplete"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChallengeMetaItem } from "@/components/challenges/ChallengeMetaItem"
import {
  formatCurrencyBRL,
  getMetaTypeLabel,
  searchChallengeBrands,
  searchChallengeProducts,
  type ChallengeMeta,
  type ChallengeMetaType,
} from "@/lib/challenges"

const typeOptions: ChallengeMetaType[] = ["FATURAMENTO", "PEDIDOS_FECHADOS", "CLIENTES_ATENDIDOS", "RECUPERAR_CLIENTES", "PRODUTO_OU_MARCA"]

type MetaDraft = {
  tipoMeta: ChallengeMetaType
  metaValor: string
  recompensaValor: string
  produto: ChallengeTargetAutocompleteOption | null
  marca: ChallengeTargetAutocompleteOption | null
}

const unitByType: Record<ChallengeMetaType, string> = {
  FATURAMENTO: "R$",
  PEDIDOS_FECHADOS: "pedidos",
  CLIENTES_ATENDIDOS: "clientes",
  RECUPERAR_CLIENTES: "clientes",
  PRODUTO_OU_MARCA: "R$",
}

function createMetaDraft(): MetaDraft {
  return {
    tipoMeta: "FATURAMENTO",
    metaValor: "",
    recompensaValor: "",
    produto: null,
    marca: null,
  }
}

function buildMetaFromDraft(draft: MetaDraft, ordemExibicao: number): ChallengeMeta {
  const targetSegments = [
    draft.produto ? `Produto ${formatTargetOption(draft.produto)}` : null,
    draft.marca ? `Marca ${formatTargetOption(draft.marca)}` : null,
  ].filter(Boolean)

  return {
    tipoMeta: draft.tipoMeta,
    metaValor: Number(draft.metaValor),
    unidadeMeta: unitByType[draft.tipoMeta],
    recompensaValor: Number(draft.recompensaValor),
    ordemExibicao,
    config:
      draft.tipoMeta === "PRODUTO_OU_MARCA" && (draft.produto || draft.marca)
        ? {
            productId: draft.produto?.id ?? null,
            productName: draft.produto?.label ?? null,
            brandId: draft.marca?.id ?? null,
            brandName: draft.marca?.label ?? null,
            targetType: draft.produto && draft.marca ? "PRODUCT_OR_BRAND" : draft.produto ? "PRODUCT" : "BRAND",
            targetValue: targetSegments.join(" | "),
          }
        : {},
  }
}

function createDraftFromMeta(meta: ChallengeMeta): MetaDraft {
  const legacyTargetType = String(meta.config?.targetType ?? "").trim().toUpperCase()
  const legacyTargetValue = String(meta.config?.targetValue ?? "").trim()

  return {
    tipoMeta: meta.tipoMeta,
    metaValor: String(Number(meta.metaValor) || ""),
    recompensaValor: String(Number(meta.recompensaValor) || ""),
    produto:
      meta.config?.productId || meta.config?.productName
        ? {
            id: String(meta.config?.productId ?? "").trim(),
            label: String(meta.config?.productName ?? "").trim(),
          }
        : legacyTargetType === "PRODUCT" && legacyTargetValue
          ? {
              id: "",
              label: legacyTargetValue,
            }
          : null,
    marca:
      meta.config?.brandId || meta.config?.brandName
        ? {
            id: String(meta.config?.brandId ?? "").trim(),
            label: String(meta.config?.brandName ?? "").trim(),
          }
        : ["BRAND", "CATEGORY"].includes(legacyTargetType) && legacyTargetValue
          ? {
              id: "",
              label: legacyTargetValue,
            }
          : null,
  }
}

export function ChallengeMetaBuilder({
  metas,
  onChange,
}: {
  metas: ChallengeMeta[]
  onChange: (metas: ChallengeMeta[]) => void
}) {
  const [isComposerOpen, setIsComposerOpen] = useState(metas.length === 0)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draft, setDraft] = useState<MetaDraft>(createMetaDraft())

  useEffect(() => {
    if (!metas.length) setIsComposerOpen(true)
  }, [metas.length])

  const totalReward = useMemo(
    () => metas.reduce((sum, meta) => sum + (Number(meta.recompensaValor) || 0), 0),
    [metas]
  )

  const canSubmitDraft = useMemo(() => {
    const metaValor = Number(draft.metaValor)
    const recompensa = Number(draft.recompensaValor)

    if (!Number.isFinite(metaValor) || metaValor <= 0) return false
    if (!Number.isFinite(recompensa) || recompensa < 0) return false
    if (draft.tipoMeta === "PRODUTO_OU_MARCA" && !draft.produto && !draft.marca) return false
    return true
  }, [draft])

  function openNewMetaComposer() {
    setEditingIndex(null)
    setDraft(createMetaDraft())
    setIsComposerOpen(true)
  }

  function closeComposer() {
    setEditingIndex(null)
    setDraft(createMetaDraft())
    setIsComposerOpen(false)
  }

  function handleAddOrUpdateMeta() {
    if (!canSubmitDraft) return

    if (editingIndex !== null) {
      onChange(
        metas.map((meta, index) => (
          index === editingIndex
            ? buildMetaFromDraft(draft, index + 1)
            : { ...meta, ordemExibicao: index + 1 }
        ))
      )
      closeComposer()
      return
    }

    onChange([
      ...metas,
      buildMetaFromDraft(draft, metas.length + 1),
    ])
    setDraft(createMetaDraft())
    setEditingIndex(null)
    setIsComposerOpen(false)
  }

  function handleEditMeta(index: number) {
    setEditingIndex(index)
    setDraft(createDraftFromMeta(metas[index]))
    setIsComposerOpen(true)
  }

  function handleRemoveMeta(index: number) {
    onChange(
      metas
        .filter((_, metaIndex) => metaIndex !== index)
        .map((meta, metaIndex) => ({ ...meta, ordemExibicao: metaIndex + 1 }))
    )

    if (editingIndex === index) {
      closeComposer()
      return
    }

    if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1)
    }
  }

  return (
    <div className="w-full space-y-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-300/18 bg-cyan-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
              Etapa principal
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
              {metas.length} meta(s)
            </span>
          </div>

          <h3 className="mt-4 text-3xl font-black tracking-tight text-white md:text-[2.2rem]">
            Quais metas aceleram a campanha?
          </h3>
          <p className="mt-3 text-sm leading-7 text-white/60">
            Defina uma ou mais metas com recompensa clara para o time entender o jogo rapidamente.
          </p>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.18)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">Panorama rapido</p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-3xl font-black tracking-tight text-white">{metas.length}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/34">metas ativas</p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.16em] text-white/34">bonus potencial</p>
              <p className="mt-1 text-lg font-semibold text-white">{formatCurrencyBRL(totalReward)}</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={openNewMetaComposer}
            className="mt-5 h-12 w-full rounded-2xl bg-[linear-gradient(135deg,#22d3ee,#60a5fa)] text-sm font-semibold text-black hover:opacity-95"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar meta
          </Button>
        </div>
      </div>

      {isComposerOpen ? (
        <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-6 shadow-[0_28px_90px_rgba(2,6,23,0.22)] md:p-7">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/72">
                {editingIndex !== null ? `Editando meta ${editingIndex + 1}` : "Nova meta"}
              </p>
              <h4 className="mt-3 text-2xl font-black tracking-tight text-white">
                {editingIndex !== null ? "Atualize os detalhes da meta" : "Monte a proxima meta da campanha"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-white/56">
                Escolha o indicador, defina o alvo e informe a recompensa. Tudo foi simplificado para leitura rapida.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">Tipo selecionado</p>
                <p className="mt-2 text-sm font-semibold text-white">{getMetaTypeLabel(draft.tipoMeta)}</p>
              </div>

              {metas.length ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeComposer}
                  className="h-11 rounded-2xl border-white/12 bg-white/5 px-4 text-white hover:bg-white/10"
                >
                  Cancelar
                </Button>
              ) : null}
            </div>
          </div>

          <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_220px_220px]">
            <Field label="Tipo da meta">
              <select
                value={draft.tipoMeta}
                onChange={(event) => setDraft((current) => ({ ...current, tipoMeta: event.target.value as ChallengeMetaType }))}
                className={`${builderFieldClass} bg-slate-950 [color-scheme:dark]`}
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type} className="bg-slate-950 text-white">
                    {getMetaTypeLabel(type)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={draft.tipoMeta === "PRODUTO_OU_MARCA" ? "Meta de venda" : "Valor da meta"}>
              <Input
                type="number"
                min={0}
                value={draft.metaValor}
                onChange={(event) => setDraft((current) => ({ ...current, metaValor: event.target.value }))}
                className={builderFieldClass}
                placeholder={draft.tipoMeta === "PRODUTO_OU_MARCA" ? "Ex.: 5000" : "Ex.: 10"}
              />
            </Field>

            <Field label="Recompensa">
              <Input
                type="number"
                min={0}
                value={draft.recompensaValor}
                onChange={(event) => setDraft((current) => ({ ...current, recompensaValor: event.target.value }))}
                className={builderFieldClass}
                placeholder="Ex.: 100"
              />
            </Field>
          </div>

          {draft.tipoMeta === "PRODUTO_OU_MARCA" ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <ChallengeTargetAutocomplete
                label="Produto"
                placeholder="Busque por nome ou PRODUTO_ID"
                emptyLabel="Nenhum produto encontrado para esse termo."
                helperText="Busca por nome ou PRODUTO_ID direto no Oracle."
                value={draft.produto}
                onChange={(produto) => setDraft((current) => ({ ...current, produto }))}
                onSearch={loadProductOptions}
                inputClassName={builderFieldClass}
              />

              <ChallengeTargetAutocomplete
                label="Marca / Categoria"
                placeholder="Busque por nome ou MARCA_ID"
                emptyLabel="Nenhuma marca encontrada para esse termo."
                helperText="Voce pode buscar por MARCA_ID, nome da marca ou referencia de categoria."
                value={draft.marca}
                onChange={(marca) => setDraft((current) => ({ ...current, marca }))}
                onSearch={loadBrandOptions}
                inputClassName={builderFieldClass}
              />
            </div>
          ) : null}

          <div className="mt-7 flex flex-col gap-4 border-t border-white/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-7 text-white/48">
              {draft.tipoMeta === "FATURAMENTO"
                ? "Meta em reais para campanhas focadas em receita."
                : draft.tipoMeta === "PRODUTO_OU_MARCA"
                  ? "A meta mede o faturamento vendido no periodo do desafio considerando o produto, a marca ou ambos."
                : `A unidade desta meta sera exibida como ${unitByType[draft.tipoMeta]}.`}
            </p>

            <Button
              type="button"
              onClick={handleAddOrUpdateMeta}
              disabled={!canSubmitDraft}
              className="h-12 rounded-2xl bg-[linear-gradient(135deg,#f59e0b,#ec4899,#06b6d4)] px-6 text-sm font-semibold text-black hover:opacity-95 disabled:opacity-50"
            >
              {editingIndex !== null ? "Salvar meta" : "Adicionar meta"}
            </Button>
          </div>
        </section>
      ) : null}

      {metas.length ? (
        <div className="space-y-5">
          {metas.map((meta, index) => (
            <ChallengeMetaItem
              key={`meta-card-${index}`}
              meta={{ ...meta, ordemExibicao: index + 1 }}
              onEdit={() => handleEditMeta(index)}
              onRemove={() => handleRemoveMeta(index)}
            />
          ))}
        </div>
      ) : (
        <section className="rounded-[30px] border border-dashed border-white/12 bg-white/[0.03] px-6 py-12 text-center">
          <p className="text-lg font-semibold text-white">Nenhuma meta adicionada ainda</p>
          <p className="mt-3 text-sm leading-7 text-white/54">
            Comece pela primeira meta para transformar a ideia em uma campanha clara e acionavel para o time.
          </p>
        </section>
      )}
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block space-y-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{label}</span>
      {children}
    </label>
  )
}

function formatTargetOption(option: ChallengeTargetAutocompleteOption) {
  return [String(option.id ?? "").trim(), String(option.label ?? "").trim()].filter(Boolean).join(" - ")
}

async function loadProductOptions(term: string) {
  const response = await searchChallengeProducts(term)
  return response.items.map((item) => ({
    id: item.produtoId,
    label: item.nomeProduto,
    description: item.nomeMarca ? `Marca: ${item.nomeMarca}` : null,
  }))
}

async function loadBrandOptions(term: string) {
  const response = await searchChallengeBrands(term)
  return response.items.map((item) => ({
    id: item.marcaId,
    label: item.nomeMarca,
    description: item.nomeCategoria ? `Categoria: ${item.nomeCategoria}` : null,
  }))
}

const builderFieldClass = "h-14 w-full rounded-[20px] border border-white/10 bg-black/20 px-5 text-base text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-white/28 focus-visible:border-cyan-300/35 focus-visible:ring-0"
