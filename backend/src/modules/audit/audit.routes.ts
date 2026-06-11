import { AppRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, authorize } from "../../auth/guard.js";
import { prisma } from "../../infra/prisma.js";

const querySchema = z.object({
  entity: z.string().optional(),
  entityId: z.string().optional(),
  changedBy: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(50),
});

export async function auditRoutes(app: FastifyInstance) {
  app.get(
    "/",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.FINANCE, AppRole.PM])] },
    async (request) => {
      const query = querySchema.parse(request.query);
      const skip = (query.page - 1) * query.pageSize;

      const where = {
        entity: query.entity,
        entityId: query.entityId,
        changedBy: query.changedBy,
        createdAt: {
          gte: query.from,
          lte: query.to,
        },
      };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: query.pageSize,
        }),
        prisma.auditLog.count({ where }),
      ]);

      return {
        data: logs,
        meta: {
          total,
          page: query.page,
          pageSize: query.pageSize,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    },
  );
}
