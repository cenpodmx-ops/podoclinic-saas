import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // ===== Clínicas =====
  const c1 = await prisma.clinic.upsert({
    where: { slug: 'clinica-1' },
    update: {},
    create: {
      name: 'Clínica CENPOD 1',
      slug: 'clinica-1',
      address: 'Av. Obregón 123, Hermosillo, Sonora',
      phone: '6621234567',
      email: 'clinica1@cenpod.com',
      openingTime: '08:00',
      closingTime: '20:00',
      slotMinutes: 30,
      rfc: 'CEN010101AB1',
      razonSocial: 'Grupo CENPOD Clínica 1 S.A. de C.V.',
      regimenFiscal: '601 - General de Ley Personas Morales',
    },
  })

  const c2 = await prisma.clinic.upsert({
    where: { slug: 'clinica-2' },
    update: {},
    create: {
      name: 'Clínica CENPOD 2',
      slug: 'clinica-2',
      address: 'Blvd. Navarrete 456, Hermosillo, Sonora',
      phone: '6627654321',
      email: 'clinica2@cenpod.com',
      openingTime: '09:00',
      closingTime: '19:00',
      slotMinutes: 30,
    },
  })

  const c3 = await prisma.clinic.upsert({
    where: { slug: 'clinica-3' },
    update: {},
    create: {
      name: 'Clínica CENPOD 3',
      slug: 'clinica-3',
      address: 'Calle Sonora 789, Hermosillo, Sonora',
      phone: '6629876543',
      email: 'clinica3@cenpod.com',
      openingTime: '08:00',
      closingTime: '18:00',
      slotMinutes: 30,
    },
  })

  const dist = await prisma.clinic.upsert({
    where: { slug: 'distribuidora' },
    update: {},
    create: {
      name: 'CENPOD Distribuidora',
      slug: 'distribuidora',
      address: 'Bodega Central, Hermosillo, Sonora',
      phone: '6621112222',
      email: 'distribuidora@cenpod.com',
      isDistributor: true,
    },
  })

  const matrix = await prisma.clinic.upsert({
    where: { slug: 'matriz' },
    update: {},
    create: {
      name: 'Matriz CENPOD',
      slug: 'matriz',
      isMatrix: true,
      phone: '6620000000',
      email: 'matriz@cenpod.com',
    },
  })

  // ===== Podólogos =====
  const p1 = await prisma.podologist.upsert({
    where: { id: 'pod-001' },
    update: {},
    create: {
      id: 'pod-001',
      clinicId: c1.id,
      name: 'Dr. Ricardo Méndez',
      specialty: 'Podología general',
      cedula: '12345678',
      certNumber: 'CPOD-001',
      phone: '6621000001',
      email: 'ricardo@cenpod.com',
      commissionPct: 25,
      monthlyGoalConsults: 80,
      monthlyGoalRevenue: 60000,
    },
  })

  const p2 = await prisma.podologist.upsert({
    where: { id: 'pod-002' },
    update: {},
    create: {
      id: 'pod-002',
      clinicId: c1.id,
      name: 'Dra. Laura Quijano',
      specialty: 'Onicocriptosis y cirugía ungueal',
      cedula: '87654321',
      certNumber: 'CPOD-002',
      phone: '6621000002',
      email: 'laura@cenpod.com',
      commissionPct: 22,
      monthlyGoalConsults: 70,
      monthlyGoalRevenue: 55000,
    },
  })

  const p3 = await prisma.podologist.upsert({
    where: { id: 'pod-003' },
    update: {},
    create: {
      id: 'pod-003',
      clinicId: c2.id,
      name: 'Dr. Andrés Soto',
      specialty: 'Pie diabético',
      cedula: '11223344',
      certNumber: 'CPOD-003',
      phone: '6621000003',
      email: 'andres@cenpod.com',
      commissionPct: 28,
      monthlyGoalConsults: 75,
      monthlyGoalRevenue: 65000,
    },
  })

  // ===== Usuarios =====
  const hash = (s: string) => bcrypt.hashSync(s, 10)

  await prisma.user.upsert({
    where: { email: 'super@cenpod.com' },
    update: {},
    create: {
      email: 'super@cenpod.com',
      name: 'Súper Dueño CENPOD',
      passwordHash: hash('cenpod123'),
      role: 'SUPER',
      clinicId: matrix.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'dueno@cenpod.com' },
    update: {},
    create: {
      email: 'dueno@cenpod.com',
      name: 'Dueño Clínica 1',
      passwordHash: hash('cenpod123'),
      role: 'OWNER',
      clinicId: c1.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'recepcion@cenpod.com' },
    update: {},
    create: {
      email: 'recepcion@cenpod.com',
      name: 'Recepción Clínica 1',
      passwordHash: hash('cenpod123'),
      role: 'RECEPTION',
      clinicId: c1.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'ricardo@cenpod.com' },
    update: {},
    create: {
      email: 'ricardo@cenpod.com',
      name: 'Dr. Ricardo Méndez',
      passwordHash: hash('cenpod123'),
      role: 'PODOLOGIST',
      clinicId: c1.id,
      podologistId: p1.id,
    },
  })

  // ===== Servicios =====
  const services = [
    { name: 'Consulta general', durationMin: 30, price: 600, commissionPct: 25, ivaType: 'EXENTO' },
    { name: 'Onicocriptosis', durationMin: 45, price: 900, commissionPct: 25, ivaType: 'EXENTO' },
    { name: 'Ortoniquia', durationMin: 60, price: 1500, commissionPct: 25, ivaType: 'EXENTO' },
    { name: 'Quiropodia', durationMin: 45, price: 800, commissionPct: 22, ivaType: 'EXENTO' },
    { name: 'Infiltraciones', durationMin: 30, price: 1200, commissionPct: 28, ivaType: 'EXENTO' },
    { name: 'Curación avanzada', durationMin: 30, price: 500, commissionPct: 20, ivaType: 'EXENTO' },
    { name: 'Limpieza profunda', durationMin: 60, price: 1000, commissionPct: 22, ivaType: 'EXENTO' },
  ]

  for (const clinic of [c1, c2, c3]) {
    for (const s of services) {
      await prisma.service.create({
        data: { ...s, clinicId: clinic.id },
      })
    }
  }

  // ===== Pacientes demo =====
  const pacientesData = [
    { firstName: 'María', lastName: 'González', phone: '6622000001', isDiabetic: true, riskLevel: 'ALTO' },
    { firstName: 'Juan', lastName: 'Pérez', phone: '6622000002', isDiabetic: false, riskLevel: 'BAJO' },
    { firstName: 'Carmen', lastName: 'Ruiz', phone: '6622000003', isDiabetic: true, riskLevel: 'MEDIO' },
    { firstName: 'Pedro', lastName: 'López', phone: '6622000004', isDiabetic: false, riskLevel: 'BAJO' },
    { firstName: 'Rosa', lastName: 'Martínez', phone: '6622000005', isDiabetic: false, riskLevel: 'MEDIO', allergies: 'Penicilina' },
    { firstName: 'Jorge', lastName: 'Ramírez', phone: '6622000006', isDiabetic: true, riskLevel: 'ALTO' },
  ]

  let expCounter = 1
  for (const pd of pacientesData) {
    await prisma.patient.create({
      data: {
        clinicId: c1.id,
        expNumber: `C1-${String(expCounter).padStart(5, '0')}`,
        ...pd,
        birthDate: new Date(1975, 0, 1),
        sex: 'M',
      },
    })
    expCounter++
  }

  // ===== Citas para HOY =====
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const pacientes = await prisma.patient.findMany({ where: { clinicId: c1.id } })
  const statuses = ['PENDIENTE', 'CONFIRMADA', 'FINALIZADA', 'CANCELADA', 'NO_ASISTIO']

  const baseSvc = await prisma.service.findFirst({ where: { clinicId: c1.id, name: 'Consulta general' } })

  for (let i = 0; i < pacientes.length; i++) {
    const patient = pacientes[i]
    const pod = i % 2 === 0 ? p1 : p2
    const startHour = 8 + i * 1.5
    const start = new Date(today)
    start.setHours(Math.floor(startHour), (startHour % 1) * 60, 0, 0)
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 30)

    const status = i < 4 ? statuses[i] : (i === 4 ? 'CONFIRMADA' : 'PENDIENTE')

    await prisma.appointment.create({
      data: {
        clinicId: c1.id,
        patientId: patient.id,
        podologistId: pod.id,
        date: today,
        startTime: start,
        endTime: end,
        reason: ['Consulta general', 'Dolor en uña', 'Seguimiento pie diabético', 'Quiropodia'][i % 4],
        status,
        serviceId: baseSvc?.id,
        serviceName: baseSvc?.name,
        price: baseSvc?.price,
      },
    })
  }

  // Una cita para mañana
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tStart = new Date(tomorrow)
  tStart.setHours(10, 0, 0, 0)
  await prisma.appointment.create({
    data: {
      clinicId: c1.id,
      patientId: pacientes[0].id,
      podologistId: p1.id,
      date: tomorrow,
      startTime: tStart,
      endTime: new Date(tStart.getTime() + 30 * 60000),
      reason: 'Seguimiento',
      status: 'CONFIRMADA',
      serviceId: baseSvc?.id,
      serviceName: baseSvc?.name,
      price: baseSvc?.price,
    },
  })

  // ===== Productos de inventario =====
  const productos = [
    { name: 'Crema hidratante podal', category: 'PRODUCTO', costPrice: 80, salePrice: 180, ivaType: 'IVA16', stock: 25, minStock: 5, supplier: 'Distribuidora CENPOD' },
    { name: 'Talco antifúngico', category: 'PRODUCTO', costPrice: 45, salePrice: 120, ivaType: 'IVA16', stock: 3, minStock: 5, supplier: 'Distribuidora CENPOD' },
    { name: 'Ibuprofeno 400mg', category: 'MEDICAMENTO', costPrice: 5, salePrice: 25, ivaType: 'IVA0', stock: 100, minStock: 20, supplier: 'Farmacia del Norte' },
    { name: 'Amoxicilina 500mg', category: 'MEDICAMENTO', costPrice: 8, salePrice: 40, ivaType: 'IVA0', stock: 50, minStock: 10, supplier: 'Farmacia del Norte' },
    { name: 'Gasa estéril', category: 'MATERIAL', costPrice: 2, salePrice: 10, ivaType: 'IVA0', stock: 200, minStock: 30, supplier: 'Insumos Médicos SA' },
    { name: 'Hojas de bisturí N°15', category: 'MATERIAL', costPrice: 3, salePrice: 15, ivaType: 'IVA0', stock: 80, minStock: 20, supplier: 'Insumos Médicos SA' },
    { name: 'Anestésico lidocaína', category: 'MEDICAMENTO', costPrice: 20, salePrice: 60, ivaType: 'IVA0', stock: 30, minStock: 10, supplier: 'Farmacia del Norte' },
    { name: 'Aceite esencial de árbol de té', category: 'PRODUCTO', costPrice: 60, salePrice: 150, ivaType: 'IVA16', stock: 8, minStock: 5, supplier: 'Distribuidora CENPOD' },
  ]

  for (const p of productos) {
    await prisma.product.create({ data: { ...p, clinicId: c1.id } })
  }

  // ===== Configuración por clínica =====
  for (const c of [c1, c2, c3]) {
    await prisma.clinicConfig.upsert({
      where: { clinicId: c.id },
      update: {},
      create: {
        clinicId: c.id,
        tplConfirm: 'Hola {{nombre_paciente}}, te recordamos tu cita en CENPOD {{clinica}} el día {{fecha}} a las {{hora}} con {{podologo}}. Confirmamos tu asistencia respondiendo a este mensaje.',
        tplReminder: 'Hola {{nombre_paciente}}, en 24h tienes cita en CENPOD con {{podologo}} el {{fecha}} a las {{hora}}. ¡Te esperamos!',
        tplGoogleReview: '¡Gracias por tu visita, {{nombre_paciente}}! Nos encantaría que nos califiques: {{link_reserva}}',
        tplBirthday: '¡Feliz cumpleaños, {{nombre_paciente}}! 🎂 CENPOD te desea un excelente día. Agenda tu revisión anual con un 10% de descuento.',
        tplInactive: 'Hola {{nombre_paciente}}, notamos que no nos visitas hace tiempo. Tu salud podológica es importante. Agenda con {{link_reserva}}',
        tplFollowUp: 'Hola {{nombre_paciente}}, es momento de tu seguimiento podológico. Agenda con {{podologo}} en {{link_reserva}}',
        diagnosesList: JSON.stringify(['Onicocriptosis', 'Onicomicosis', 'Hallux valgus', 'Pie diabético', 'Heloma', 'Verruga plantar', 'Hiperqueratosis', 'Grieta plantar']),
        holidaysJson: JSON.stringify([]),
      },
    })
  }

  // ===== Equipos =====
  await prisma.equipment.create({
    data: {
      clinicId: c1.id,
      name: 'Fresadora podológica',
      brand: 'Podiatrix',
      model: 'F-2000',
      serialNumber: 'FX-2024-001',
      acquisitionDate: new Date(2024, 0, 15),
      serviceProvider: 'Servicio Técnico Méndez',
      lastCalibration: new Date(2025, 9, 1),
      nextMaintenance: new Date(2026, 3, 1),
    },
  })
  await prisma.equipment.create({
    data: {
      clinicId: c1.id,
      name: 'Autoclave',
      brand: 'Getinge',
      model: 'HS66',
      serialNumber: 'HS-2023-045',
      acquisitionDate: new Date(2023, 5, 10),
      serviceProvider: 'Esterilización SA',
      lastCalibration: new Date(2025, 11, 1),
      nextMaintenance: new Date(2026, 5, 1),
    },
  })

  console.log('Seed completo ✓')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
