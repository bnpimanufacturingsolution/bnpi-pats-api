-- CreateEnum
CREATE TYPE "AssetOwnerType" AS ENUM ('MODEL');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('REQUESTED', 'UPLOAD_REQUESTED', 'AVAILABLE', 'QUARANTINED', 'RETIRED');

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "ownerType" "AssetOwnerType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'REQUESTED',
    "rowVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Asset_objectKey_key" ON "Asset"("objectKey");

-- CreateIndex
CREATE INDEX "Asset_ownerType_ownerId_status_idx" ON "Asset"("ownerType", "ownerId", "status");
