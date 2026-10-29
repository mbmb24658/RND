// =====================================================================
//  scripts/etl.mjs — ETL migration: upload/DB.xlsx → Prisma SQLite
//  Run: bun scripts/etl.mjs
//  Migrates sheet 'MainTable' (628 rows × 68 cols) into Project /
//  Institute / Payment / Extension / ProjectItem with strict, auditable
//  date & amount parsing. Idempotent (upsert by project code).
// =====================================================================

// --- env BEFORE PrismaClient ---------------------------------------
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

try {
  const envText = readFileSync(join(ROOT, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* .env optional */ }
// Hard guarantee (per spec):
process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:/home/z/my-project/db/custom.db';

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import { toGregorian as jalaaliToGregorian, isValidJalaaliDate as jalaaliIsValid } from 'jalaali-js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
const XLSX_PATH = join(ROOT, 'upload', 'DB.xlsx');
const SHEET = 'MainTable';
const REPORT_PATH = join(__dirname, 'etl-report.json');

const STATUS_MAP = {
  'خاتمه یافته': 'COMPLETED',
  'باطل شد': 'CANCELLED',
  'فعال': 'ACTIVE',
  'فسخ شده': 'TERMINATED',
  'غیر فعال': 'INACTIVE',
};

// Column header names (matched by trimmed header text)
const COL = {
  code: 'کد پروژه',
  archiveNumber: 'شماره بایگانی',
  contractNumber: 'شماره قرارداد',
  contractDate: 'تاریخ قرارداد',
  amount: 'مبلغ پروژه',
  durationMonths: 'مدت زمان پروژه(ماه)',
  groupName: 'نام گروه',
  registrationDate: 'تاریخ ثبت',
  executorName: 'نام مجری',
  title: 'عنوان پروژه',
  institute: 'نام مؤسسه یا دانشگاه',
  managerName: 'نام مدیر پروژه',
  supervisorNames: 'نام ناظر',
  status: 'وضعیت پروژه',
  extensionDate: 'تاریخ تمدید پروژه',
  extensionDuration: 'مدت زمان تمدید',
  startDate: 'تاریخ شروع به کار مجری',
  endDate: 'تاریخ پایان کار مجری',
  startLetterNumber: 'شماره نامه شروع به کار',
  financeReferralDate: 'تاریخ معرفی پروژه به امور مالی',
  financeReferralNumber: 'شماره نامه معرفی به امور مالی',
  supervisionPaidAt: 'تاریخ پرداخت حق الزحمه نظارت',
  supervisionLetterNumber: 'شماره نامه پرداخت نظارت',
  supervisionType: 'نوع نظارت',
  seminarDate: 'تاریخ سمینار',
  supervisionFee: 'مبلغ نظارت',
  settlementDate: 'تاریخ تسویه حساب',
  notes: 'توضیحات',
  companyName: 'نام شرکت',
  researchType: 'نوع طرح',
  paidAmount: 'مبلغ پرداخت شده',
  plannedProgress: 'درصد پیشرفت برنامه',
  actualProgress: 'درصد پیشرفت واقعی',
  caseManager: 'مسئول پرونده',
  letterSubject: 'عنوان نامه',
  letterDate: 'تاریخ',
  letterNumber: 'شماره نامه',
  letterAmount: 'مبلغ',
  documentNumber: 'شماره سند',
  documentDate: 'تاریخ سند',
  netAmount: 'مبلغ خالص',
  itemName: 'نام کالای یا مواد مورد نیاز',
  internalSource: 'منبع داخلی',
  externalSource: 'منبع خارجی',
  activityRow: 'ردیف فعالیت مرتبط',
  consumable: 'کالای مصرفی',
  nonConsumable: 'کالای غیر مصرفی',
  quantity: 'مقدار',
  unit: 'واحد',
  unitPriceRial: 'قیمت واحد ریالی',
  unitPriceCurrency: 'قیمت واحد ارزی',
  totalPriceRial: 'قیمت کل ریالی',
  totalPriceCurrency: 'قیمت کل ارزی',
  totalPaidLegacy: 'مبلغ پرداخت شده تا کنون',
  bankAccountNote: 'شماره حساب و بانک',
  hasRegulation: 'آئین نامه',
  hasPrepaymentGuarantee: 'تضمین پیش پرداخت',
  hasGoodPerformance: 'حسن انجام کار',
  hasGuaranteeRefund: 'استرداد تضمین',
  yesNo: 'آری/خیر',
  finalStatusNote: 'وضعیت نهایی',
};

// ---------------------------------------------------------------------
// Counters / report
// ---------------------------------------------------------------------
const report = {
  startedAt: new Date().toISOString(),
  totalRows: 0,
  projectsCreated: 0,
  projectsUpdated: 0,
  skipped: 0,
  payments: 0,
  extensions: 0,
  items: 0,
  institutes: 0,
  dateParseFailures: {},   // column header -> count
  amountParseFailures: {}, // column header -> count
  anomalies: [],
};
const DATE_FAIL = report.dateParseFailures;
const AMT_FAIL = report.amountParseFailures;
function bump(obj, key) { obj[key] = (obj[key] || 0) + 1; }
function anomaly(msg) {
  report.anomalies.push(msg);
  if (report.anomalies.length <= 200) console.warn('  ⚠ anomaly:', msg);
}

// ---------------------------------------------------------------------
// Low-level normalizers
// ---------------------------------------------------------------------
const FA = '۰۱۲۳۴۵۶۷۸۹', AR = '٠١٢٣٤٥٦٧٨٩';
function normalizeDigits(s) {
  return s.replace(/[۰-۹]/g, d => String(FA.indexOf(d)))
          .replace(/[٠-٩]/g, d => String(AR.indexOf(d)));
}
function cleanStr(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  let s = String(v);
  s = normalizeDigits(s).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}
function parseBool(v, def = false) {
  if (v === null || v === undefined || v === '') return def;
  if (typeof v === 'boolean') return v;
  const s = normalizeDigits(String(v)).trim().toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return def;
}

// ---------------------------------------------------------------------
// DATE PARSING (strict — never guess)
// ---------------------------------------------------------------------
function serialToDateUTC(serial) {
  const ms = Math.round((serial - 25569) * 86400000);
  const d = new Date(ms);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function ymdToUTC(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }

function parseDateValue(v, colName) {
  if (v === null || v === undefined || v === '') return null;

  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return serialToDateUTC(v);
  }
  const s = normalizeDigits(String(v)).replace(/\s+/g, ' ').trim();
  if (s === '') return null;

  // a) Y/M/D  (Jalali 1300-1500 or Gregorian 1900-2100)
  let m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y >= 1300 && y <= 1500) {
      try {
        if (!jalaaliIsValid(y, mo, d)) throw new Error('invalid jalali');
        const g = jalaaliToGregorian(y, mo, d);
        return ymdToUTC(g.gy, g.gm, g.gd);
      } catch {
        bump(DATE_FAIL, colName);
        return null;
      }
    }
    if (y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return ymdToUTC(y, mo, d);
    }
    bump(DATE_FAIL, colName);
    return null;
  }

  // b) D/M/Y (Gregorian, e.g. 26/10/2019)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return ymdToUTC(y, mo, d);
    }
    bump(DATE_FAIL, colName);
    return null;
  }

  // c) garbage → null
  bump(DATE_FAIL, colName);
  return null;
}

