import { AlertTriangle } from "lucide-react"
import type * as React from "react"
import { useId } from "react"

import { FieldHelp } from "@/components/ui/field-help"
import { cn } from "@/lib/utils"

type ProseHelpProps = Readonly<{
  title: React.ReactNode
  children?: React.ReactNode | readonly string[]
  tone?: "note" | "warning"
  dataCy?: string
  className?: string
}>

function proseContent(children: ProseHelpProps["children"]): React.ReactNode {
  if (!Array.isArray(children)) return children || null
  const texts = (children as readonly string[]).filter(Boolean)
  if (texts.length === 0) return null
  return texts.map((text) => (
    <span key={text} className="block not-first:mt-2">
      {text}
    </span>
  ))
}

// A title with a `?`: the prose opens on hover, focus and tap. A warning keeps its title visible as a status.
export function ProseHelp({ title, children, tone = "note", dataCy, className }: ProseHelpProps) {
  const id = useId()
  const warning = tone === "warning"
  const content = proseContent(children)
  return (
    <div
      data-cy={dataCy}
      data-slot="prose-help"
      className={cn(
        "flex items-center gap-1.5 text-xs",
        warning
          ? "rounded-md bg-warning px-2 py-1.5 font-medium text-warning-foreground"
          : "text-muted-foreground",
        className,
      )}
    >
      {warning && <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />}
      <span className="min-w-0">{title}</span>
      {content && (
        <FieldHelp
          id={id}
          label={typeof title === "string" ? title : undefined}
          dataCy={dataCy ? `${dataCy}-help` : undefined}
          describeTrigger
          className={
            warning
              ? "text-warning-foreground hover:text-warning-foreground/80 data-[state=open]:text-warning-foreground"
              : undefined
          }
        >
          {content}
        </FieldHelp>
      )}
    </div>
  )
}
