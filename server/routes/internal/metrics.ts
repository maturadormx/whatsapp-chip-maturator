import { Router } from "express";
import type { MessageQueuePort } from "../../ports/MessageQueuePort";
import { registry, syncDlqCurrentSize, syncQueueGauges } from "../../metrics";

function createInternalMetricsRouter(queue?: MessageQueuePort | null) {
  const router = Router();

  router.get("/metrics", async (_req, res) => {
    if (queue) {
      try {
        const snapshot = await queue.getMetrics();
        syncQueueGauges({
          pending: snapshot.pending,
          active: snapshot.active,
          failed: snapshot.failed,
          delayed: snapshot.delayed,
        });
        syncDlqCurrentSize(snapshot.dlqTotal);
      } catch {
        // Não bloquear a exposição Prometheus se a coleta da fila falhar.
      }
    }
    res.set("Content-Type", registry.contentType);
    res.send(await registry.metrics());
  });

  return router;
}

export { createInternalMetricsRouter };
export default createInternalMetricsRouter();
