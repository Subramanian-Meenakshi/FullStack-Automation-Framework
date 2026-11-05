// Counts Playwright suite runs; every 5th run flushes accumulated test data
// (scripts/db-flush.sh) so the unpaginated employee list stays small enough
// for UI tests and the DB does not grow without bound.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const counterFile = path.join(__dirname, '..', '.test-run-count');
const root = path.join(__dirname, '..', '..');

let n = 0;
try {
  n = parseInt(fs.readFileSync(counterFile, 'utf8'), 10) || 0;
} catch {
  /* first run */
}
n += 1;
fs.writeFileSync(counterFile, String(n));

if (n % 5 === 0) {
  console.log(`run-gate: run #${n} -> flushing test data (scripts/db-flush.sh)`);
  execSync('bash scripts/db-flush.sh', { cwd: root, stdio: 'inherit' });
} else {
  console.log(`run-gate: run #${n}/5 until DB flush`);
}
