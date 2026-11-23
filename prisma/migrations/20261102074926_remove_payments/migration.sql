/*
  Warnings:

  - You are about to drop the column `fee_paid` on the `adoptions` table. All the data in the column will be lost.
  - You are about to drop the column `payment_status` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_adoption_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_refund_of_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_fkey";

-- AlterTable
ALTER TABLE "adoptions" DROP COLUMN "fee_paid";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "payment_status";

-- DropTable
DROP TABLE "payments";

-- DropEnum
DROP TYPE "Currency";

-- DropEnum
DROP TYPE "PaymentMethod";

-- DropEnum
DROP TYPE "PaymentStatus";

-- DropEnum
DROP TYPE "PaymentType";

-- DropEnum
DROP TYPE "TransactionStatus";

-- Clean up rows left over from the payment module (role_permissions cascade)
DELETE FROM "permissions" WHERE "slug" LIKE 'payment.%';
DELETE FROM "settings" WHERE "key" IN ('supported_currencies', 'usd_exchange_rate', 'booking_payment_timeout_minutes');
UPDATE "settings" SET "group" = 'general' WHERE "group" = 'payment';