// ---------------------------------------------------------------------
// AMOUNT PARSING → BigInt (Rial)
// ---------------------------------------------------------------------
function parseAmount(v, colName, countFailures = true) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.round(v));
  let s = normalizeDigits(String(v));
  // drop common Persian money words
  s = s.replace(/ريال|ریال|مبلغ|لظا مبلی/g, ' ');
  const m = s.match(/[-+]?\d[\d,٬]*(?:\.\d+)?(?:[Ee][+-]?\d+)?/);
  if (!m) {
    if (countFailures) bump(AMT_FAIL, colName);
    return null;
  }
  let tok = m[0].replace(/[٬,]/g, '');
  // exponent or decimal → parseFloat first (e.g. 2.55E+09)
  let n;
  if (/[Ee][+-]?\d+/.test(tok) || /\./.test(tok)) {
    n = parseFloat(tok);
    if (!Number.isFinite(n)) { if (countFailures) bump(AMT_FAIL, colName); return null; }
    n = Math.round(n);
  } else {
    n = parseInt(tok, 10);
    if (!Number.isFinite(n)) { if (countFailures) bump(AMT_FAIL, colName); return null; }
  }
  return BigInt(n);
}

// ---------------------------------------------------------------------
// FLOAT PARSING (progress %, months, quantities)
// Persian decimal slash: "13/5" → 13.5, "9/35161290322581" → 9.3516…
// ---------------------------------------------------------------------
function parseFirstFloat(v, colName, countFailures = true) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = normalizeDigits(String(v)).replace(/\s+/g, ' ').trim();
  if (s === '') return null;
  // Persian decimal separator "/"
  let m = s.match(/^(-?\d+)\/(\d+)$/);
  if (m) return parseFloat(`${m[1]}.${m[2]}`);
  m = s.match(/[-+]?\d+(?:\.\d+)?/);
  if (!m) { if (countFailures) bump(AMT_FAIL, colName); return null; }
  const n = parseFloat(m[0]);
  if (!Number.isFinite(n)) { if (countFailures) bump(AMT_FAIL, colName); return null; }
  return n;
}

