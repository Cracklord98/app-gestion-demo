import { AppRole, IssueSeverity, IssueStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate, authorize } from "../../auth/guard.js";
import { prisma } from "../../infra/prisma.js";

const projectIdSchema = z.object({ projectId: z.string().min(1) });
const idSchema = z.object({ projectId: z.string().min(1), id: z.string().min(1) });

const issuePayloadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  severity: z.nativeEnum(IssueSeverity).default("MEDIUM"),
  owner: z.string().optional(),
});

export async function issuesRoutes(app: FastifyInstance) {
  app.get(
    "/:projectId/issues",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE, AppRole.VIEWER])] },
    async (request, reply) => {
      const { projectId } = projectIdSchema.parse(request.params);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.status(404).send({ message: "Proyecto no encontrado" });
      const issues = await prisma.issue.findMany({ where: { projectId }, orderBy: [{ severity: "desc" }, { createdAt: "desc" }] });
      return { data: issues };
    },
  );

  app.post(
    "/:projectId/issues",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE])] },
    async (request, reply) => {
      const { projectId } = projectIdSchema.parse(request.params);
      const payload = issuePayloadSchema.parse(request.body);
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) return reply.status(404).send({ message: "Proyecto no encontrado" });
      const issue = await prisma.issue.create({
        data: { projectId, ...payload, createdBy: request.authUser!.email },
      });
      return reply.status(201).send({ data: issue });
    },
  );

  app.put(
    "/:projectId/issues/:id",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.FINANCE])] },
    async (request, reply) => {
      const { projectId, id } = idSchema.parse(request.params);
      const payload = issuePayloadSchema.parse(request.body);
      const existing = await prisma.issue.findFirst({ where: { id, projectId } });
      if (!existing) return reply.status(404).send({ message: "Issue no encontrado" });
      const issue = await prisma.issue.update({ where: { id }, data: payload });
      return { data: issue };
    },
  );

  app.patch(
    "/:projectId/issues/:id/resolve",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])] },
    async (request, reply) => {
      const { projectId, id } = idSchema.parse(request.params);
      const { resolution, status } = z.object({
        resolution: z.string().optional(),
        status: z.nativeEnum(IssueStatus).default("RESOLVED"),
      }).parse(request.body ?? {});
      const existing = await prisma.issue.findFirst({ where: { id, projectId } });
      if (!existing) return reply.status(404).send({ message: "Issue no encontrado" });
      const issue = await prisma.issue.update({
        where: { id },
        data: { status, resolution, resolvedAt: new Date() },
      });
      return { data: issue };
    },
  );

  app.delete(
    "/:projectId/issues/:id",
    { preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])] },
    async (request, reply) => {
      const { projectId, id } = idSchema.parse(request.params);
      const existing = await prisma.issue.findFirst({ where: { id, projectId } });
      if (!existing) return reply.status(404).send({ message: "Issue no encontrado" });
      
      try {
        await prisma.issue.delete({ where: { id } });
        return reply.status(204).send();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "P2003" || code === "P2014") {
          return reply.status(409).send({ message: "No se puede eliminar el incidente: tiene registros relacionados" });
        }
        throw err;
      }
    },
  );
}
