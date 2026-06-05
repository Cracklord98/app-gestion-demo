import { resolvePermissions } from "../../auth/roles.js";
import { authenticate } from "../../auth/guard.js";
import { prisma } from "../../infra/prisma.js";
import type { FastifyInstance } from "fastify";

export async function authRoutes(app: FastifyInstance) {
  app.get(
    "/me",
    {
      preHandler: [authenticate],
    },
    async (request) => {
      const user = request.authUser!;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email },
      });
      return {
        data: {
          id: dbUser?.id || user.id,
          email: user.email,
          displayName: dbUser?.displayName || user.displayName,
          photoUrl: dbUser?.photoUrl || null,
          bio: dbUser?.bio || null,
          phrase: dbUser?.phrase || null,
          roles: user.roles,
          permissions: resolvePermissions(user.roles),
        },
      };
    },
  );
}
