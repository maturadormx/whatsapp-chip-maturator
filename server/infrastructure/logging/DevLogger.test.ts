import { describe, expect, it, vi, afterEach } from "vitest";
import { DevLogger } from "./DevLogger";

describe("DevLogger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("debug usa console.debug com estrutura esperada", () => {
    const spy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = new DevLogger();
    logger.debug("pipeline.started", { observationId: "obs-1" });
    expect(spy).toHaveBeenCalledWith("[DEBUG] pipeline.started", { observationId: "obs-1" });
  });

  it("info usa console.info com estrutura esperada", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = new DevLogger();
    logger.info("plan.executed", { planId: "plan-1" });
    expect(spy).toHaveBeenCalledWith("[INFO] plan.executed", { planId: "plan-1" });
  });
});

