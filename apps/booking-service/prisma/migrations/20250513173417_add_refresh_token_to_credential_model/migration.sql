-- AlterTable
ALTER TABLE "credential" ADD COLUMN     "refresh_token" TEXT;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "fcmToken" TEXT,
ALTER COLUMN "deleted_at" SET DEFAULT null;
