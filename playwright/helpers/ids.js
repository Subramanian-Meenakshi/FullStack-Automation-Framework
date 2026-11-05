let counter = 0;

/** employeeId max 20 chars (backend @Size(20) + varchar(20)). */
function newEmployeeId(prefix = 'PW') {
  counter = (counter + 1) % 1000;
  const ts = Date.now().toString(36).slice(-6);
  const id = `${prefix}${ts}${counter}`.slice(0, 20);
  return id;
}

function newCorrelationPrefix() {
  return `pw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

module.exports = { newEmployeeId, newCorrelationPrefix };
