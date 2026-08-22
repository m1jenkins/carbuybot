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

  it("keeps closing-plate copy light on the photo and the who-we-work-for block compact", () => {
    expect(styles).toMatch(/\.dark \.lede,\s*\.plate \.lede\{color:rgba\(242,241,238,\.9\)\}/);
    expect(styles).toContain(
      ".close .plate__scrim{background:linear-gradient(180deg,rgba(8,9,10,.58) 0%,rgba(8,9,10,.34) 30%,rgba(8,9,10,.94) 72%,rgba(8,9,10,.97) 100%)}",
    );
    expect(styles).toContain(".close .label{color:rgba(242,241,238,.78)}");
    expect(styles).toContain(".close .fnote{color:rgba(242,241,238,.82)}");
    expect(styles).toContain(".sec--tight{padding-block:clamp(46px,5vw,78px)}");
    expect(styles).toContain(
      ".stmt{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1fr);gap:clamp(18px,4vw,64px);align-items:start}",
    );
    expect(styles).toContain(".stmt__l{display:grid;gap:12px}");
    expect(styles).toContain(
      ".stmt__r{font-size:15.5px;line-height:1.6;color:var(--graphite);max-width:62ch;text-wrap:pretty}",
    );
    expect(styles).toContain("  .ev__rail{position:static}");
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
