import { describe, expect, it, vi } from "vitest";
import { InboundService } from "./InboundService";
import { registerInboundRoutes } from "./InboundRouter";

describe("InboundRouter", () => {
  it("registra POST /api/inbound/events e retorna 202 para payload válido", async () => {
    const pipeline = { process: vi.fn().mockResolvedValue(undefined) };
    const service = new InboundService(pipeline as any);
    const processEvent = vi.spyOn(service, "processEvent").mockResolvedValue({
      status: "accepted",
      id: "corr-1",
    });

    let handler: ((req: any, res: any) => unknown) | null = null;
    const app = {
      post: vi.fn((path: string, routeHandler: (req: any, res: any) => unknown) => {
        expect(path).toBe("/api/inbound/events");
        handler = routeHandler;
      }),
    } as any;

    registerInboundRoutes(app, { service });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler?.(
      {
        body: {
          source: "webhook-test",
          eventType: "test.event",
          payload: { foo: "bar" },
        },
      },
      res,
    );

    expect(processEvent).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(202);
    expect(res.json).toHaveBeenCalledWith({
      status: "accepted",
      id: "corr-1",
    });
  });

  it("retorna 400 para payload inválido", async () => {
    let handler: ((req: any, res: any) => unknown) | null = null;
    const app = {
      post: vi.fn((_path: string, routeHandler: (req: any, res: any) => unknown) => {
        handler = routeHandler;
      }),
    } as any;

    registerInboundRoutes(app);

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler?.(
      {
        body: {
          eventType: "missing-source",
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "invalid_inbound_event",
      }),
    );
  });

  it("retorna 500 se o pipeline falhar", async () => {
    const pipeline = { process: vi.fn().mockRejectedValue(new Error("db down")) };
    const service = new InboundService(pipeline as any);

    let handler: ((req: any, res: any) => unknown) | null = null;
    const app = {
      post: vi.fn((_path: string, routeHandler: (req: any, res: any) => unknown) => {
        handler = routeHandler;
      }),
    } as any;

    registerInboundRoutes(app, { service });

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    await handler?.(
      {
        body: {
          source: "webhook-test",
          eventType: "test.event",
          payload: {},
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "inbound_processing_failed",
      }),
    );
  });
});
