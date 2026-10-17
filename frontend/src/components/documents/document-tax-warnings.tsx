import { useTranslation } from "react-i18next"

import { ProseHelp } from "@/components/ui/prose-help"
import { useDocumentTaxWarnings } from "@/hooks/queries"

interface DocumentTaxWarningsProps {
  warnings: string[]
}

// The caveats change the amounts above, so the status stays visible; the server's prose opens behind its `?`.
export function DocumentTaxWarnings({ warnings }: DocumentTaxWarningsProps) {
  const { t } = useTranslation()

  if (warnings.length === 0) return null

  return (
    <ProseHelp
      tone="warning"
      title={t("documents.totals.taxWarningsTitle")}
      dataCy="document-tax-warnings"
      className="mt-3"
    >
      {warnings}
    </ProseHelp>
  )
}

interface DocumentTaxWarningsSectionProps {
  typeId: string
  documentId: string
}

// No skeleton and no error branch: the totals card looks the same until there is something to warn about.
export function DocumentTaxWarningsSection({ typeId, documentId }: DocumentTaxWarningsSectionProps) {
  const { data } = useDocumentTaxWarnings(typeId, documentId)
  return <DocumentTaxWarnings warnings={data?.warnings ?? []} />
}
