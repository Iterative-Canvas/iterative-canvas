import { describe, it, expect } from "vitest"
import { cn } from "./utils" // adjust the path if needed

describe("cn utility", () => {
  it("merges multiple class strings", () => {
    expect(cn("p-4", "m-2")).toBe("p-4 m-2")
  })

  it("merges Tailwind conflicting classes (twMerge behavior)", () => {
    // tailwind-merge should prefer the latter value for conflicts
    expect(cn("p-4", "p-2")).toBe("p-2")
  })

  it("handles conditional class names (clsx behavior)", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active")
  })

  it("removes duplicate classes", () => {
    expect(cn("p-4", "p-4", "m-2")).toBe("p-4 m-2")
  })

  it("ignores null, undefined, and empty strings", () => {
    expect(cn("p-4", null, undefined, "", "m-2")).toBe("p-4 m-2")
  })

  it("handles array of class names", () => {
    expect(cn(["p-4", "m-2"], "text-center")).toBe("p-4 m-2 text-center")
  })
})
