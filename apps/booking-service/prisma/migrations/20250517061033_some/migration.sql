/*
  Warnings:

  - You are about to drop the column `user_id` on the `Review` table. All the data in the column will be lost.
  - Added the required column `customer_id` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `service_id` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `stylist_id` to the `Review` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_branch_id_fkey";

-- DropForeignKey
ALTER TABLE "Review" DROP CONSTRAINT "Review_user_id_fkey";

-- DropIndex
DROP INDEX "Review_booking_id_key";

-- DropIndex
DROP INDEX "Review_branch_id_idx";

-- DropIndex
DROP INDEX "Review_user_id_idx";

-- AlterTable
ALTER TABLE "Review" DROP COLUMN "user_id",
ADD COLUMN     "customer_id" INTEGER NOT NULL,
ADD COLUMN     "is_visible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "service_id" INTEGER NOT NULL,
ADD COLUMN     "stylist_id" INTEGER NOT NULL,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "deleted_at" SET DEFAULT null;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "Stylist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
