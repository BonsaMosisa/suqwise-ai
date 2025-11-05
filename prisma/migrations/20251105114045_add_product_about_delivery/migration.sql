-- AlterTable
ALTER TABLE `product` ADD COLUMN `about` VARCHAR(191) NULL,
    ADD COLUMN `deliveryDays` INTEGER NULL DEFAULT 3;
