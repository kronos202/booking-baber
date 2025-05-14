/*
  Warnings:

  - You are about to drop the column `booking_id` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `payment_id` on the `Notification` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_user_id_fkey";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "booking_id",
DROP COLUMN "payment_id",
ADD COLUMN     "channels" TEXT,
ADD COLUMN     "delivery_status" TEXT;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "deleted_at" SET DEFAULT null;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