// مدت زمان پروژه(ماه): number | "12م"/"12 ما" | "20روز"/"120رو" | "13/5"
// Junk serial numbers (≥4000, i.e. someone typed an Excel date here) → null.
function parseDurationMonths(v, colName, ctx = '') {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && Number.isFinite(v)) {
    if (v >= 4000) {
      anomaly(`${ctx}مدت زمان پروژه(ماه)=${v} looks like an Excel date serial — durationMonths stored as null`);
      return null;
    }
    return v;
  }
  const s = normalizeDigits(String(v)).replace(/\s+/g, ' ').trim();
  if (s === '') return null;
  if (/رو/.test(s)) {           // روز (or truncated "رو") → days → months
    const n = parseFirstFloat(s, colName);
    return n === null ? null : n / 30;
  }
  if (/ما/.test(s)) {           // ماه (or truncated "ما") → months
    return parseFirstFloat(s, colName);
  }
  return parseFirstFloat(s, colName);
}

// مدت زمان تمدید → { months, days, junk }
function parseExtensionDuration(v) {
  if (v === null || v === undefined || v === '') return { months: null, days: null, junk: false };
  const raw = String(v);
  let num = v;
  if (typeof v === 'string') {
    const s = normalizeDigits(v).trim();
    if (s === '') return { months: null, days: null, junk: false };
    if (/رو/.test(s)) {
      const n = parseFirstFloat(s, null, false);
      return { months: n === null ? null : Math.round((n / 30) * 10) / 10, days: n, junk: n === null };
    }
    if (/ما/.test(s)) {
      const n = parseFirstFloat(s, null, false);
      return { months: n, days: null, junk: n === null };
    }
    num = parseFirstFloat(s, null, false);
    if (num === null) return { months: null, days: null, junk: true };
  }
  if (num >= 4000) return { months: null, days: null, junk: true };          // junk serial
  if (num < 0) return { months: null, days: null, junk: true };              // negative junk
  if (num <= 60) return { months: num, days: null, junk: false };
  return { months: Math.round((num / 30) * 10) / 10, days: num, junk: false }; // 60<v<4000 → days
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main() {
  console.log('▶ Reading Excel:', XLSX_PATH);
  const wb = XLSX.readFile(XLSX_PATH, { cellDates: false });
  const ws = wb.Sheets[SHEET];
  if (!ws) throw new Error(`Sheet "${SHEET}" not found. Sheets: ${wb.SheetNames.join(', ')}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const header = rows[0].map(h => String(h).trim());
  const data = rows.slice(1).filter(r => r.some(c => c !== null && c !== ''));
  report.totalRows = data.length;
  console.log(`▶ Header cols: ${header.length}, data rows: ${data.length}`);

  // header index map (by trimmed header NAME — not fixed index)
  const I = {};
  for (const [key, name] of Object.entries(COL)) {
    const idx = header.indexOf(name);
    if (idx === -1) throw new Error(`Column not found in Excel: "${name}" (field ${key})`);
    I[key] = idx;
  }

  const instituteCache = new Map(); // normalized name -> id
  async function getInstituteId(rawName, rowIndex) {
    const name = cleanStr(rawName);
    if (!name) return null;
    if (instituteCache.has(name)) return instituteCache.get(name);
    const inst = await prisma.institute.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    instituteCache.set(name, inst.id);
    return inst.id;
  }

  const codeDupes = new Map();

  for (let r = 0; r < data.length; r++) {
    const row = data[r];
    const excelRowNo = r + 2; // 1-based incl header

    const code = cleanStr(row[I.code]);
    if (!code) {
      report.skipped++;
      anomaly(`row ${excelRowNo}: empty کد پروژه — skipped`);
      continue;
    }
    if (codeDupes.has(code)) anomaly(`row ${excelRowNo}: duplicate کد پروژه ${code} (first seen row ${codeDupes.get(code)}) — upserted again`);
    else codeDupes.set(code, excelRowNo);

    if ((r + 1) % 100 === 0) console.log(`  … ${r + 1}/${data.length} rows processed`);

    // ---------- status ----------
    let status = 'ACTIVE';
    let statusNote = null;
    const rawStatus = cleanStr(row[I.status]);
    if (rawStatus) {
      const norm = rawStatus.replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/\s+/g, ' ').trim();
      if (STATUS_MAP[norm]) status = STATUS_MAP[norm];
      else { status = 'ACTIVE'; statusNote = rawStatus; }
    }

    // ---------- simple fields ----------
    const title = cleanStr(row[I.title]) ?? '';
    if (title === '') anomaly(`row ${excelRowNo} (کد ${code}): empty عنوان پروژه — stored as ""`);
    const amount = parseAmount(row[I.amount], COL.amount) ?? 0n;
    const durationMonths = parseDurationMonths(row[I.durationMonths], COL.durationMonths, `row ${excelRowNo} (کد ${code}): `);
    const plannedProgress = (() => {
      const n = parseFirstFloat(row[I.plannedProgress], COL.plannedProgress);
      if (n === null) return null;
      if (n < 0) return null;
      if (n > 1000) return null;
      return n;
    })();
    const actualProgress = (() => {
      const n = parseFirstFloat(row[I.actualProgress], COL.actualProgress);
      if (n === null) return null;
      if (n < 0) return null;
      if (n > 1000) return null;
      return n;
    })();

    const kind = cleanStr(row[I.contractNumber]) ? 'PROJECT' : 'PROPOSAL';

    const projectData = {
      kind,
      code,
      archiveNumber: cleanStr(row[I.archiveNumber]),
      contractNumber: cleanStr(row[I.contractNumber]),
      contractDate: parseDateValue(row[I.contractDate], COL.contractDate),
      title,
      notes: cleanStr(row[I.notes]),
      amount,
      durationMonths,
      groupName: cleanStr(row[I.groupName]),
      registrationDate: parseDateValue(row[I.registrationDate], COL.registrationDate),
      executorName: cleanStr(row[I.executorName]),
      managerName: cleanStr(row[I.managerName]),
      supervisorNames: cleanStr(row[I.supervisorNames]),
      status,
      statusNote,
      finalStatusNote: cleanStr(row[I.finalStatusNote]),
      startDate: parseDateValue(row[I.startDate], COL.startDate),
      endDate: parseDateValue(row[I.endDate], COL.endDate),
      startLetterNumber: cleanStr(row[I.startLetterNumber]),
      financeReferralDate: parseDateValue(row[I.financeReferralDate], COL.financeReferralDate),
      financeReferralNumber: cleanStr(row[I.financeReferralNumber]),
      seminarDate: parseDateValue(row[I.seminarDate], COL.seminarDate),
      settlementDate: parseDateValue(row[I.settlementDate], COL.settlementDate),
      supervisionType: cleanStr(row[I.supervisionType]),
      supervisionFee: parseAmount(row[I.supervisionFee], COL.supervisionFee) ?? 0n,
      supervisionPaidAt: parseDateValue(row[I.supervisionPaidAt], COL.supervisionPaidAt),
      supervisionLetterNumber: cleanStr(row[I.supervisionLetterNumber]),
      plannedProgress,
      actualProgress,
      totalPaidLegacy: row[I.totalPaidLegacy] === null || row[I.totalPaidLegacy] === '' ? null : normalizeDigits(String(row[I.totalPaidLegacy])).trim(),
      bankAccountNote: cleanStr(row[I.bankAccountNote]), // NEVER parsed as amount
      hasRegulation: parseBool(row[I.hasRegulation]),
      hasPrepaymentGuarantee: parseBool(row[I.hasPrepaymentGuarantee]),
      hasGoodPerformance: parseBool(row[I.hasGoodPerformance]),
      hasGuaranteeRefund: parseBool(row[I.hasGuaranteeRefund]),
      yesNo: parseBool(row[I.yesNo]),
    };

    // ---------- institute ----------
    projectData.instituteId = await getInstituteId(row[I.institute], excelRowNo);

    // ---------- project upsert ----------
    const existing = await prisma.project.findUnique({ where: { code }, select: { id: true } });
    const project = await prisma.project.upsert({
      where: { code },
      create: projectData,
      update: projectData,
    });
    if (existing) report.projectsUpdated++; else report.projectsCreated++;

    // ---------- child cleanup (legacy only) ----------
    await prisma.payment.deleteMany({ where: { projectId: project.id, isLegacy: true } });
    await prisma.extension.deleteMany({ where: { projectId: project.id, isLegacy: true } });
    await prisma.projectItem.deleteMany({ where: { projectId: project.id, isLegacy: true } });

    // ---------- Payment (letter block) ----------
    const letterBlockCols = [I.letterSubject, I.letterDate, I.letterAmount, I.documentNumber, I.documentDate, I.netAmount, I.letterNumber];
    const hasLetterBlock = letterBlockCols.some(i => row[i] !== null && row[i] !== '');
    if (hasLetterBlock) {
      const amountFromLetter = parseAmount(row[I.letterAmount], COL.letterAmount);
      const netAmount = parseAmount(row[I.netAmount], COL.netAmount);
      let docNo = null;
      const rawDoc = row[I.documentNumber];
      if (rawDoc !== null && rawDoc !== '') {
        docNo = (typeof rawDoc === 'number' && rawDoc === 0) ? null : normalizeDigits(String(rawDoc)).trim() || null;
      }
      const payAmount = amountFromLetter ?? netAmount ?? 0n;
      await prisma.payment.create({
        data: {
          projectId: project.id,
          amount: payAmount,
          netAmount,
          type: 'PROGRESS',
          subject: cleanStr(row[I.letterSubject]),
          letterNumber: cleanStr(row[I.letterNumber]),
          date: parseDateValue(row[I.letterDate], COL.letterDate),
          documentNumber: docNo,
          documentDate: parseDateValue(row[I.documentDate], COL.documentDate),
          isLegacy: true,
        },
      });
      report.payments++;
    } else {
      // fallback: مبلغ پرداخت شده numeric > 0
      const paidRaw = row[I.paidAmount];
      const paid = typeof paidRaw === 'number' ? paidRaw : parseFirstFloat(paidRaw, null, false);
      if (paid !== null && paid > 0) {
        await prisma.payment.create({
          data: {
            projectId: project.id,
            amount: BigInt(Math.round(paid)),
            type: 'PROGRESS',
            subject: 'مبلغ پرداخت شده (از اکسل)',
            isLegacy: true,
          },
        });
        report.payments++;
      }
    }

    // ---------- Extension ----------
    const extDate = parseDateValue(row[I.extensionDate], COL.extensionDate);
    const extRaw = row[I.extensionDuration];
    const hasExtRaw = extRaw !== null && extRaw !== '';
    if (extDate || hasExtRaw) {
      const { months, days, junk } = parseExtensionDuration(extRaw);
      if (junk && hasExtRaw) {
        anomaly(`row ${excelRowNo} (کد ${code}): مدت زمان تمدید="${String(extRaw).trim()}" is junk (negative/serial) — rawValue kept, months/days null`);
      }
      await prisma.extension.create({
        data: {
          projectId: project.id,
          months,
          days,
          date: extDate,
          rawValue: hasExtRaw ? String(extRaw).trim() : null,
          isLegacy: true,
        },
      });
      report.extensions++;
    }

    // ---------- ProjectItem ----------
    const itemName = cleanStr(row[I.itemName]);
    if (itemName) {
      const nonCons = row[I.nonConsumable];
      const cons = row[I.consumable];
      const isTrue = x => x === true;
      // NOTE: in this file BOTH flag columns are always filled with booleans
      // ([false,false]:93, [false,true]:49, [true,false]:47 among item rows),
      // so the literal "filled → false" rule would erase the 47 consumable
      // items. We therefore use TRUE-flag semantics (unknown → null):
      const isConsumable = isTrue(nonCons) ? false : (isTrue(cons) ? true : null);
      await prisma.projectItem.create({
        data: {
          projectId: project.id,
          name: itemName,
          quantity: parseFirstFloat(row[I.quantity], COL.quantity, false),
          unit: cleanStr(row[I.unit]),
          unitPriceRial: parseAmount(row[I.unitPriceRial], COL.unitPriceRial, false),
          unitPriceCurrency: parseFirstFloat(row[I.unitPriceCurrency], COL.unitPriceCurrency, false),
          totalPriceRial: parseAmount(row[I.totalPriceRial], COL.totalPriceRial, false),
          totalPriceCurrency: parseFirstFloat(row[I.totalPriceCurrency], COL.totalPriceCurrency, false),
          isConsumable,
          internalSource: cleanStr(row[I.internalSource]),
          externalSource: cleanStr(row[I.externalSource]),
          activityRow: cleanStr(row[I.activityRow]),
          isLegacy: true,
        },
      });
      report.items++;
    }

    // ---------- totalPaid recompute ----------
    const agg = await prisma.payment.aggregate({
      where: { projectId: project.id },
      _sum: { amount: true },
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { totalPaid: agg._sum.amount ?? 0n },
    });
  }

  report.institutes = await prisma.institute.count();
  report.finishedAt = new Date().toISOString();

  // -------------------------------------------------------------------
  // Summary table
  // -------------------------------------------------------------------
  const line = '─'.repeat(58);
  console.log('\n┌' + line + '┐');
  console.log('│ ETL SUMMARY'.padEnd(59) + '│');
  console.log('├' + line + '┤');
  const put = (k, v) => console.log('│ ' + (k + ':').padEnd(30) + String(v).padStart(27) + ' │');
  put('Total data rows', report.totalRows);
  put('Projects created', report.projectsCreated);
  put('Projects updated', report.projectsUpdated);
  put('Skipped (no code)', report.skipped);
  put('Payments', report.payments);
  put('Extensions', report.extensions);
  put('ProjectItems', report.items);
  put('Institutes', report.institutes);
  const dfTotal = Object.values(DATE_FAIL).reduce((a, b) => a + b, 0);
  const afTotal = Object.values(AMT_FAIL).reduce((a, b) => a + b, 0);
  put('Date parse failures', dfTotal);
  put('Amount parse failures', afTotal);
  put('Anomalies logged', report.anomalies.length);
  console.log('└' + line + '┘');
  if (Object.keys(DATE_FAIL).length) console.log('Date failures by column:', JSON.stringify(DATE_FAIL, null, 2));
  if (Object.keys(AMT_FAIL).length) console.log('Amount failures by column:', JSON.stringify(AMT_FAIL, null, 2));

  const { writeFileSync } = await import('node:fs');
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
  console.log('\n✅ Report written to', REPORT_PATH);
}

main()
  .catch(e => { console.error('❌ ETL failed:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
