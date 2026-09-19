const test = require('node:test');
const assert = require('node:assert');
const { Prisma } = require('@prisma/client');

// Import compiled money utility or test equivalent
test('Decimal Financial Precision vs Float Rounding', () => {
  // Classic float imprecision: 0.1 + 0.2 = 0.30000000000000004
  const floatSum = 0.1 + 0.2;
  assert.notStrictEqual(floatSum, 0.3);

  // Prisma.Decimal exact arithmetic: 0.1 + 0.2 = 0.3
  const dec1 = new Prisma.Decimal('0.1');
  const dec2 = new Prisma.Decimal('0.2');
  const decSum = dec1.add(dec2);
  assert.strictEqual(decSum.toString(), '0.3');
});

test('Decimal Financial Multiplication & Base Units Conversion', () => {
  const amount = new Prisma.Decimal('1234.567891');
  const factor = new Prisma.Decimal(10).pow(6);
  const baseUnits = BigInt(amount.mul(factor).toFixed(0));

  assert.strictEqual(baseUnits, 1234567891n);

  const recovered = new Prisma.Decimal(baseUnits.toString()).div(factor);
  assert.strictEqual(recovered.toFixed(6), '1234.567891');
});

test('Decimal Subtraction without Precision Drift', () => {
  let balance = new Prisma.Decimal('1000.000000');
  const debit = new Prisma.Decimal('0.000001');

  for (let i = 0; i < 1000; i++) {
    balance = balance.sub(debit);
  }

  assert.strictEqual(balance.toFixed(6), '999.999000');
});
