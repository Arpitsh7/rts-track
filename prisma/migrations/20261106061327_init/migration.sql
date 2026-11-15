-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('CREATED', 'PICKED_UP', 'IN_TRANSIT', 'AT_WAREHOUSE', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ItemDetail" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerDetail" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "PNo" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "Address" TEXT NOT NULL,

    CONSTRAINT "CustomerDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShipmentDetail" (
    "id" TEXT NOT NULL,
    "warehouseName" TEXT NOT NULL,
    "warehousePincode" TEXT NOT NULL,
    "shipQR" TEXT NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'CREATED',
    "customerId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "assignDriver" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShipmentDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackUpdatesCustomer" (
    "id" TEXT NOT NULL,
    "driverName" TEXT,
    "shipmentId" TEXT NOT NULL,
    "remarks" TEXT,
    "trackUpdate" "ShipmentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackUpdatesCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemDetail_itemNumber_key" ON "ItemDetail"("itemNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ShipmentDetail_shipQR_key" ON "ShipmentDetail"("shipQR");

-- AddForeignKey
ALTER TABLE "ShipmentDetail" ADD CONSTRAINT "ShipmentDetail_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "CustomerDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShipmentDetail" ADD CONSTRAINT "ShipmentDetail_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackUpdatesCustomer" ADD CONSTRAINT "TrackUpdatesCustomer_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "ShipmentDetail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
