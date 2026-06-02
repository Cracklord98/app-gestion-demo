import { AppRole, RiskStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, authorize } from "../../auth/guard.js";
import { prisma } from "../../infra/prisma.js";

const projectIdSchema = z.object({ projectId: z.string().min(1) });
const idSchema = z.object({ projectId: z.string().min(1), id: z.string().min(1) });

const riskPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  probability: z.coerce.number().int().min(1).max(3),
  impact: z.coerce.number().int().min(1).max(3),
  category: z.string().optional(),
  owner: z.string().optional(),
  mitigationPlan: z.string().optional(),
  contingencyPlan: z.string().optional(),
});

export async function risksRoutes(app: FastifyInstance) {
  app.get(
    "/:projectId/risks",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE, AppRole.VIEWER])] },
    async (request, reply) => {
      const { projectId } = projectIdSchema.parse(request.params);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.status(404).send({ message: "Proyecto no encontrado" });
      const risks = await prisma.risk.findMany({ where: { projectId }, orderBy: [{ riskScore: "desc" }, { identifiedAt: "desc" }] });
      return { data: risks };
    },
  );

  app.post(
    "/:projectId/risks",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])] },
    async (request, reply) => {
      const { projectId } = projectIdSchema.parse(request.params);
      const payload = riskPayloadSchema.parse(request.body);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.status(404).send({ message: "Proyecto no encontrado" });
      const risk = await prisma.risk.create({
        data: { projectId, ...payload, riskScore: payload.probability * payload.impact, createdBy: request.authUser!.email },
      });
      return reply.status(201).send({ data: risk });
    },
  );

  app.put(
    "/:projectId/risks/:id",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])] },
    async (request, reply) => {
      const { projectId, id } = idSchema.parse(request.params);
      const payload = riskPayloadSchema.parse(request.body);
      const existing = await prisma.risk.findFirst({ where: { id, projectId } });
      if (!existing) return reply.status(404).send({ message: "Riesgo no encontrado" });
      const risk = await prisma.risk.update({
        where: { id },
        data: { ...payload, riskScore: payload.probability * payload.impact },
      });
      return { data: risk };
    },
  );

  app.patch(
    "/:projectId/risks/:id/status",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])] },
    async (request, reply) => {
      const { projectId, id } = idSchema.parse(request.params);
      const { status } = z.object({ status: z.nativeEnum(RiskStatus) }).parse(request.body);
      const existing = await prisma.risk.findFirst({ where: { id, projectId } });
      if (!existing) return reply.status(404).send({ message: "Riesgo no encontrado" });
      const resolvedAt = ["MITIGATED", "ACCEPTED", "CLOSED"].includes(status) ? new Date() : null;
      const risk = await prisma.risk.update({ where: { id }, data: { status, resolvedAt } });
      return { data: risk };
    },
  );

  app.delete(
    "/:projectId/risks/:id",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])] },
    async (request, reply) => {
      const { projectId, id } = idSchema.parse(request.params);
      const existing = await prisma.risk.findFirst({ where: { id, projectId } });
      if (!existing) return reply.status(404).send({ message: "Riesgo no encontrado" });
      
      try {
        await prisma.risk.delete({ where: { id } });
        return reply.status(204).send();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "P2003" || code === "P2014") {
          return reply.status(409).send({ message: "No se puede eliminar el riesgo: tiene registros relacionados" });
        }
        throw err;
      }
    },
  );
}
