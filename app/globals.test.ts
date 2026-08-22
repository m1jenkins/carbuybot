import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const styles = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

describe("landing design constraints", () => {
  it("keeps interaction distinctions neutral and shadow-free", () => {
    expect(styles).not.toContain("box-shadow");
    expect(styles).toContain(
      ":focus-visible{outline:2px solid var(--ink);outline-offset:3px}",
    );
    expect(styles).toContain(
      ".dark :focus-visible,.plate :focus-visible{outline-color:var(--on-dark)}",
    );
    expect(styles).toContain(".msg--agent .who{color:var(--on-dark)}");
  });
});

describe("customer portal design constraints", () => {
  it("uses editorial hairlines without gradients, shadows, or non-money teal", () => {
    const portalStyles = styles.match(
      /\/\* ── customer portal[\s\S]*?(?=\/\* ── admin review console|\/\* ── conversational intake)/,
    )?.[0];

    expect(portalStyles).toBeDefined();
    expect(portalStyles).not.toMatch(/gradient|shadow/);
    expect(portalStyles).not.toMatch(/--money(?:-dark)?/);
    expect(portalStyles).toContain("border-top:1px solid var(--rule)");
    expect(portalStyles).toContain("background:var(--paper)");
  });
});
