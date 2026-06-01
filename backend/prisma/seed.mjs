import "dotenv/config";
import { AppRole, PrismaClient, TimeEntryStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@synaptica.local").toLowerCase();

  await Promise.all(
    Object.values(AppRole).map((role) =>
      prisma.role.upsert({
        where: { name: role },
        update: {},
        create: { name: role },
      }),
    ),
  );

  const adminRole = await prisma.role.findUnique({ where: { name: AppRole.ADMIN } });
  if (!adminRole) {
    throw new Error("ADMIN role was not created");
  }

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      displayName: "Administrador",
      active: true,
    },
    create: {
      email: adminEmail,
      displayName: "Administrador",
      active: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  await prisma.timeEntry.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.forecast.deleteMany();
  await prisma.consultant.deleteMany();
  await prisma.project.deleteMany();
  await prisma.fxConfig.deleteMany();

  const projectA = await prisma.project.create({
    data: {
      name: "Implementacion ERP",
      company: "Synaptica",
      country: "Colombia",
      currency: "USD",
      budget: 80000,
      startDate: new Date("2026-01-10"),
      endDate: new Date("2026-08-30"),
      description: "Proyecto de transformacion digital con alcance regional.",
    },
  });

  const projectB = await prisma.project.create({
    data: {
      name: "Migracion Data Lake",
      company: "Andes Group",
      country: "Peru",
      currency: "USD",
      budget: 54000,
      startDate: new Date("2026-02-01"),
      endDate: new Date("2026-09-15"),
    },
  });

  const consultantA = await prisma.consultant.create({
    data: {
      fullName: "Laura Nunez",
      email: "laura.nunez@example.com",
      role: "Project Manager",
      hourlyRate: 65,
      active: true,
    },
  });

  const consultantB = await prisma.consultant.create({
    data: {
      fullName: "Camilo Ruiz",
      email: "camilo.ruiz@example.com",
      role: "Senior Developer",
      hourlyRate: 52,
      active: true,
    },
  });

  await prisma.timeEntry.createMany({
    data: [
      {
        projectId: projectA.id,
        consultantId: consultantA.id,
        workDate: new Date("2026-04-01"),
        hours: 6,
        status: TimeEntryStatus.APPROVED,
        approvedBy: "admin",
        approvedAt: new Date("2026-04-02"),
      },
      {
        projectId: projectA.id,
        consultantId: consultantB.id,
        workDate: new Date("2026-04-01"),
        hours: 7.5,
        status: TimeEntryStatus.PENDING,
      },
      {
        projectId: projectB.id,
        consultantId: consultantB.id,
        workDate: new Date("2026-04-03"),
        hours: 4,
        status: TimeEntryStatus.REJECTED,
        approvedBy: "admin",
        rejectionNote: "Falta detalle de actividad",
      },
    ],
  });

  await prisma.expense.createMany({
    data: [
      {
        projectId: projectA.id,
        expenseDate: new Date("2026-04-02"),
        category: "Viajes",
        amount: 1200,
        currency: "USD",
        description: "Desplazamiento a cliente",
      },
      {
        projectId: projectA.id,
        expenseDate: new Date("2026-04-04"),
        category: "Consultoria",
        amount: 850,
        currency: "USD",
      },
      {
        projectId: projectB.id,
        expenseDate: new Date("2026-04-05"),
        category: "Licencias",
        amount: 420,
        currency: "USD",
      },
    ],
  });

  await prisma.forecast.createMany({
    data: [
      {
        projectId: projectA.id,
        consultantId: consultantA.id,
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        hoursProjected: 120,
        hourlyRate: 65,
      },
      {
        projectId: projectA.id,
        consultantId: consultantB.id,
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        hoursProjected: 180,
        hourlyRate: 52,
      },
      {
        projectId: projectB.id,
        consultantId: consultantB.id,
        startDate: "2026-04-01",
        endDate: "2026-06-30",
        hoursProjected: 100,
        hourlyRate: 50,
      },
    ],
  });

  await prisma.fxConfig.create({
    data: {
      baseCode: "USD",
      quoteCode: "COP",
      rate: 4000,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
