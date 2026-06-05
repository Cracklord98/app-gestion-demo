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

  await prisma.extraHourEntry.deleteMany();
  await prisma.extraHoursConfig.deleteMany();
  await prisma.estimation.deleteMany();
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
      allowExtraHours: true,
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
      allowExtraHours: true,
    },
  });

  const projectC = await prisma.project.create({
    data: {
      name: "Soporte Operativo",
      company: "Synaptica",
      country: "Colombia",
      currency: "USD",
      budget: 20000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      description: "Mantenimiento y soporte (horas extra deshabilitadas).",
      allowExtraHours: false,
    },
  });

  const consultantA = await prisma.consultant.create({
    data: {
      fullName: "Laura Nunez",
      email: "laura.nunez@example.com",
      role: "Project Manager",
      hourlyRate: 65,
      active: true,
      country: "Colombia",
      identification: "1020304050",
    },
  });

  const consultantB = await prisma.consultant.create({
    data: {
      fullName: "Camilo Ruiz",
      email: "camilo.ruiz@example.com",
      role: "Senior Developer",
      hourlyRate: 52,
      active: true,
      country: "Colombia",
      identification: "1098765432",
    },
  });

  const consultantC = await prisma.consultant.create({
    data: {
      fullName: "Mateo Silva",
      email: "mateo.silva@example.com",
      role: "Mid Developer",
      hourlyRate: 35,
      active: true,
      country: "Peru",
      identification: "PD-9876543",
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

  // Seed default extra hours configuration
  await prisma.extraHoursConfig.create({
    data: {
      weeklyExtraHoursLimit: 12,
      diurnalMultiplier: 1.25,
      nocturnalMultiplier: 1.75,
      diurnalHolidayMultiplier: 2.00,
      nocturnalHolidayMultiplier: 2.50,
      diurnalStart: "06:00:00",
      diurnalEnd: "21:00:00",
    },
  });

  // Seed extra hours entries
  await prisma.extraHourEntry.createMany({
    data: [
      {
        consultantId: consultantB.id,
        projectId: projectA.id,
        date: new Date("2026-05-15"), // Un día normal de semana en 2026 (viernes)
        startTime: "18:00:00",
        endTime: "22:00:00",
        diurnal: 3,
        nocturnal: 1,
        diurnalHoliday: 0,
        nocturnalHoliday: 0,
        totalHours: 4,
        diurnalAmount: 195, // 3 * 52 * 1.25
        nocturnalAmount: 91, // 1 * 52 * 1.75
        diurnalHolidayAmount: 0,
        nocturnalHolidayAmount: 0,
        totalAmount: 286,
        observations: "Despliegue de producción del ERP",
        status: "APPROVED",
        approvedBy: adminEmail,
        approvedAt: new Date("2026-05-16"),
      },
      {
        consultantId: consultantB.id,
        projectId: projectA.id,
        date: new Date("2026-05-17"), // Domingo festivo en 2026
        startTime: "08:00:00",
        endTime: "12:00:00",
        diurnal: 0,
        nocturnal: 0,
        diurnalHoliday: 4,
        nocturnalHoliday: 0,
        totalHours: 4,
        diurnalAmount: 0,
        nocturnalAmount: 0,
        diurnalHolidayAmount: 416, // 4 * 52 * 2.00
        nocturnalHolidayAmount: 0,
        totalAmount: 416,
        observations: "Soporte crítico de base de datos",
        status: "PENDING_PM",
      },
    ],
  });

  // Seed estimations
  await prisma.estimation.create({
    data: {
      projectId: projectA.id,
      projectName: "Implementacion ERP - Fase 2",
      totalIdealHours: 40,
      totalAdjustedHours: 85.5,
      bufferPercentage: 10,
      riskLevel: "medium",
      confidenceLevel: 80,
      rawDataJson: JSON.stringify({
        tasks: [
          {
            id: 1,
            name: "Modelado de base de datos",
            idealHours: 16,
            complexity: "known_unknowns",
            experience: "senior",
            techDebt: "clean",
            dependencies: "none",
            hasCodeReview: true,
            hasTesting: true,
            hasDocumentation: true,
          },
          {
            id: 2,
            name: "API endpoints e integración",
            idealHours: 24,
            complexity: "routine",
            experience: "mid",
            techDebt: "moderate",
            dependencies: "internal",
            hasCodeReview: true,
            hasTesting: true,
            hasDocumentation: false,
          },
        ],
        globalConfig: {
          hoursPerDay: 8,
          sprintDays: 10,
          bufferPercentage: 10,
          includeWeekends: false,
        },
      }),
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
