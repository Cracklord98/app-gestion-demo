import { AppRole } from "@prisma/client";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { env } from "../config/env.js";
import { prisma } from "../infra/prisma.js";

type MicrosoftClaims = JWTPayload & {
  oid?: string;
  preferred_username?: string;
  email?: string;
  upn?: string;
  name?: string;
};

const issuerV2 = `https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/v2.0`;
const issuerV1 = `https://sts.windows.net/${env.AZURE_AD_TENANT_ID}/`;

const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${env.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`),
);

function getBearerToken(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

async function verifyMicrosoftToken(token: string) {
  const { payload } = await jwtVerify(token, jwks, {
    issuer: [issuerV2, issuerV1],
    audience: env.AZURE_AD_AUDIENCE,
  });

  return payload as MicrosoftClaims;
}

function resolveEmail(payload: MicrosoftClaims) {
  return payload.preferred_username || payload.email || payload.upn || null;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  if (!env.AUTH_ENABLED || env.AUTH_DEMO_BYPASS) {
    request.authUser = {
      id: "local-admin",
      email: env.ADMIN_EMAIL.toLowerCase(),
      displayName: "Local Admin",
      roles: [AppRole.ADMIN],
    };
    return;
  }

  const token = getBearerToken(request);
  if (!token) {
    return reply.status(401).send({ message: "Missing bearer token" });
  }

  let claims: MicrosoftClaims;
  try {
    claims = await verifyMicrosoftToken(token);
  } catch (err) {
    console.error("DEBUG: Token verification failed:", err);
    return reply.status(401).send({ message: "Invalid Microsoft token" });
  }

  const email = resolveEmail(claims)?.toLowerCase();
  if (!email) {
    return reply.status(401).send({ message: "Token does not include a valid email" });
  }

  // JIT Provisioning: Buscar o crear dinámicamente al usuario
  let user = await prisma.user.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  if (!user) {
    // Mapear código de país de Azure AD (claim 'ctry' o 'country') a nombre completo para la lógica de horas extra y festivos
    const countryMap: Record<string, string> = {
      CO: "Colombia",
      PE: "Peru",
      CL: "Chile",
      MX: "Mexico",
      EC: "Ecuador",
      US: "USA",
    };
    const rawCountry = (claims.ctry as string) || (claims.country as string) || "CO";
    const mappedCountry = countryMap[rawCountry.toUpperCase()] || rawCountry;

    // Si no existe, crearlo automáticamente
    user = await prisma.user.create({
      data: {
        email,
        displayName: claims.name || email.split("@")[0],
        active: true,
        country: mappedCountry,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  if (!user.active) {
    return reply.status(403).send({
      message: "Tu usuario esta inactivo. Contacta a un administrador.",
    });
  }

  // Sincronizar roles desde el token solo si:
  // 1. Vienen definidos explícitamente en el token de Azure AD, Y
  // 2. El usuario local NO tiene ningún rol asignado (ej. es un usuario nuevo).
  // Si ya tiene algún rol en la base de datos, respetamos los roles locales y evitamos que se sobrescriban.
  const hasTokenRoles = claims.roles && Array.isArray(claims.roles) && claims.roles.length > 0;
  const localRolesCount = await prisma.userRole.count({
    where: { userId: user.id },
  });

  if (hasTokenRoles && localRolesCount === 0) {
    for (const roleName of claims.roles as string[]) {
      const appRole = roleName.toUpperCase();
      if (appRole in AppRole) {
        const roleObj = await prisma.role.upsert({
          where: { name: appRole as AppRole },
          update: {},
          create: { name: appRole as AppRole },
        });

        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: roleObj.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            roleId: roleObj.id,
          },
        });
      }
    }
  } else if (localRolesCount === 0) {
    // Si no vienen roles en el token y el usuario local no tiene ningún rol, le damos CONSULTANT
    const consultantRole = await prisma.role.upsert({
      where: { name: AppRole.CONSULTANT },
      update: {},
      create: { name: AppRole.CONSULTANT },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: consultantRole.id,
      },
    });
  }

  // Regla especial de seguridad: Garantizar que el correo configurado en ADMIN_EMAIL siempre tenga el rol ADMIN local
  if (email === env.ADMIN_EMAIL.toLowerCase()) {
    const adminRoleObj = await prisma.role.upsert({
      where: { name: AppRole.ADMIN },
      update: {},
      create: { name: AppRole.ADMIN },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: adminRoleObj.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: adminRoleObj.id,
      },
    });
  }

  // Obtener los roles actualizados desde la base de datos
  const userWithRoles = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  const roles = userWithRoles.roles.map((item) => item.role.name);
  if (roles.length === 0) {
    return reply.status(403).send({
      message: "Tu usuario no tiene roles asignados. Contacta a un administrador.",
    });
  }

  request.authUser = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles,
  };
}

export function authorize(allowedRoles: AppRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.authUser;
    if (!user) {
      return reply.status(401).send({ message: "Not authenticated" });
    }

    const hasRole = user.roles.some((role) => allowedRoles.includes(role));
    if (!hasRole) {
      return reply.status(403).send({ message: "Insufficient permissions" });
    }
  };
}
