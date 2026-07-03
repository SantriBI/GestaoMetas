"use client"

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  ActivationCampaignResponse,
  ActivationPreviewResponse,
  ActivationScope,
  ActivationSegment,
  ActivationSummary,
  MessageTemplate,
} from "@/lib/activation-types"
import {
  buildActivationWhatsappLink,
  createActivationCampaign,
  getActivationPreview,
  getActivationSegments,
  getActivationSummary,
  getMessageTemplates,
  replaceActivationVariables,
  sendActivationCampaign,
} from "@/lib/activation-service"

const ACTIVATION_CAMPAIGN_DB_WARNING =
  "A campanha foi gerada, mas ainda não foi salva no banco. Execute o script Back/sql/ddl_gestao_metas.sql e depois valide a estrutura de persistência."

export function useActivationCampaign(scope: ActivationScope | null) {
  const [segments, setSegments] = useState<ActivationSegment[]>([])
  const [segmentSummaries, setSegmentSummaries] = useState<Record<string, ActivationSummary>>({})
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [selectedSegment, setSelectedSegment] = useState<string>("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [message, setMessage] = useState("")
  const [preview, setPreview] = useState<ActivationPreviewResponse | null>(null)
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([])
  const [removedClientIds, setRemovedClientIds] = useState<string[]>([])
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("valor_potencial")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [isBootLoading, setIsBootLoading] = useState(true)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [isPersisting, setIsPersisting] = useState(false)
  const [lastCampaignId, setLastCampaignId] = useState<number | string | null>(null)
  const [lastSendStatus, setLastSendStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const hasBootstrappedRef = useRef(false)
  const previousSegmentRef = useRef("")
  const deferredSearch = useDeferredValue(search.trim())

  useEffect(() => {
    if (!scope) return
    const currentScope = scope

    let active = true

    async function bootstrap() {
      try {
        setIsBootLoading(true)
        setError(null)

        const [segmentData, templateData] = await Promise.all([
          getActivationSegments(),
          getMessageTemplates(currentScope),
        ])

        if (!active) return

        setSegments(segmentData)
        setTemplates(templateData)

        const summaryEntries = await Promise.all(
          segmentData.map(async (segment) => {
            const summary = await getActivationSummary(segment.id, currentScope)
            return [segment.id, summary] as const
          })
        )

        if (!active) return

        setSegmentSummaries(Object.fromEntries(summaryEntries))

        if (!hasBootstrappedRef.current) {
          const initialSegment = segmentData[0]?.id ?? ""
          setSelectedSegment(initialSegment)

          const initialTemplate =
            templateData.find(
              (template) =>
                String(template.classificacao_rfv ?? "").toLowerCase() ===
                String(segmentData[0]?.classificacao ?? "").toLowerCase()
            ) ?? templateData[0]

          setSelectedTemplateId(String(initialTemplate?.id ?? ""))
          setMessage(initialTemplate?.mensagem ?? segmentData[0]?.template_padrao ?? "")
          hasBootstrappedRef.current = true
          previousSegmentRef.current = initialSegment
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar Central de Ativação.")
        }
      } finally {
        if (active) {
          setIsBootLoading(false)
        }
      }
    }

    void bootstrap()

    return () => {
      active = false
    }
  }, [scope])

  useEffect(() => {
    if (!scope || !selectedSegment) return
    const currentScope = scope

    let active = true

    async function loadPreview() {
      try {
        setIsPreviewLoading(true)
        setError(null)

        const previewData = await getActivationPreview(selectedSegment, currentScope, {
          search: deferredSearch,
          sortBy,
          sortDir,
        })

        if (!active) return

        setPreview(previewData)
        setRemovedClientIds([])
        setSelectedClientIds((current) => {
          const phoneReadyIds = previewData.clientes
            .filter((client) => client.possui_telefone)
            .map((client) => client.id)
          const availableIds = new Set(previewData.clientes.map((client) => client.id))
          const preserved = current.filter((id) => availableIds.has(id))
          return preserved.length ? preserved : phoneReadyIds
        })
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Erro ao carregar o preview da campanha.")
        }
      } finally {
        if (active) {
          setIsPreviewLoading(false)
        }
      }
    }

    void loadPreview()

    return () => {
      active = false
    }
  }, [scope, selectedSegment, deferredSearch, sortBy, sortDir])

  useEffect(() => {
    if (!selectedSegment || !segments.length || !templates.length) return

    const currentSegment = segments.find((item) => item.id === selectedSegment)
    if (!currentSegment) return

    if (previousSegmentRef.current === selectedSegment) return

    const matchingTemplate =
      templates.find(
        (template) =>
          String(template.classificacao_rfv ?? "").toLowerCase() ===
          String(currentSegment.classificacao ?? "").toLowerCase()
      ) ?? templates[0]

    setSelectedTemplateId(String(matchingTemplate?.id ?? ""))
    setMessage(matchingTemplate?.mensagem ?? currentSegment.template_padrao ?? "")
    previousSegmentRef.current = selectedSegment
  }, [selectedSegment, segments, templates])

  const previewClients = useMemo(() => {
    const removedSet = new Set(removedClientIds)

    return (preview?.clientes ?? [])
      .filter((client) => !removedSet.has(client.id))
      .map((client) => {
        const mensagemFinal = replaceActivationVariables(message, client)

        return {
          ...client,
          mensagem_final: mensagemFinal,
          whatsapp_link: buildActivationWhatsappLink(client.telefone, mensagemFinal),
        }
      })
  }, [preview, removedClientIds, message])

  const summary = useMemo(() => {
    const selectedSummary = segmentSummaries[selectedSegment]
    if (!selectedSummary) {
      return preview?.resumo ?? null
    }

    const activeIds = new Set(previewClients.map((client) => client.id))
    const totalComTelefone = previewClients.filter((client) => client.possui_telefone).length
    const totalSemTelefone = previewClients.length - totalComTelefone
    const valorPotencial = previewClients.reduce(
      (acc, client) => acc + Number(client.valor_potencial ?? 0) + Number(client.valor_orcamento ?? 0),
      0
    )

    return {
      ...selectedSummary,
      total_clientes: activeIds.size,
      total_com_telefone: totalComTelefone,
      total_sem_telefone: totalSemTelefone,
      valor_potencial_carteira: valorPotencial,
    }
  }, [segmentSummaries, selectedSegment, preview, previewClients])

  const selectedClients = useMemo(() => {
    const selectedIdSet = new Set(selectedClientIds)
    return previewClients.filter((client) => selectedIdSet.has(client.id))
  }, [previewClients, selectedClientIds])

  const sampleClient = selectedClients[0] ?? previewClients[0] ?? null

  function applyTemplate(templateId: string) {
    setSelectedTemplateId(templateId)
    const template = templates.find((item) => String(item.id ?? "") === templateId)
    if (template?.mensagem) {
      setMessage(template.mensagem)
    }
  }

  function toggleClient(clientId: string) {
    const client = previewClients.find((item) => item.id === clientId)
    if (!client || !client.possui_telefone) return

    setSelectedClientIds((current) =>
      current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId]
    )
  }

  function toggleAllClients(checked: boolean) {
    const validIds = previewClients.filter((client) => client.possui_telefone).map((client) => client.id)
    setSelectedClientIds(checked ? validIds : [])
  }

  function removeClient(clientId: string) {
    setRemovedClientIds((current) => (current.includes(clientId) ? current : [...current, clientId]))
    setSelectedClientIds((current) => current.filter((id) => id !== clientId))
  }

  function restoreRemovedClients() {
    setRemovedClientIds([])
    setSelectedClientIds(previewClients.filter((client) => client.possui_telefone).map((client) => client.id))
  }

  async function persistCampaign() {
    if (!scope || !selectedSegment || !message.trim()) return null

    try {
      setIsPersisting(true)
      setError(null)

      const response = await createActivationCampaign({
        segmento: selectedSegment,
        template_id: selectedTemplateId || null,
        mensagem_base: message,
        role: scope.role,
        sk_vendedor: scope.sk_vendedor ?? null,
        empresa_id: scope.empresa_id ?? null,
        id_usuario: scope.id_usuario ?? null,
        nome_usuario: scope.nome_usuario ?? null,
        clientes: selectedClients,
      })

      if (response.persisted === false || response.campanha.id === null || response.campanha.id === undefined) {
        setLastCampaignId(null)
        setError(ACTIVATION_CAMPAIGN_DB_WARNING)
        return null
      }

      setLastCampaignId(response.campanha.id)
      return response
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar campanha.")
      return null
    } finally {
      setIsPersisting(false)
    }
  }

  async function triggerSend() {
    if (!scope || !selectedSegment || !message.trim()) return null

    let createdResponse: ActivationCampaignResponse | null = null

    try {
      setIsPersisting(true)
      setError(null)

      let persistedCampaign = lastCampaignId

      if (!persistedCampaign) {
        createdResponse = await createActivationCampaign({
          segmento: selectedSegment,
          template_id: selectedTemplateId || null,
          mensagem_base: message,
          role: scope.role,
          sk_vendedor: scope.sk_vendedor ?? null,
          empresa_id: scope.empresa_id ?? null,
          id_usuario: scope.id_usuario ?? null,
          nome_usuario: scope.nome_usuario ?? null,
          clientes: selectedClients,
        })

        persistedCampaign = createdResponse.campanha.id
      }

      if (persistedCampaign === null || persistedCampaign === undefined) {
        setLastCampaignId(null)
        setError(ACTIVATION_CAMPAIGN_DB_WARNING)
        toast.error(ACTIVATION_CAMPAIGN_DB_WARNING)
        return null
      }

      setLastCampaignId(persistedCampaign)

      const response = await sendActivationCampaign(persistedCampaign ?? "preview", {
        segmento: selectedSegment,
        mensagem_base: message,
        role: scope.role,
        sk_vendedor: scope.sk_vendedor ?? null,
        empresa_id: scope.empresa_id ?? null,
        id_usuario: scope.id_usuario ?? null,
        nome_usuario: scope.nome_usuario ?? null,
        clientes: selectedClients,
      })

      setLastSendStatus(response.webhook_status)
      toast.success("Campanha criada com sucesso 🚀", {
        description: createdResponse?.downloaded
          ? `Download iniciado: ${createdResponse.file_name ?? "campanha.xlsx"}.`
          : "Campanha salva e pronta para ativação.",
      })
      return response
    } catch (err) {
      const messageError = err instanceof Error ? err.message : "Erro ao confirmar campanha."
      const campaignWasSaved = Boolean(lastCampaignId ?? createdResponse?.campanha.id ?? createdResponse?.downloaded)

      if (campaignWasSaved) {
        const partialMessage = `Campanha salva, mas houve falha ao concluir a etapa de envio: ${messageError}`
        setError(partialMessage)
        toast.success("Campanha criada com sucesso 🚀", {
          description: createdResponse?.downloaded
            ? "O XLSX foi baixado automaticamente, mas a etapa final de envio falhou."
            : "A campanha foi salva, mas a etapa final de envio falhou.",
        })
      } else {
        setError(messageError)
        toast.error(messageError)
      }

      return null
    } finally {
      setIsPersisting(false)
    }
  }

  return {
    segments,
    segmentSummaries,
    templates,
    selectedSegment,
    selectedTemplateId,
    message,
    summary,
    previewClients,
    selectedClients,
    selectedClientIds,
    removedClientIds,
    search,
    sortBy,
    sortDir,
    sampleClient,
    isBootLoading,
    isPreviewLoading,
    isPersisting,
    lastCampaignId,
    lastSendStatus,
    error,
    setSelectedSegment,
    setMessage,
    setSearch,
    setSortBy,
    setSortDir,
    applyTemplate,
    toggleClient,
    toggleAllClients,
    removeClient,
    restoreRemovedClients,
    persistCampaign,
    triggerSend,
  }
}
