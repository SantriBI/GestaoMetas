# Responsividade total do Front (SIP/GestaoMetas)

## Contexto e objetivo

O sistema tem hoje 20 páginas em `Front/app/` e mais de 150 componentes. 89 dos 153 arquivos `.tsx` já usam classes responsivas do Tailwind (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`), mas de forma inconsistente entre telas — cada página resolveu layout, grid, tabelas e tipografia à sua maneira.

Objetivo: tornar **todo** o `Front/` extremamente responsivo, de celulares pequenos (~360px) até monitores grandes (~2560px), sem exceção de tela, com um padrão consistente em vez de ajustes pontuais desencontrados. `Back/` e `qa-agent/` estão fora de escopo (não são UI).

## Escala de breakpoints e containers

- Mantém os breakpoints padrão do Tailwind já em uso: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px. Não introduz breakpoints customizados — trocar a escala quebraria consistência com o que já existe em 89 arquivos.
- O estado base (sem prefixo) é o mobile mínimo (~360px), seguindo mobile-first.
- Telas muito grandes (até ~2560px) não ganham breakpoint novo: o conteúdo fica dentro de containers com `max-width` centralizado (padrão já usado em `AppShellNav` com `max-w-[1800px]`), evitando esticar layout em monitores ultrawide.

## Padrões reutilizáveis (Fase 0 — fundação)

Antes de tocar página por página, criar/consolidar os seguintes padrões em `Front/components/layout/` e/ou `Front/lib/`:

1. **Container de página**: largura máxima e padding horizontal padronizados por tipo de tela (dashboards largos vs. formulários/telas de detalhe mais estreitas). Onde já existe um padrão razoável (ex.: `max-w-6xl`, `max-w-[1800px]` em páginas atuais), documentar e reaproveitar em vez de recriar.
2. **Grid de cards/KPIs**: escala padrão `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-3` ou `4`, com gap consistente entre breakpoints.
3. **Padrão tabela → card no mobile**: abaixo de `md` (ou `lg`, conforme a densidade de colunas), tabelas de dados viram cards empilhados em vez de manter tabela com scroll horizontal quebrado. Isso deve virar um padrão/componente reaproveitável, não uma solução por página.
4. **Alvo de toque**: interativos (botões, links de navegação, ícones clicáveis) com no mínimo 44×44px de área tocável em larguras de mobile.
5. **Escala tipográfica**: tamanhos de heading/corpo padronizados por breakpoint (já há precedente disso em `gerente-sistemas/page.tsx`, generalizar esse padrão).
6. **Shell de navegação**: revisar `AppShellNav` e `MobileTabBar` (já ajustados recentemente para paridade de papel efetivo do gerente de sistemas) nos extremos de largura — 360px não pode quebrar logo/perfil/hambúrguer, e 2560px não pode esticar a nav de forma estranha.

## Verificação

Para cada página/módulo, após o ajuste:
- Subir `Front` localmente (`npm run dev`).
- Verificar visualmente via navegador (Chrome DevTools / ferramentas de browser disponíveis) nas larguras: 360, 480, 768, 1024, 1440, 1920 e 2560px.
- Checar: ausência de overflow horizontal, ausência de sobreposição de elementos, texto não cortado/truncado indevidamente, alvo de toque adequado no mobile, legibilidade em telas grandes.
- Páginas que dependem de dados do Oracle (indisponível neste ambiente de desenvolvimento) serão verificadas nos estados de loading/vazio/erro alcançáveis; qualquer layout que não puder ser confirmado com dados reais será reportado explicitamente como limitação.

## Fases e ordem dos módulos

Ordem definida por prioridade de uso diário do negócio:

- **Fase 0 — Fundação**: padrões reutilizáveis acima + revisão do shell de navegação (`AppShellNav`, `MobileTabBar`, `nav-items.ts`).
- **Fase 1**: `dashboard` (gerente) e `vendedor` (telas de uso diário mais crítico).
- **Fase 2**: `area-ataque`, `investigar-cliente`, `ativacao-clientes`.
- **Fase 3**: `feed`, `perfil`, `desafios` (+ `vendedor/desafios`), `vendedor/kanban`, `vendedor/minha-meta-de-vida`.
- **Fase 4**: `admin`, `admin/organizacoes`, `gerente-sistemas`, `industria`, `usuarios`.
- **Fase 5**: `login`, `page.tsx` (landing), `como-funciona`, `alterar-senha`.

Cada fase: auditar os arquivos do módulo contra os padrões da Fase 0, ajustar, verificar nos breakpoints listados, e então seguir para a próxima fase. Progresso é reportado fase a fase; nenhuma fase é considerada concluída sem a verificação visual descrita acima.

## Fora de escopo

- `Back/` (API/backend) — não é UI.
- `qa-agent/` — suíte de testes separada do produto.
- Reescrita do sistema de temas/cores (dark/light) — só responsividade, não redesign visual.
- Novos breakpoints customizados além dos já usados pelo Tailwind.
