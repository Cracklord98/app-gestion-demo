import type { FastifyInstance } from "fastify";
import { AppRole, TimeEntryStatus } from "@prisma/client";
import { z } from "zod";
import { authenticate, authorize } from "../../auth/guard.js";
import { prisma } from "../../infra/prisma.js";

const timeEntryPayloadSchema = z.object({
  projectId: z.string().min(1),
  consultantId: z.string().min(1),
  workDate: z.coerce.date(),
  hours: z.coerce.number().positive(),
  note: z.string().trim().optional(),
});

const reviewPayloadSchema = z.object({
  approvedBy: z.string().trim().min(1),
  rejectionNote: z.string().trim().optional(),
});

const rejectPayloadSchema = z.object({
  approvedBy: z.string().trim().min(1),
  rejectionNote: z.string().trim().min(3),
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function timeEntriesRoutes(app: FastifyInstance) {
  app.get(
    "/",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.CONSULTANT, AppRole.VIEWER])],
    },
    async () => {
    const entries = await prisma.timeEntry.findMany({
      include: {
        project: true,
        consultant: true,
      },
      orderBy: { workDate: "desc" },
    });

      return { data: entries };
    },
  );

  app.post(
    "/",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM, AppRole.CONSULTANT])],
    },
    async (request, reply) => {
    const payload = timeEntryPayloadSchema.parse(request.body);

    const [project, consultant] = await Promise.all([
      prisma.project.findUnique({ where: { id: payload.projectId } }),
      prisma.consultant.findUnique({ where: { id: payload.consultantId } }),
    ]);

    if (!project) {
      return reply.status(400).send({ message: "Invalid projectId" });
    }

    if (!consultant) {
      return reply.status(400).send({ message: "Invalid consultantId" });
    }

    const entry = await prisma.timeEntry.create({
      data: {
        projectId: payload.projectId,
        consultantId: payload.consultantId,
        workDate: payload.workDate,
        hours: payload.hours,
        note: payload.note,
        status: TimeEntryStatus.PENDING,
      },
    });

      return reply.status(201).send({ data: entry });
    },
  );

  app.patch(
    "/:id/approve",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])],
    },
    async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const payload = reviewPayloadSchema.parse(request.body);

    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ message: "Time entry not found" });
    }

    if (existing.status !== TimeEntryStatus.PENDING) {
      return reply.status(409).send({ message: "Only pending entries can be approved" });
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.APPROVED,
        approvedAt: new Date(),
        approvedBy: payload.approvedBy,
        rejectionNote: null,
      },
    });

      return { data: entry };
    },
  );

  app.patch(
    "/:id/reject",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])],
    },
    async (request, reply) => {
    const { id } = idParamsSchema.parse(request.params);
    const payload = rejectPayloadSchema.parse(request.body);

    const existing = await prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) {
      return reply.status(404).send({ message: "Time entry not found" });
    }

    if (existing.status !== TimeEntryStatus.PENDING) {
      return reply.status(409).send({ message: "Only pending entries can be rejected" });
    }

    const entry = await prisma.timeEntry.update({
      where: { id },
      data: {
        status: TimeEntryStatus.REJECTED,
        approvedAt: null,
        approvedBy: payload.approvedBy,
        rejectionNote: payload.rejectionNote,
      },
    });

      return { data: entry };
    },
  );

  app.delete(
    "/:id",
    {
      preHandler: [authenticate, authorize([AppRole.ADMIN, AppRole.PM])],
    },
    async (request, reply) => {
      const { id } = idParamsSchema.parse(request.params);

      const existing = await prisma.timeEntry.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ message: "Time entry not found" });
      }

      try {
        await prisma.timeEntry.delete({ where: { id } });
        return reply.status(204).send();
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "P2003" || code === "P2014") {
          return reply.status(409).send({ message: "No se puede eliminar el registro de horas: tiene otros registros relacionados" });
        }
        throw err;
      }
    },
  );
}
