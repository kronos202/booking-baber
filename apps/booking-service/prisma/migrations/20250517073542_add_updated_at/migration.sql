/*
  Warnings:

  - Added the required column `updated_at` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "deleted_at" SET DEFAULT null;
