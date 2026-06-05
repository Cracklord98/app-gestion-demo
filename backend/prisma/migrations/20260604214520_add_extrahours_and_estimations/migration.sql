-- CreateEnum
CREATE TYPE "ExtraHourStatus" AS ENUM ('PENDING_PM', 'PENDING_FINANCE', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Consultant" ADD COLUMN     "identification" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "allowExtraHours" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "phrase" TEXT;

-- CreateTable
CREATE TABLE "ExtraHoursConfig" (
    "id" TEXT NOT NULL,
    "weeklyExtraHoursLimit" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "diurnalMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.25,
    "nocturnalMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 1.75,
    "diurnalHolidayMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 2.00,
    "nocturnalHolidayMultiplier" DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    "diurnalStart" TEXT NOT NULL DEFAULT '06:00:00',
    "diurnalEnd" TEXT NOT NULL DEFAULT '21:00:00',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraHoursConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraHourEntry" (
    "id" TEXT NOT NULL,
    "consultantId" TEXT NOT NULL,
    "projectId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "diurnal" DECIMAL(6,2) NOT NULL,
    "nocturnal" DECIMAL(6,2) NOT NULL,
    "diurnalHoliday" DECIMAL(6,2) NOT NULL,
    "nocturnalHoliday" DECIMAL(6,2) NOT NULL,
    "totalHours" DECIMAL(6,2) NOT NULL,
    "diurnalAmount" DECIMAL(14,2) NOT NULL,
    "nocturnalAmount" DECIMAL(14,2) NOT NULL,
    "diurnalHolidayAmount" DECIMAL(14,2) NOT NULL,
    "nocturnalHolidayAmount" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "observations" TEXT,
    "status" "ExtraHourStatus" NOT NULL DEFAULT 'PENDING_PM',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExtraHourEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Estimation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalIdealHours" DECIMAL(10,2) NOT NULL,
    "totalAdjustedHours" DECIMAL(10,2) NOT NULL,
    "bufferPercentage" DECIMAL(5,2) NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "confidenceLevel" DECIMAL(5,2) NOT NULL,
    "rawDataJson" TEXT NOT NULL,

    CONSTRAINT "Estimation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtraHourEntry_consultantId_idx" ON "ExtraHourEntry"("consultantId");

-- CreateIndex
CREATE INDEX "ExtraHourEntry_projectId_idx" ON "ExtraHourEntry"("projectId");

-- CreateIndex
CREATE INDEX "ExtraHourEntry_status_idx" ON "ExtraHourEntry"("status");

-- CreateIndex
CREATE INDEX "Estimation_projectId_idx" ON "Estimation"("projectId");

-- AddForeignKey
ALTER TABLE "ExtraHourEntry" ADD CONSTRAINT "ExtraHourEntry_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "Consultant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraHourEntry" ADD CONSTRAINT "ExtraHourEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Estimation" ADD CONSTRAINT "Estimation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
