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
