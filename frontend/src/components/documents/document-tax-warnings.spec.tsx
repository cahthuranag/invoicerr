import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DocumentTaxWarnings, DocumentTaxWarningsSection } from "./document-tax-warnings"

// The warning texts are what the backend engine emits, verbatim (documents.service.tax-warnings.spec.ts).
vi.mock("@/hooks/queries", () => ({
  useDocumentTaxWarnings: vi.fn(),
}))

import { useDocumentTaxWarnings } from "@/hooks/queries"

const mockedUseDocumentTaxWarnings = vi.mocked(useDocumentTaxWarnings)

const UNCONFIRMED_VAT_WARNING =
  'Buyer VAT number "DE136695976" has not been confirmed valid yet (status: not checked), so this ' +
  "buyer is treated as B2C until it is verified, never a silent B2B."

const OSS_STANDARD_RATE_WARNING =
  "This invoice is an intra-Community distance sale taxed in DE (EU One-Stop-Shop, Directive " +
  "2006/112/EC art. 33(a)), so DE's STANDARD VAT rate (19%) was applied. DE's own reduced rates are " +
  "not modelled here and an invoice line carries nothing that says which products they cover. " +
  "Check the destination rate yourself if what you are selling is reduced-rated there, or this " +
  "invoice over-charges the customer."

describe("<DocumentTaxWarnings>: what the seller reads next to the amounts", () => {
  it("shows a one-line warning status, the explanation stays behind its help button", () => {
    render(<DocumentTaxWarnings warnings={[UNCONFIRMED_VAT_WARNING]} />)

    const status = screen.getByTestId("document-tax-warnings")
    expect(status).toHaveClass("bg-warning")
    expect(screen.getByText("Check how VAT was applied")).toBeVisible()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the unconfirmed-VAT warning in full, so the reader learns the sale was taxed as B2C", () => {
    render(<DocumentTaxWarnings warnings={[UNCONFIRMED_VAT_WARNING]} />)
    fireEvent.click(screen.getByTestId("document-tax-warnings-help-trigger"))

    expect(screen.getByRole("dialog")).toHaveTextContent("has not been confirmed valid yet")
    expect(screen.getByRole("dialog")).toHaveTextContent("treated as B2C")
  })

  it("opens every warning when the engine records several", () => {
    render(<DocumentTaxWarnings warnings={[UNCONFIRMED_VAT_WARNING, OSS_STANDARD_RATE_WARNING]} />)
    fireEvent.click(screen.getByTestId("document-tax-warnings-help-trigger"))

    const popover = screen.getByRole("dialog")
    expect(popover).toHaveTextContent("STANDARD VAT rate (19%)")
    expect(popover).toHaveTextContent("over-charges the customer")
    expect(popover).toHaveTextContent("has not been confirmed valid yet")
  })

  it("renders NOTHING for a document with no caveat: no panel, no title, no empty state", () => {
    const { container } = render(<DocumentTaxWarnings warnings={[]} />)

    expect(screen.queryByTestId("document-tax-warnings")).not.toBeInTheDocument()
    expect(screen.queryByText("Check how VAT was applied")).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })
})

describe("<DocumentTaxWarningsSection>: the fetching half, wired to the endpoint", () => {
  afterEach(() => vi.resetAllMocks())

  function answer(warnings: string[] | undefined) {
    mockedUseDocumentTaxWarnings.mockReturnValue({
      data: warnings === undefined ? undefined : { warnings },
    } as ReturnType<typeof useDocumentTaxWarnings>)
  }

  it("asks for THIS document's warnings and renders what comes back", () => {
    answer([OSS_STANDARD_RATE_WARNING])
    render(<DocumentTaxWarningsSection typeId="invoice" documentId="doc-1" />)

    expect(mockedUseDocumentTaxWarnings).toHaveBeenCalledWith("invoice", "doc-1")
    fireEvent.click(screen.getByTestId("document-tax-warnings-help-trigger"))
    expect(screen.getByRole("dialog")).toHaveTextContent("STANDARD VAT rate (19%)")
  })

  it("a document whose tax resolution produced no caveat leaves the totals card untouched", () => {
    answer([])
    const { container } = render(<DocumentTaxWarningsSection typeId="invoice" documentId="doc-1" />)

    expect(container).toBeEmptyDOMElement()
  })

  it("renders nothing at all before the answer arrives", () => {
    answer(undefined)
    const { container } = render(<DocumentTaxWarningsSection typeId="quote" documentId="doc-2" />)

    expect(container).toBeEmptyDOMElement()
  })
})
