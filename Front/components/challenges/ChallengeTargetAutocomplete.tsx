"use client"

import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

export type ChallengeTargetAutocompleteOption = {
  id: number | string
  label: string
  description?: string | null
}

export function ChallengeTargetAutocomplete({
  label,
  placeholder,
  emptyLabel,
  helperText,
  value,
  onChange,
  onSearch,
  inputClassName,
}: {
  label: string
  placeholder: string
  emptyLabel: string
  helperText?: string
  value: ChallengeTargetAutocompleteOption | null
  onChange: (value: ChallengeTargetAutocompleteOption | null) => void
  onSearch: (term: string) => Promise<ChallengeTargetAutocompleteOption[]>
  inputClassName?: string
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<ChallengeTargetAutocompleteOption[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const skipValueSyncRef = useRef(false)

  useEffect(() => {
    if (skipValueSyncRef.current) {
      skipValueSyncRef.current = false
      return
    }

    setQuery(value ? formatOption(value) : "")
  }, [value])

  useEffect(() => {
    const normalizedQuery = query.trim()
    const numericOnly = normalizedQuery.replace(/\D/g, "")
    const canSearch = Boolean(normalizedQuery) && (numericOnly.length > 0 || normalizedQuery.length >= 2)

    if (!canSearch) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    const timeoutId = window.setTimeout(() => {
      setLoading(true)
      setError(null)

      void onSearch(normalizedQuery)
        .then((items) => {
          if (!active) return
          setResults(items)
          setOpen(true)
        })
        .catch((searchError) => {
          if (!active) return
          setResults([])
          setError(searchError instanceof Error ? searchError.message : "Nao foi possivel buscar opcoes.")
          setOpen(true)
        })
        .finally(() => {
          if (!active) return
          setLoading(false)
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeoutId)
    }
  }, [onSearch, query])

  function handleInputChange(nextValue: string) {
    setQuery(nextValue)
    setOpen(true)

    if (value && nextValue !== formatOption(value)) {
      skipValueSyncRef.current = true
      onChange(null)
    }
  }

  function handleSelect(option: ChallengeTargetAutocompleteOption) {
    onChange(option)
    setQuery(formatOption(option))
    setResults([])
    setError(null)
    setOpen(false)
  }

  function handleClear() {
    onChange(null)
    setQuery("")
    setResults([])
    setError(null)
    setOpen(false)
  }

  const normalizedQuery = query.trim()
  const numericOnly = normalizedQuery.replace(/\D/g, "")
  const canSearch = Boolean(normalizedQuery) && (numericOnly.length > 0 || normalizedQuery.length >= 2)
  const shouldShowMenu = open && (loading || Boolean(error) || canSearch)

  return (
    <label className="block space-y-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">{label}</span>

      <div className="relative">
        <div className="relative">
          <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <Input
            value={query}
            onChange={(event) => handleInputChange(event.target.value)}
            onFocus={() => {
              if (canSearch || loading || results.length) {
                setOpen(true)
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setOpen(false), 140)
            }}
            className={`${inputClassName ?? ""} pl-12 pr-12`}
            placeholder={placeholder}
          />

          {query ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={handleClear}
              className="absolute right-4 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/58 transition hover:bg-white/10 hover:text-white"
              aria-label={`Limpar ${label}`}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <p className="mt-2 text-xs leading-6 text-white/44">
          {value ? `Selecionado: ${formatOption(value)}` : (helperText ?? "Busque por nome ou ID.")}
        </p>

        {shouldShowMenu ? (
          <div className="absolute left-0 right-0 z-30 mt-3 overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,13,24,0.98),rgba(15,23,42,0.98))] shadow-[0_24px_80px_rgba(2,6,23,0.34)]">
            {loading ? (
              <div className="flex items-center gap-3 px-4 py-4 text-sm text-white/70">
                <LoaderCircle className="h-4 w-4 animate-spin text-cyan-200" />
                Buscando opcoes...
              </div>
            ) : error ? (
              <div className="px-4 py-4 text-sm leading-6 text-rose-100">{error}</div>
            ) : results.length ? (
              <div className="max-h-72 overflow-y-auto p-2">
                {results.map((option) => (
                  <button
                    key={`${label}-${option.id}`}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleSelect(option)
                    }}
                    className="flex w-full flex-col items-start gap-1 rounded-[18px] px-4 py-3 text-left transition hover:bg-white/8"
                  >
                    <span className="text-sm font-semibold text-white">{formatOption(option)}</span>
                    {option.description ? (
                      <span className="text-xs leading-5 text-white/50">{option.description}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-4 py-4 text-sm leading-6 text-white/58">{emptyLabel}</div>
            )}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function formatOption(option: ChallengeTargetAutocompleteOption) {
  return [String(option.id ?? "").trim(), String(option.label ?? "").trim()].filter(Boolean).join(" - ")
}
