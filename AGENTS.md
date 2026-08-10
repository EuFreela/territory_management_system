# Padrões do projeto

## UI (shadcn/ui)

- Kit shadcn/ui com Tailwind v4 (tailwindcss + tw-animate-css + shadcn/tailwind.css).
- Fonte Geist; tema neutro (`bg-background`, `text-foreground`); suporte a dark mode via `.dark`.
- Textos da interface sempre em PT-BR.
- Componentes shadcn em `src/components/ui/*` (adicionar via `npx shadcn@latest add ...`).
- Páginas: container `mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-10`.
- Cabeçalho de página: eyebrow `text-sm font-medium text-muted-foreground`, h1
  `text-[1.75rem] font-semibold tracking-tight sm:text-[2rem]`, subtítulo
  `mt-1 text-[15px] leading-relaxed text-muted-foreground`.

## Abas (padrão obrigatório)

Não usar o componente `Tabs` do shadcn. Usar controle segmentado próprio
(pill `rounded-full` com `bg-muted p-1`, aba ativa `bg-background text-foreground
shadow-sm`, inativa `text-muted-foreground hover:text-foreground`, botões `h-8`).

Exemplo (ver `FinishedTerritoriesPage`).

## Scrollbar de tabela (padrão obrigatório)

Tabelas usam o container shadcn `[data-slot='table-container']`. A scrollbar é
fina (horizontal 6px, vertical 8px), trilha transparente e thumb arredondado
com `--border` (hover `--muted-foreground`), WebKit + Firefox. Regras já estão
no `index.css` — não alterar.
