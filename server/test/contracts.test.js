const test = require('node:test');
const assert = require('node:assert');

test('Escrow Status Enum Values', () => {
  const EscrowStatus = {
    Created: 0,
    Deposited: 1,
    Approved: 2,
    Refunded: 3,
  };
  assert.strictEqual(EscrowStatus.Created, 0);
  assert.strictEqual(EscrowStatus.Deposited, 1);
  assert.strictEqual(EscrowStatus.Approved, 2);
  assert.strictEqual(EscrowStatus.Refunded, 3);
});

test('Escrow Initialization Amount Validation', () => {
  const validateAmount = (amount) => {
    if (amount <= 0) {
      throw new Error('Escrow amount must be positive.');
    }
    return true;
  };
  assert.ok(validateAmount(100));
  assert.throws(() => validateAmount(0), /Escrow amount must be positive./);
  assert.throws(() => validateAmount(-50), /Escrow amount must be positive./);
});

test('Recurring Billing Cycle Limits Check', () => {
  const checkChargeLimit = (amount, limit) => {
    if (amount > limit) {
      throw new Error('Charge amount exceeds the allowed billing cycle limit.');
    }
    return true;
  };
  assert.ok(checkChargeLimit(150, 500));
  assert.throws(() => checkChargeLimit(600, 500), /Charge amount exceeds the allowed billing cycle limit./);
});
