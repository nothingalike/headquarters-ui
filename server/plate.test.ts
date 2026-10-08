import { describe, expect, it } from "vitest";
import { parsePlate } from "./plate.ts";

const PLATE = `# Plate

## acme-shop

- [/] SHOP-003: cart migration (since 2026-09-24)
- [ ] SHOP-005: shop pricing — blocked: needs SHOP-003 merged (since 2026-09-30)
- [ ] SHOP-004/006: ask Dana about the tax rule — waiting on: Dana (since 2026-10-01)

## side

- [ ] tidy the garage (since 2026-10-02)
`;

describe("parsePlate", () => {
  const groups = parsePlate(PLATE);

  it("groups items under their project heading", () => {
    expect(groups.map((g) => [g.project, g.items.length])).toEqual([
      ["acme-shop", 3],
      ["side", 1],
    ]);
  });

  it("reads status, story, and since", () => {
    expect(groups[0].items[0]).toMatchObject({ status: "doing", stories: ["SHOP-003"], text: "cart migration", since: "2026-09-24" });
  });

  it("separates blocked and waiting reasons from the text", () => {
    expect(groups[0].items[1]).toMatchObject({ text: "shop pricing", blocked: "needs SHOP-003 merged" });
    expect(groups[0].items[2]).toMatchObject({ text: "ask Dana about the tax rule", waitingOn: "Dana" });
  });

  it("expands shorthand story pairs", () => {
    expect(groups[0].items[2].stories).toEqual(["SHOP-004", "SHOP-006"]);
  });

  it("keeps items without a story", () => {
    expect(groups[1].items[0]).toMatchObject({ stories: [], text: "tidy the garage", line: 11 });
  });
});
