import { AppRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../auth/guard.js";
import { notifyFeedbackReceived } from "../../utils/notifications.js";

const feedbackPayloadSchema = z.object({
  category: z.enum(["BUG", "SUGGESTION", "AESTHETIC", "OTHER"]),
  notes: z.string().trim().min(1),
});

export async function feedbackRoutes(app: FastifyInstance) {
  app.post(
    "/",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const payload = feedbackPayloadSchema.parse(request.body);
      const user = request.authUser!;

      // Disparar las notificaciones por correo y Teams
      notifyFeedbackReceived({
        category: payload.category,
        notes: payload.notes,
        userEmail: user.email,
        userName: user.displayName,
      }).catch((err) => {
        console.error("Error al enviar notificación de feedback:", err);
      });

      return reply.status(200).send({ message: "Feedback enviado correctamente" });
    }
  );
}
