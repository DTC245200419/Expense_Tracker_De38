'use strict';

const KINDS = ['income', 'expense'];

function cleanString(value, max) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function validateTransaction(body) {
  const errors = [];
  const kind = cleanString(body.kind, 10);
  const note = cleanString(body.note, 255);
  const occurredOn = cleanString(body.occurred_on, 10);
  const amountRaw = cleanString(String(body.amount ?? ''), 20).replace(/[,\s]/g, '');
  const amount = Number(amountRaw);
  const categoryId = Number.parseInt(body.category_id, 10);

  if (!KINDS.includes(kind)) errors.push('Loai giao dich phai la thu hoac chi.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) {
    errors.push('So tien phai la so duong (toi da 1.000 ty).');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || Number.isNaN(Date.parse(occurredOn))) {
    errors.push('Ngay giao dich khong hop le (YYYY-MM-DD).');
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) errors.push('Danh muc khong hop le.');

  return {
    errors,
    value: {
      kind,
      amount: Math.round(amount * 100) / 100,
      occurredOn,
      categoryId,
      note,
    },
  };
}

function validateCategory(body) {
  const errors = [];
  const name = cleanString(body.name, 64);
  const kind = cleanString(body.kind, 10);
  const color = cleanString(body.color, 7) || '#4f46e5';
  if (name.length < 2) errors.push('Ten danh muc phai co it nhat 2 ky tu.');
  if (!KINDS.includes(kind)) errors.push('Loai danh muc phai la thu hoac chi.');
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) errors.push('Ma mau phai co dang #RRGGBB.');
  return { errors, value: { name, kind, color: color.toLowerCase() } };
}

function validateMonth(value) {
  const s = cleanString(value, 7);
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) return s;
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

module.exports = { validateTransaction, validateCategory, validateMonth, parseId, KINDS };
