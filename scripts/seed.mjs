// Seed script — creates default users. Run: bun scripts/seed.mjs
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db'
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const db = new PrismaClient()

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const users = [
  { username: 'admin', password: 'admin123', fullName: 'مدیر سیستم', role: 'ADMIN', email: 'admin@rd.local' },
  { username: 'control', password: 'control123', fullName: 'کارشناس کنترل پروژه', role: 'PROJECT_CONTROL', email: 'control@rd.local' },
  { username: 'nazer', password: 'nazer123', fullName: 'ناظر نمونه (علی گشاس)', role: 'SUPERVISOR', email: 'nazer@rd.local' },
]

async function main() {
  for (const u of users) {
    await db.user.upsert({
      where: { username: u.username },
      update: { role: u.role, fullName: u.fullName },
      create: { ...u, password: hashPassword(u.password) },
    })
    console.log(`✔ user ready: ${u.username} / ${u.password} (${u.role})`)
  }
  console.log('Seed done.')
}

main().finally(() => db.$disconnect())
