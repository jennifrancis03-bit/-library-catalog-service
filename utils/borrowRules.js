const DAY_MS = 24 * 60 * 60 * 1000;
const FINE_PER_DAY = 0.25;

function calculateFine(dueAt, returnedAt) {
  const lateMilliseconds = returnedAt.getTime() - dueAt.getTime();
  if (lateMilliseconds <= 0) return 0;
  const lateDays = Math.ceil(lateMilliseconds / DAY_MS);
  return Number((lateDays * FINE_PER_DAY).toFixed(2));
}

module.exports = { calculateFine };
