import { z } from "zod";
import { adminProcedure } from "../_core/rbac";
import { router } from "../_core/trpc";
import { getControlCenterService } from "../services/controlCenterService";

export const controlCenterRouter = router({
  getOverview: adminProcedure.query(async ({ ctx }) => {
    return getControlCenterService().getOverview(ctx.user.id);
  }),

  getFleetCatalog: adminProcedure.query(async () => {
    return getControlCenterService().getFleetCatalog();
  }),

  getChipDetail: adminProcedure
    .input(
      z.object({
        legacyChipId: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      return getControlCenterService().getChipDetail(input.legacyChipId);
    }),

  getSecurityOverview: adminProcedure.query(async () => {
    return getControlCenterService().getSecurityOverview();
  }),
});
