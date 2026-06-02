-- DropForeignKey
ALTER TABLE "MonthlySnapshot" DROP CONSTRAINT "MonthlySnapshot_projectId_fkey";

-- AddForeignKey
ALTER TABLE "MonthlySnapshot" ADD CONSTRAINT "MonthlySnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
