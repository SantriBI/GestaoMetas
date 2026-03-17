"use client"

import { useMemo, useState } from "react"
import { ActivationScope } from "@/lib/activation-types"
import { useActivationCampaign } from "@/hooks/useActivationCampaign"

const LAST_STEP = 3

export function useActivationWizard(scope: ActivationScope | null) {
  const campaign = useActivationCampaign(scope)
  const [currentStep, setCurrentStep] = useState(0)

  const canContinue = useMemo(() => {
    if (currentStep === 0) return Boolean(campaign.selectedSegment)
    if (currentStep === 1) return Boolean(campaign.message.trim())
    if (currentStep === 2) return campaign.selectedClients.length > 0
    return false
  }, [campaign.message, campaign.selectedClients.length, campaign.selectedSegment, currentStep])

  function goToNextStep() {
    setCurrentStep((step) => Math.min(step + 1, LAST_STEP))
  }

  function goToPreviousStep() {
    setCurrentStep((step) => Math.max(step - 1, 0))
  }

  function goToStep(step: number) {
    setCurrentStep(Math.max(0, Math.min(step, LAST_STEP)))
  }

  return {
    ...campaign,
    currentStep,
    canContinue,
    goToNextStep,
    goToPreviousStep,
    goToStep,
  }
}
