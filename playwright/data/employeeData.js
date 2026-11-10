// Realistic org-style names for test employees — no "Play Wright" filler.
// Deterministic per employeeId: the same id always yields the same person,
// so runs stay reproducible while lists look like real HR data.
const FIRST_NAMES = [
  'Subramanian', 'Ramesh', 'Harish', 'Priya', 'Anitha', 'Kumar',
  'Suresh', 'Meena', 'Deepa', 'Harsha', 'Arun', 'Lakshmi', 'Vignesh',
];
const LAST_NAMES = [
  'Menon', 'Iyer', 'Sharma', 'Rao', 'Nair', 'Reddy',
  'Pillai', 'Gupta', 'Verma', 'Joshi', 'Krishnan', 'Deshmukh',
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function nameFor(id) {
  const h = hash(String(id));
  return {
    firstName: FIRST_NAMES[h % FIRST_NAMES.length],
    lastName: LAST_NAMES[(h >>> 8) % LAST_NAMES.length],
  };
}

// employeeId stays inside the email: names repeat, ids never do
// (duplicate email -> 409). Org domain, reserved TLD for test data.
function emailFor(id) {
  return `${id}@sandhata.example`;
}

module.exports = { FIRST_NAMES, LAST_NAMES, nameFor, emailFor };
