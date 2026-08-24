# Resumo para Landing Page (MATCON)

> Documento gerado para alimentar a criacao de um prompt para v0.dev. Baseado na analise estatica do repositorio `GestaoMetas` em 2026-08-13. Informacoes nao encontradas no projeto estao marcadas explicitamente.

## 1. Nome do produto

- **Nome oficial no codigo**: SIP - Gestao de Metas (titulo em `Front/app/layout.tsx`: `"SIP - Gestão de Metas"`, descricao `"Sistema de Performance de Vendedores"`).
- **Apelido/nome curto**: SIP.
- Nao ha, no repositorio, um nome de marca comercial diferente de "SIP" (ex.: nenhum arquivo menciona um nome de venda distinto). O logo em `Front/public/logo sip 2.0.svg` confirma a marca "SIP 2.0".

## 2. Descricao comercial (curta)

O SIP transforma dados de vendas dispersos em um painel unico de performance comercial, mostrando em tempo real quem esta batendo meta, onde existe oportunidade e quais clientes merecem atencao agora. Gerentes acompanham o time com ranking, podio de premiacao e alertas; vendedores acompanham a propria meta, carteira e pipeline de clientes em um so lugar. O resultado e mais engajamento do time de vendas e decisões mais rapidas, sem depender de planilhas manuais.

## 3. Principais funcionalidades

- Ranking de vendas mensal e diario, com comparativo automatico contra o mes e o ano anterior.
- "Grand Prix" gamificado: podio de campeoes por periodo, com compartilhamento de imagem via WhatsApp.
- Area de ataque comercial (RFV) para identificar clientes com maior potencial de recompra.
- Investigacao de cliente por CPF/CNPJ/nome, com historico e indicadores.
- CRM em formato Kanban para o vendedor, sincronizado automaticamente com orcamentos e pedidos.
- Desafios, campanhas e premiacao por metas, com parametrizacao por grupo/equipe.
- Feed interno de equipe (posts, curtidas, comentarios) e central de ativacao de clientes com templates prontos para WhatsApp.
- Suporte a multiplas organizacoes/empresas (multi-tenant), com escopo por loja para gerentes.

## 4. Paleta de cores

O projeto usa Tailwind CSS 4 com tokens de tema definidos em `Front/styles/theme.css` e `Front/app/globals.css`. A aplicacao roda **forcada em modo escuro** (`Front/app/layout.tsx`: `className="dark"`, `forcedTheme="dark"`), entao o tema dark e o que representa o produto na pratica; o tema claro existe no CSS mas nao e usado por padrao.

### Tema escuro (o que o produto realmente usa)
| Papel | Variavel | Valor | Onde e usado |
|---|---|---|---|
| Fundo principal | `--background` | `hsl(224 34% 7%)` (~`#0a0e17`) | Fundo geral do app (`bg-background` em `body`) |
| Texto principal | `--foreground` | `hsl(210 20% 98%)` (~`#f6f8fa`) | Texto padrao (`text-foreground`) |
| Cor primaria | `--primary` | `hsl(145 70% 42%)` (~`#20b567`, verde) | Botoes principais, icones de destaque, `text-primary`, `border-primary` |
| Cor de destaque/acao | `--accent` | `hsl(152 62% 48%)` (~`#2fce7f`, verde) | Elementos de acao/hover |
| Sucesso (usado como cor de "acao positiva" em varios lugares) | `--success` | `hsl(142 70% 45%)` (~`#22c55e`) | Valores de receita, barras de progresso, indicadores "OK" (ex.: `ranking-table.tsx`) |
| Cor secundaria | `--secondary` | `hsl(221 28% 15%)` (~`#1b2130`) | Fundos de card secundarios, botoes leves |
| Card/fundo de superficie | `--card` | `hsl(222 28% 10%)` (~`#131722`) | Cards, tabelas, paineis |
| Borda | `--border` | `hsl(221 24% 20%)` (~`#2b3346`) | Bordas de card, tabela, divisorias |
| Destrutivo/erro | `--destructive` | `hsl(0 72% 51%)` (~`#dc2626`) | Erros, valores negativos, badges de risco |
| Aviso | `--warning` | `hsl(38 92% 50%)` (~`#f59e0b`) | Alertas |
| Texto mutado | `--muted-foreground` | `hsl(216 18% 67%)` (~`#94a3b8`) | Labels secundarias, legendas |

Cores auxiliares de "shell"/fundo com gradiente (usadas em telas de destaque, ex.: fundo animado):
- `--shell-bg` (dark): `linear-gradient(180deg, #060910 0%, #0a1020 100%)`
- `--shell-border` (dark): `rgba(74, 222, 128, 0.16)` (verde translucido)

### Tema claro (definido no CSS, mas nao ativado por padrao no app)
| Papel | Variavel | Valor |
|---|---|---|
| Fundo | `--background` | `hsl(210 40% 98%)` |
| Primaria | `--primary` | `hsl(145 65% 36%)` (verde) |
| Accent | `--accent` | `hsl(145 58% 42%)` (verde) |
| Texto | `--foreground` | `hsl(222 47% 11%)` |

**Conclusao de paleta**: a identidade visual do produto e **fundo escuro (quase preto-azulado) + verde como cor de marca/acao** (tom entre `#20b567` e `#22c55e`), com toques de amarelo/laranja/vermelho reservados para alertas, avisos e erros. Nao ha uma cor "secundaria" de marca alem do verde — o roxo/azul aparecem apenas em tokens de sidebar do tema claro, que nao e usado.

## 5. Tipografia

