import { describe, expect, it } from "vitest";
import { easter, holidayOn } from "./holidays";

describe("feriados", () => {
  it("calcula a Páscoa de anos conhecidos", () => {
    expect(easter(2024)).toBe("2024-03-31");
    expect(easter(2026)).toBe("2026-04-05");
    expect(easter(2027)).toBe("2027-03-28");
  });

  it("marca os feriados do design em novembro de 2026", () => {
    expect(holidayOn("2026-11-02")).toBe("Finados");
    expect(holidayOn("2026-11-15")).toBe("Proclamação da República");
    expect(holidayOn("2026-11-20")).toBe("Consciência Negra");
    expect(holidayOn("2026-11-04")).toBeNull();
  });

  it("calcula os móveis", () => {
    expect(holidayOn("2026-02-17")).toBe("Carnaval");
    expect(holidayOn("2026-04-03")).toBe("Sexta-feira Santa");
    expect(holidayOn("2026-06-04")).toBe("Corpus Christi");
  });
});
