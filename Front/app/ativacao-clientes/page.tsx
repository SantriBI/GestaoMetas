"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import { AppShellNav } from "@/components/layout/AppShellNav"
import { getStoredUser, setStoredUser, type AuthUser } from "@/lib/user-session"
import { useActivationWizard } from "@/hooks/useActivationWizard"
import {
  ActivationStepper,
  MessageStep,
  PreviewStep,
  SegmentStep,
  SendStep,
} from "@/components/ativacao-clientes"

export default function AtivacaoClientesPage() {
  const router = useRouter()
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const user = getStoredUser()

    if (!user) {
      router.push("/login")
      return
    }

    if (user.role === "INDUSTRIA") {
      router.push("/industria")
      return
    }

    setStoredUser(user)
    setAuthUser(user)
  }, [router])

  const scope = useMemo(
    () =>
      authUser
        && authUser.role !== "INDUSTRIA"
        ? {
            role: authUser.role,
            sk_vendedor: authUser.sk_vendedor ?? null,
            empresa_id: authUser.empresa_id ?? authUser.sk_empresa ?? null,
          }
        : null,
    [authUser]
  )

  const wizard = useActivationWizard(scope)
  const selectedSegmentLabel =
    wizard.segments.find((segment) => segment.id === wizard.selectedSegment)?.titulo ?? "Segmento"

  function openLink(link: string) {
    window.open(link, "_blank", "noopener,noreferrer")
  }

  function openAllLinks() {
    wizard.selectedClients.forEach((client, index) => {
      if (!client.whatsapp_link) return
      window.setTimeout(() => {
        openLink(client.whatsapp_link as string)
      }, index * 120)
    })
  }

  function handleSegmentBack() {
    if (window.history.length > 1) {
      router.back()
      return
    }

    if (authUser?.role === "VENDEDOR") {
      router.push("/vendedor")
      return
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <AppShellNav user={authUser} />

      <main className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        <div className="space-y-6">
          <ActivationStepper currentStep={wizard.currentStep} />

          {wizard.error ? (
            <section className="rounded-[24px] border border-amber-500/20 bg-amber-500/8 p-5 text-amber-50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-semibold">Falha ao montar a Central de Ativação</p>
                  <p className="mt-1 text-sm text-amber-50/76">{wizard.error}</p>
                </div>
              </div>
            </section>
          ) : null}

          {wizard.currentStep === 0 ? (
            <SegmentStep
              segments={wizard.segments}
              segmentSummaries={wizard.segmentSummaries}
              selectedSegment={wizard.selectedSegment}
              onSelect={wizard.setSelectedSegment}
              onContinue={wizard.goToNextStep}
              onBack={handleSegmentBack}
              isLoading={wizard.isBootLoading}
            />
          ) : null}

          {wizard.currentStep === 1 ? (
            <MessageStep
              templates={wizard.templates}
              selectedTemplateId={wizard.selectedTemplateId}
              message={wizard.message}
              sampleClient={wizard.sampleClient}
              onTemplateSelect={wizard.applyTemplate}
              onMessageChange={wizard.setMessage}
              onBack={wizard.goToPreviousStep}
              onContinue={wizard.goToNextStep}
            />
          ) : null}

          {wizard.currentStep === 2 ? (
            <PreviewStep
              summary={wizard.summary}
              clients={wizard.previewClients}
              selectedIds={wizard.selectedClientIds}
              search={wizard.search}
              isLoading={wizard.isPreviewLoading}
              onSearchChange={wizard.setSearch}
              onToggle={wizard.toggleClient}
              onToggleAll={wizard.toggleAllClients}
              onRemove={wizard.removeClient}
              onBack={wizard.goToPreviousStep}
              onContinue={wizard.goToNextStep}
            />
          ) : null}

          {wizard.currentStep === 3 ? (
            <SendStep
              segmentLabel={selectedSegmentLabel}
              selectedCount={wizard.selectedClients.length}
              message={wizard.message}
              clients={wizard.selectedClients}
              onBack={wizard.goToPreviousStep}
              onOpenAll={openAllLinks}
              onConfirm={() => {
                void wizard.triggerSend()
              }}
              onTestLink={openLink}
              isBusy={wizard.isPersisting}
              lastCampaignId={wizard.lastCampaignId}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}