- Fonte principal: **Space Grotesk** (`Front/app/layout.tsx`, via `next/font/google`, aplicada no `body` inteiro).
- Fonte monoespacada: **Geist Mono** (usada para trechos tecnicos/numeros, conforme `--font-mono` em `globals.css`).
- Fallback declarado no Tailwind: `"Space Grotesk", "Geist", sans-serif`.

## 6. Componente visual de destaque

### Componente escolhido: Podio de Campeoes ("Grand Prix")
Arquivo: `Front/components/dashboard/podium.tsx`

```tsx
"use client"

import { Crown, Flag, Trophy } from "lucide-react"
import { VendedorProcessado, formatCurrency } from "@/lib/types"

interface PodiumProps {
  vendedores: VendedorProcessado[]
  viewMode?: "mensal" | "diario"
}

export function Podium({ vendedores, viewMode = "mensal" }: PodiumProps) {
  const sorted = [...vendedores].sort((a, b) => b.percentual - a.percentual)
  const top3 = sorted.slice(0, 3)

  if (top3.length < 3) return null

  const displayOrder = [top3[1], top3[0], top3[2]]

  const medals = [
    {
      position: "2",
      gradient: "from-slate-400 to-slate-500",
      border: "border-slate-400/50",
      bgGradient: "from-slate-400/10 to-transparent",
      shadow: "shadow-slate-400/20",
      standHeight: "h-20",
    },
    {
      position: "1",
      gradient: "from-amber-400 to-amber-600",
      border: "border-amber-400/60",
      bgGradient: "from-amber-400/15 to-transparent",
      shadow: "shadow-amber-400/30",
      standHeight: "h-28",
      isGold: true,
    },
    {
      position: "3",
      gradient: "from-orange-500 to-orange-700",
      border: "border-orange-500/50",
      bgGradient: "from-orange-500/10 to-transparent",
      shadow: "shadow-orange-500/20",
      standHeight: "h-16",
    },
  ]

  return (
    <div className="mb-8">
      <div className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
          <Flag className="h-3.5 w-3.5" />
          Grid principal
        </div>
        <div className="flex items-center justify-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h3 className="text-center font-semibold text-slate-300">
            Podio dos Campeoes - {viewMode === "diario" ? "Diario" : "Mensal"}
          </h3>
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-center">
        {displayOrder.map((vendedor, i) => {
          const medal = medals[i]

          return (
            <div
              key={vendedor.id}
              className="flex flex-col items-center animate-fade-in-up"
              style={{ animationDelay: `${i * 0.2}s` }}
            >
              <div
                className={`relative mb-3 w-full max-w-[18rem] overflow-hidden rounded-[24px] border-2 bg-[#07111c] bg-gradient-to-b p-4 shadow-xl transition-transform hover:-translate-y-1 hover:scale-[1.02] sm:w-52 ${medal.bgGradient} ${medal.border} ${medal.shadow}`}
              >
                {medal.isGold ? (
                  <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute left-[-100%] top-0 h-full w-full animate-shimmer bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
                  </div>
                ) : null}

                <div className="flex items-center gap-3">
                  <div className={`relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${medal.gradient} text-sm font-bold text-white shadow-lg`}>
                    {medal.isGold ? (
                      <Crown className="absolute -top-3.5 left-1/2 h-5 w-5 -translate-x-1/2 text-amber-400" />
                    ) : null}
                    {medal.position}o
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-white">{vendedor.nome}</h4>
                    <div className="font-bold text-primary">{formatCurrency(vendedor.receita)}</div>
                    <div className="text-xs text-slate-400">{vendedor.percentual}% da meta</div>
                  </div>
                </div>
              </div>

              <div
                className={`flex w-16 items-center justify-center rounded-t-lg bg-gradient-to-b text-xl font-bold text-white shadow-lg sm:w-20 ${medal.gradient} ${medal.standHeight}`}
              >
                {medal.position}o
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Por que e um bom exemplo visual**: e um componente gamificado e unico (tema de corrida/"Grand Prix" com podio, medalhas em ouro/prata/bronze e efeito de brilho no 1o lugar) que comunica em segundos a proposta de valor emocional do produto — reconhecimento e competicao saudavel entre vendedores — algo que uma tabela comum nao transmite.

### Componente secundario: Tabela de ranking (`Front/components/dashboard/ranking-table.tsx`)
Nao copiado por extenso aqui (arquivo grande, ~430 linhas), mas vale citar como segunda referencia visual: tabela responsiva com badges de status, barra de progresso de meta (`bg-success`) e setas de variacao percentual (`ArrowUp`/`ArrowDown` coloridas em verde/vermelho) — mostra bem a leitura rapida de performance por vendedor.

## 7. Print ou referencia visual

Nao ha screenshots reais do produto em uso (ex.: prints de tela) na pasta do projeto. O que existe em `Front/public/` sao apenas assets de marca/banners, nao capturas de tela do app:

- `Front/public/logo sip 2.0.svg` — logo oficial do produto.
- `Front/public/Logo Santri White.png` — logo da empresa/marca associada (Santri).
- `Front/public/BannerDesafio.png` — banner promocional (desafios).
- `Front/public/BannerDesafioGeral.png` — banner promocional (desafio geral).
- `Front/public/BannerIndustria.png` — banner do modulo "Industria".
- `Front/public/icons/icon-512.png`, `icon-192.png`, `icon-512-maskable.png` — icones de PWA.

Nao foi encontrado nenhum print de tela real (dashboard, ranking, etc.) no repositorio. Se a landing precisar de uma imagem do produto em uso, sera necessario gerar um screenshot rodando a aplicacao localmente ou usar o proprio componente de podio/ranking renderizado como referencia visual.