"use client"

import { useCallback, useEffect, useState } from "react"
import {
  acceptSellerChallenge,
  ChallengeApiError,
  closeChallenge,
  createChallenge,
  declineSellerChallenge,
  fetchChallengeDetails,
  fetchSellerChallengeAlert,
  fetchChallengeMetadata,
  fetchChallengeSetup,
  fetchChallenges,
  fetchSellerChallengeDetail,
  fetchSellerChallenges,
  type Challenge,
  type ChallengeFormPayload,
  type ChallengeImpactPreviewResponse,
  type ChallengeMetadata,
  type ChallengeModuleSetup,
  type SellerChallengeAlertResponse,
  type ChallengesResponse,
  previewChallengeImpact,
  updateChallenge,
} from "@/lib/challenges"

export function useManagerChallenges() {
  const [data, setData] = useState<ChallengesResponse | null>(null)
  const [metadata, setMetadata] = useState<ChallengeMetadata | null>(null)
  const [setup, setSetup] = useState<ChallengeModuleSetup | null>(null)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function updateSetupFromError(err: unknown) {
    if (!(err instanceof ChallengeApiError) || err.code !== "CHALLENGES_TABLES_MISSING") return

    const details = (err.details ?? {}) as Record<string, unknown>
    setSetup((current) => ({
      ready: false,
      code: err.code,
      error: err.message,
      missingTables: Array.isArray(details.missingTables) ? details.missingTables.map(String) : current?.missingTables ?? [],
      missingSequences: Array.isArray(details.missingSequences) ? details.missingSequences.map(String) : current?.missingSequences ?? [],
      scriptPath: typeof details.scriptPath === "string" ? details.scriptPath : current?.scriptPath ?? null,
      sqlScript: current?.sqlScript ?? null,
      instructions: Array.isArray(details.instructions) ? details.instructions.map(String) : current?.instructions ?? [],
    }))
  }

  function clearActionError() {
    setActionError(null)
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [challenges, challengeMetadata, challengeSetup] = await Promise.all([
        fetchChallenges(),
        fetchChallengeMetadata(),
        fetchChallengeSetup(),
      ])
      setData(challenges)
      setMetadata(challengeMetadata)
      setSetup(challengeSetup)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar desafios.")
    } finally {
      setLoading(false)
    }
  }, [])

  const openDetails = useCallback(async (id: number | string) => {
    const detail = await fetchChallengeDetails(id)
    setSelectedChallenge(detail)
    return detail
  }, [])

  const saveChallenge = useCallback(async (payload: ChallengeFormPayload, id?: number | string) => {
    setSaving(true)
    try {
      const challenge = id ? await updateChallenge(id, payload) : await createChallenge(payload)
      await refresh()
      setSelectedChallenge(challenge)
      setActionError(null)
      return challenge
    } catch (err) {
      updateSetupFromError(err)
      setActionError(err instanceof Error ? err.message : "Erro ao salvar desafio.")
      return null
    } finally {
      setSaving(false)
    }
  }, [refresh])

  const endChallenge = useCallback(async (id: number | string) => {
    setSaving(true)
    try {
      const challenge = await closeChallenge(id, "ENCERRADO")
      await refresh()
      setSelectedChallenge(challenge)
      setActionError(null)
      return challenge
    } catch (err) {
      updateSetupFromError(err)
      setActionError(err instanceof Error ? err.message : "Erro ao encerrar desafio.")
      return null
    } finally {
      setSaving(false)
    }
  }, [refresh])

  const cancelChallenge = useCallback(async (id: number | string) => {
    setSaving(true)
    try {
      const challenge = await closeChallenge(id, "CANCELADO")
      await refresh()
      setSelectedChallenge(challenge)
      setActionError(null)
      return challenge
    } catch (err) {
      updateSetupFromError(err)
      setActionError(err instanceof Error ? err.message : "Erro ao cancelar desafio.")
      return null
    } finally {
      setSaving(false)
    }
  }, [refresh])

  const estimateImpact = useCallback(async (payload: ChallengeFormPayload): Promise<ChallengeImpactPreviewResponse | null> => {
    try {
      const preview = await previewChallengeImpact(payload)
      setActionError(null)
      return preview
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Erro ao estimar impacto do desafio.")
      return null
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    data,
    metadata,
    setup,
    selectedChallenge,
    setSelectedChallenge,
    loading,
    saving,
    error,
    actionError,
    clearActionError,
    refresh,
    openDetails,
    saveChallenge,
    endChallenge,
    cancelChallenge,
    estimateImpact,
  }
}

export function useSellerChallenges(skVendedor?: number | string | null) {
  const [data, setData] = useState<ChallengesResponse | null>(null)
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!skVendedor) {
      setData(null)
      setSelectedChallenge(null)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const allChallenges = await fetchSellerChallenges(skVendedor, "all")
      setData(allChallenges)
      setSelectedChallenge((current) =>
        current && !allChallenges.items.some((challenge) => String(challenge.id) === String(current.id)) ? null : current
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar desafios.")
    } finally {
      setLoading(false)
    }
  }, [skVendedor])

  const openDetails = useCallback(async (id: number | string) => {
    if (!skVendedor) return null
    try {
      const detail = await fetchSellerChallengeDetail(skVendedor, id)
      setSelectedChallenge(detail)
      setError(null)
      return detail
    } catch (err) {
      const isMissingChallenge = err instanceof ChallengeApiError && err.status === 404

      if (isMissingChallenge) {
        await refresh()
      }

      setSelectedChallenge((current) => (current && String(current.id) === String(id) ? null : current))
      setError(
        isMissingChallenge
          ? "Esse desafio nao esta mais disponivel. Atualizamos a lista para remover o atalho antigo."
          : err instanceof Error
            ? err.message
            : "Erro ao carregar detalhes do desafio."
      )
      return null
    }
  }, [refresh, skVendedor])

  const acceptChallenge = useCallback(async (id: number | string) => {
    if (!skVendedor) return null
    setActing(true)
    try {
      const accepted = await acceptSellerChallenge(id, skVendedor)
      await refresh()
      setError(null)
      setSelectedChallenge(accepted)
      return accepted
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar desafio.")
      return null
    } finally {
      setActing(false)
    }
  }, [refresh, skVendedor])

  const dismissChallenge = useCallback(async (id: number | string) => {
    if (!skVendedor) return false
    setActing(true)
    try {
      await declineSellerChallenge(id, skVendedor)
      setSelectedChallenge((current) => (current && String(current.id) === String(id) ? null : current))
      await refresh()
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recusar desafio.")
      return false
    } finally {
      setActing(false)
    }
  }, [refresh, skVendedor])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data, selectedChallenge, setSelectedChallenge, loading, acting, error, refresh, openDetails, acceptChallenge, dismissChallenge }
}

