import { describe, expect, it } from "vitest";
import { calculateBudgetAvailability, canReserveBudget } from "./budgetReservationService";

describe("budgetReservationService", () => {
  it("calcula disponibilidade considerando committed e reserved", () => {
    const availability = calculateBudgetAvailability({
      limit: 100,
      committed: 60,
      reserved: 15,
    });

    expect(availability).toEqual({
      limit: 100,
      committed: 60,
      reserved: 15,
      available: 25,
    });
  });

  it("nunca permite disponibilidade negativa", () => {
    const availability = calculateBudgetAvailability({
      limit: 50,
      committed: 60,
      reserved: 20,
    });

    expect(availability.available).toBe(0);
  });

  it("permite reserva apenas quando há saldo suficiente", () => {
    expect(canReserveBudget({ available: 10, amount: 1 })).toBe(true);
    expect(canReserveBudget({ available: 0, amount: 1 })).toBe(false);
    expect(canReserveBudget({ available: 10, amount: 0 })).toBe(false);
    expect(canReserveBudget({ available: 2, amount: 3 })).toBe(false);
  });
});
