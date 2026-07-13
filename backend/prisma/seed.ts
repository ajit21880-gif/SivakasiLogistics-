import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Sivakasi Logistics Database with Upgraded Schema...");

  // Clear existing in reverse dependency order
  await prisma.transportMessage.deleteMany();
  await prisma.gDMItem.deleteMany();
  await prisma.goodsDispatchMemo.deleteMany();
  await prisma.goodsConsignment.deleteMany();
  await prisma.lorryMaster.deleteMany();
  await prisma.consigneeMaster.deleteMany();
  await prisma.consignorMaster.deleteMany();
  await prisma.user.deleteMany();

  // Password hashing
  const passwordHash = await bcrypt.hash("Demo@123456", 12);

  // 1. Create Consignor Masters first (needed to link to Customer Users)
  const consignor1 = await prisma.consignorMaster.create({
    data: {
      name: "SIVAKASI FIREWORKS LTD",
      origin: "SIVAKASI",
      gstn: "33AAAAA1111A1Z1",
      mobile: "9988776655"
    }
  });

  const consignor2 = await prisma.consignorMaster.create({
    data: {
      name: "STANDARD CRACKERS FACTORY",
      origin: "SIVAKASI",
      gstn: "33BBBBB2222B2Z2",
      mobile: "9876543210"
    }
  });

  console.log("✓ Consignors seeded");

  // 2. Create Consignee Masters
  const consignee1 = await prisma.consigneeMaster.create({
    data: {
      name: "MUMBAI FIRECRACKER MART",
      destination: "MUMBAI",
      gstn: "27CCCCC3333C3Z3",
      mobile: "9123456789"
    }
  });

  const consignee2 = await prisma.consigneeMaster.create({
    data: {
      name: "DELHI CRACKERS DEPOT",
      destination: "DELHI",
      gstn: "07DDDDD4444D4Z4",
      mobile: "9234567890"
    }
  });

  console.log("✓ Consignees seeded");

  // 3. Create Users with link mappings
  // Admin
  await prisma.user.create({
    data: {
      email: "admin@example.com",
      phone: "9999988888",
      passwordHash,
      firstName: "Super",
      lastName: "Admin",
      role: "admin",
      loginId: "ADM01",
      isApproved: true,
      isDefaultPassword: false,
    }
  });

  // Staff
  await prisma.user.create({
    data: {
      email: "staff@example.com",
      phone: "8888877777",
      passwordHash,
      firstName: "Rajesh",
      lastName: "Kumar",
      role: "staff",
      loginId: "STF01",
      isApproved: true,
      staffPermission: "EDIT",
      isDefaultPassword: false,
    }
  });

  // Staff (View Only)
  await prisma.user.create({
    data: {
      email: "viewstaff@example.com",
      phone: "8888877778",
      passwordHash,
      firstName: "Kumar",
      lastName: "Rao",
      role: "staff",
      loginId: "STF02",
      isApproved: true,
      staffPermission: "ENTER_VIEW",
      isDefaultPassword: false,
    }
  });

  // Customer linked to Consignor1
  await prisma.user.create({
    data: {
      email: "customer@example.com",
      phone: "7777766666",
      passwordHash,
      firstName: "Amit",
      lastName: "Shah",
      role: "customer",
      loginId: "CST01",
      isApproved: true,
      isDefaultPassword: false,
      linkedConsignorId: consignor1.id,
    }
  });

  console.log("✓ Users seeded: Admin (ADM01), Staff (STF01), Staff-View (STF02), Customer (CST01)");

  // 4. Create Lorry Masters
  const lorry1 = await prisma.lorryMaster.create({
    data: {
      lorryNumber: "TN-67-X-9988",
      lorryName: "ASHOK LEYLAND 1615",
      ownerName: "VIGNESH TRANSPORT",
      ownerContact: "9845123456",
      driverName: "MUTHU KUMAR",
      driverContact: "9845654321",
      drivingLicenseNumber: "DL-TN6712345"
    }
  });

  const lorry2 = await prisma.lorryMaster.create({
    data: {
      lorryNumber: "MH-12-PQ-4567",
      lorryName: "TATA LPT 1918",
      ownerName: "MAHARASHTRA LOGISTICS",
      ownerContact: "8888877777",
      driverName: "RAMESH SHINDE",
      driverContact: "7777788888",
      drivingLicenseNumber: "DL-MH1298765"
    }
  });

  console.log("✓ Lorries seeded");

  // 5. Create Goods Consignments (GC / LR)
  const gc1 = await prisma.goodsConsignment.create({
    data: {
      gcNumber: "D00023",
      consignorId: consignor1.id,
      consigneeId: consignee1.id,
      fromCity: "SIVAKASI",
      toCity: "MUMBAI",
      invoiceNo: "INV-2026-001",
      value: 120000.0,
      mark: "SRK",
      godown: "A12",
      delivery: "DOOR DELIVERY",
      hamali: 250.0,
      stCharges: 50.0,
      others: 100.0,
      charWt: 15.0,
      rateKg: 145.0,
      freight: 15.0 * 145.0, // 2175.0
      serviceTaxPercent: 5.0,
      serviceTax: (15.0 * 145.0) * 0.05, // 108.75
      total: 120000.0 + (15.0 * 145.0) + ((15.0 * 145.0) * 0.05) + 250.0 + 50.0 + 100.0, // Cargo Value + Freight + ST + Hamali + StCharges + Others
      paymentStatus: "To/Pay",
      quantity: 15,
      saidToContainCode: "1",
      saidToContainDesc: "FIREWORKS",
      printType: "LORRY COPY",
      serviceTaxPayableBy: "Consignee",
      approvalStatus: "APPROVED",
      enteredById: "STF01",
      enteredByName: "Rajesh Kumar"
    }
  });

  const gc2 = await prisma.goodsConsignment.create({
    data: {
      gcNumber: "D02247",
      consignorId: consignor2.id,
      consigneeId: consignee2.id,
      fromCity: "SIVAKASI",
      toCity: "DELHI",
      invoiceNo: "INV-2026-002",
      value: 85000.0,
      mark: "GMS",
      godown: "B04",
      delivery: "GODOWN DELIVERY",
      hamali: 150.0,
      stCharges: 30.0,
      others: 0.0,
      charWt: 20.0,
      rateKg: 145.0,
      freight: 20.0 * 145.0, // 2900.0
      serviceTaxPercent: 5.0,
      serviceTax: (20.0 * 145.0) * 0.05, // 145.0
      total: 85000.0 + (20.0 * 145.0) + ((20.0 * 145.0) * 0.05) + 150.0 + 30.0 + 0.0,
      paymentStatus: "Paid",
      quantity: 20,
      saidToContainCode: "1",
      saidToContainDesc: "FIREWORKS",
      printType: "LORRY COPY",
      serviceTaxPayableBy: "Consignee",
      approvalStatus: "APPROVED",
      enteredById: "STF01",
      enteredByName: "Rajesh Kumar"
    }
  });

  const gcPending = await prisma.goodsConsignment.create({
    data: {
      gcNumber: "D02248",
      consignorId: consignor1.id,
      consigneeId: consignee2.id,
      fromCity: "SIVAKASI",
      toCity: "DELHI",
      invoiceNo: "INV-2026-003",
      value: 45000.0,
      mark: "JAY",
      godown: "C01",
      delivery: "DOOR DELIVERY",
      hamali: 100.0,
      stCharges: 20.0,
      others: 10.0,
      charWt: 10.0,
      rateKg: 145.0,
      freight: 1450.0,
      serviceTaxPercent: 5.0,
      serviceTax: 72.50,
      total: 45000.0 + 1450.0 + 72.50 + 100.0 + 20.0 + 10.0,
      paymentStatus: "To/Pay",
      quantity: 10,
      saidToContainCode: "2",
      saidToContainDesc: "CAPS",
      printType: "LORRY COPY",
      serviceTaxPayableBy: "Consignee",
      approvalStatus: "PENDING_APPROVAL",
      enteredById: "STF01",
      enteredByName: "Rajesh Kumar"
    }
  });

  console.log("✓ Consignments (GCs) seeded: D00023, D02247, D02248 (Pending)");

  // 6. Create Goods Dispatch Memo (GDM)
  const gdm1 = await prisma.goodsDispatchMemo.create({
    data: {
      gdmNumber: "D00142",
      fromCity: "SIVAKASI",
      toCity: "DELHI",
      lorryId: lorry1.id,
      remarks: "Direct dispatch via National Highway",
      totalQty: gc1.quantity + gc2.quantity,
      totalDesp: gc1.quantity + gc2.quantity,
      totalServiceTax: gc1.serviceTax + gc2.serviceTax,
      approvalStatus: "APPROVED",
      enteredById: "STF01",
      enteredByName: "Rajesh Kumar"
    }
  });

  // Seed GDMItems
  await prisma.gDMItem.create({
    data: {
      gdmId: gdm1.id,
      goodsConsignmentId: gc1.id,
      qty: gc1.quantity,
      desp: gc1.quantity,
      serviceTax: gc1.serviceTax
    }
  });

  await prisma.gDMItem.create({
    data: {
      gdmId: gdm1.id,
      goodsConsignmentId: gc2.id,
      qty: gc2.quantity,
      desp: gc2.quantity,
      serviceTax: gc2.serviceTax
    }
  });

  console.log(`✓ Seeded Goods Dispatch Memo ${gdm1.gdmNumber} with GDMItems`);
  console.log("✅ Seed database setup finished!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
