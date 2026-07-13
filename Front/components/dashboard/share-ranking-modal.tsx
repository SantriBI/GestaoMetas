"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, Download, ImageOff, Loader2, MessageCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type CaptureStatus = "idle" | "capturing" | "ready" | "error"

interface ShareRankingModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  captureRef: React.RefObject<HTMLElement | null>
  fileNameHint: string
}

function canShareFiles(file: File) {
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean
    share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
  }
  return typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] })
}

export function ShareRankingModal({ open, onOpenChange, captureRef, fileNameHint }: ShareRankingModalProps) {
  const [status, setStatus] = useState<CaptureStatus>("idle")
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [whatsappNotice, setWhatsappNotice] = useState<string | null>(null)
  const blobRef = useRef<Blob | null>(null)

  async function capturar() {
    const alvo = captureRef.current
    if (!alvo) {
      setStatus("error")
      setErrorMessage("Nao foi possivel encontrar o conteudo do Grand Prix para capturar.")
      return
    }

    setStatus("capturing")
    setErrorMessage(null)
    setWhatsappNotice(null)

    try {
      const { default: html2canvas } = await import("html2canvas-pro")
      const canvas = await html2canvas(alvo, {
        backgroundColor: "#0b0f1a",
        scale: 2,
        useCORS: true,
        onclone: (clonedDoc) => {
          // O html2canvas-pro pode capturar um card no meio de uma keyframe CSS
          // (ex.: animate-fade-in-up do Podium) e renderiza-lo com opacidade/transform
          // errados, fazendo o card sumir na imagem mesmo a tela ao vivo estando correta.
          // Neutraliza animacoes so na copia usada pra gerar a imagem.
          const style = clonedDoc.createElement("style")
          style.textContent = `*, *::before, *::after { animation: none !important; transition: none !important; }`
          clonedDoc.head.appendChild(style)
        },
      })

      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"))
      if (!blob) {
        throw new Error("Falha ao gerar a imagem do ranking.")
      }

      blobRef.current = blob
      setImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      setStatus("ready")
    } catch (err) {
      console.error("Erro ao capturar ranking:", err)
      setStatus("error")
      setErrorMessage(err instanceof Error ? err.message : "Erro desconhecido ao gerar a imagem.")
    }
  }

  useEffect(() => {
    if (open) {
      void capturar()
    } else {
      setWhatsappNotice(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleBaixarImagem() {
    if (!imageUrl) return
    const a = document.createElement("a")
    a.href = imageUrl
    a.download = `${fileNameHint}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  async function handleEnviarWhatsapp() {
    if (!blobRef.current) return

    const file = new File([blobRef.current], `${fileNameHint}.png`, { type: "image/png" })
    const mensagem = "Confira o ranking do Grand Prix de Vendas!"

    if (canShareFiles(file)) {
      try {
        await (navigator as Navigator & { share: (data: { files: File[]; title?: string; text?: string }) => Promise<void> }).share({
          files: [file],
          title: "Grand Prix de Vendas",
          text: mensagem,
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        console.error("Erro ao compartilhar via Web Share API:", err)
      }
      return
    }

    handleBaixarImagem()
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer")
    setWhatsappNotice(
      "A imagem foi baixada e o WhatsApp Web foi aberto. Anexe a imagem baixada manualmente na conversa " +
        "— o WhatsApp Web nao permite anexar arquivos automaticamente por link."
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-violet-400/20 bg-[#0b0f1a] text-slate-50 sm:rounded-[24px]">
        <DialogHeader>
          <DialogTitle className="text-white">Baixar ranking do Grand Prix</DialogTitle>
          <DialogDescription>
            Gere uma imagem do podio e do pelotao para baixar ou compartilhar no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {status === "capturing" ? (
            <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-300">
              <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
              Capturando o ranking...
            </div>
          ) : status === "error" ? (
            <div className="flex flex-col items-center gap-3 py-10 px-4 text-center text-sm text-slate-300">
              <ImageOff className="h-6 w-6 text-red-400" />
              <span>{errorMessage ?? "Nao foi possivel gerar a imagem."}</span>
              <button
                type="button"
                onClick={() => void capturar()}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                Tentar novamente
              </button>
            </div>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Preview do ranking do Grand Prix" className="max-h-[420px] w-full object-contain" />
          ) : null}
        </div>

        {whatsappNotice ? (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 p-3 text-xs text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{whatsappNotice}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleBaixarImagem}
            disabled={status !== "ready"}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download className="h-4 w-4" />
            Baixar imagem
          </button>
          <button
            type="button"
            onClick={() => void handleEnviarWhatsapp()}
            disabled={status !== "ready"}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar no WhatsApp
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
