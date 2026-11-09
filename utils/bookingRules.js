function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isTime(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function createOverlapFilter(space, date, startTime, endTime) {
  return {
    space,
    date,
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
}

function hasTimeOverlap(first, second) {
  return first.startTime < second.endTime && first.endTime > second.startTime;
}

module.exports = {
  createOverlapFilter,
  hasTimeOverlap,
  isDate,
  isTime,
};
