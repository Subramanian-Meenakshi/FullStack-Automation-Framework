const { execSync } = require('child_process');
const { REDIS_CONTAINER } = require('./services');

function redisCmd(...args) {
  return execSync(`docker exec ${REDIS_CONTAINER} redis-cli ${args.join(' ')}`, { encoding: 'utf8' }).trim();
}

const keyFor = (id) => `emp:${id}`;

module.exports = { redisCmd, keyFor };