export function useSellerChallengeAlert(skVendedor?: number | string | null) {
  const [alert, setAlert] = useState<SellerChallengeAlertResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!skVendedor) {
      setAlert(null)
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const response = await fetchSellerChallengeAlert(skVendedor)
      setAlert(response)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao verificar novos desafios.")
    } finally {
      setLoading(false)
    }
  }, [skVendedor])

  const acceptAlert = useCallback(async () => {
    if (!skVendedor || !alert?.challenge?.id) return null
    setActing(true)
    try {
      const accepted = await acceptSellerChallenge(alert.challenge.id, skVendedor)
      setAlert({ hasNewChallenge: false, challenge: null, mock: false })
      setError(null)
      return accepted
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar desafio.")
      return null
    } finally {
      setActing(false)
    }
  }, [alert?.challenge?.id, skVendedor])

  const dismissAlert = useCallback(async () => {
    if (!skVendedor || !alert?.challenge?.id) return false
    setActing(true)
    try {
      await declineSellerChallenge(alert.challenge.id, skVendedor)
      setAlert({ hasNewChallenge: false, challenge: null, mock: false })
      setError(null)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recusar desafio.")
      return false
    } finally {
      setActing(false)
    }
  }, [alert?.challenge?.id, skVendedor])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { alert, loading, acting, error, refresh, acceptAlert, dismissAlert }
}
