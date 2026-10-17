import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { ProseHelp } from "@/components/ui/prose-help"

const PROSE =
  'Buyer VAT number "DE136695976" has not been confirmed valid yet (status: not checked), so this buyer ' +
  "is treated as B2C until it is verified."

describe("<ProseHelp>", () => {
  it("shows only its title and a help button until asked", () => {
    render(<ProseHelp title="About this VAT treatment">{PROSE}</ProseHelp>)
    expect(screen.getByText("About this VAT treatment")).toBeVisible()
    expect(screen.getByRole("button", { name: "Help for About this VAT treatment" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("opens the full text on click or tap", () => {
    render(<ProseHelp title="About this VAT treatment">{PROSE}</ProseHelp>)
    fireEvent.click(screen.getByRole("button", { name: /help/i }))
    expect(screen.getByRole("dialog")).toHaveTextContent(PROSE)
  })

  it("opens on hover with a mouse", () => {
    render(<ProseHelp title="About this VAT treatment">{PROSE}</ProseHelp>)
    fireEvent.pointerEnter(screen.getByRole("button", { name: /help/i }), { pointerType: "mouse" })
    expect(screen.getByRole("dialog")).toHaveTextContent(PROSE)
  })

  it("opens on keyboard focus", () => {
    render(<ProseHelp title="About this VAT treatment">{PROSE}</ProseHelp>)
    fireEvent.keyDown(document, { key: "Tab" })
    fireEvent.focus(screen.getByRole("button", { name: /help/i }))
    expect(screen.getByRole("dialog")).toHaveTextContent(PROSE)
  })

  it("describes its help button with the full text for assistive technology", () => {
    render(<ProseHelp title="Retain until 31/12/2035">{PROSE}</ProseHelp>)
    expect(
      screen.getByRole("button", { name: "Help for Retain until 31/12/2035" }),
    ).toHaveAccessibleDescription(PROSE)
  })

  it("opens several texts as separate paragraphs", () => {
    render(<ProseHelp title="Check how VAT was applied">{["First caveat.", "Second caveat."]}</ProseHelp>)
    fireEvent.click(screen.getByRole("button", { name: /help/i }))
    expect(screen.getByRole("dialog")).toHaveTextContent("First caveat.Second caveat.")
  })

  it.each([
    ["an empty text", ""],
    ["a list of empty texts", ["", ""]],
  ])("shows no help button for %s", (_case, children) => {
    render(<ProseHelp title="Credit note">{children}</ProseHelp>)
    expect(screen.getByText("Credit note")).toBeVisible()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("keeps a warning noticeable: warning colour and an icon beside the title", () => {
    render(
      <ProseHelp tone="warning" title="Check this VAT treatment" dataCy="tax">
        {PROSE}
      </ProseHelp>,
    )
    const status = screen.getByTestId("tax")
    expect(status).toHaveClass("bg-warning")
    expect(status.querySelector("svg")).not.toBeNull()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("stays plain for a pure explanation", () => {
    render(
      <ProseHelp title="Retain until 31/12/2035" dataCy="retention">
        {PROSE}
      </ProseHelp>,
    )
    expect(screen.getByTestId("retention")).not.toHaveClass("bg-warning")
  })
})
