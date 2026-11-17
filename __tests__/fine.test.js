const { calculateFine } = require('../utils/borrowRules');

test('fine calculation charges $1.00 for a return three days and twelve hours late', () => {
  const dueAt = new Date('2026-10-01T10:00:00.000Z');
  const returnedAt = new Date('2026-10-04T22:00:00.000Z');

  expect(calculateFine(dueAt, returnedAt)).toBe(1);
});
