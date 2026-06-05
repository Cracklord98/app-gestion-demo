-- AlterTable
ALTER TABLE "User" ADD COLUMN     "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
