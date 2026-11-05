// Single source of service base URLs for tests + configs.
// Env override for remote/CI wrappers; defaults match docker-compose + restart.sh
// so the same suite runs on a laptop and on GitHub Actions with zero changes.
const AUTH_URL = process.env.AUTH_URL || 'http://localhost:8080';
const EMP_URL = process.env.EMP_URL || 'http://localhost:8082';
const CONSUMER_URL = process.env.CONSUMER_URL || 'http://localhost:8083';
const UI_URL = process.env.UI_URL || 'http://localhost:5173';
const KAFKA_UI_URL = process.env.KAFKA_UI_URL || 'http://localhost:8081';
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:4566';
const KAFKA_BOOTSTRAP = process.env.KAFKA_BOOTSTRAP || 'localhost:9092';
const REDIS_CONTAINER = process.env.REDIS_CONTAINER || 'redis';
const KAFKA_CONTAINER = process.env.KAFKA_CONTAINER || 'kafka';
const LOCALSTACK_CONTAINER = process.env.LOCALSTACK_CONTAINER || 'localstack';
const S3_BUCKET = process.env.S3_BUCKET || 'employees';
const CONSUMER_LOG = process.env.CONSUMER_LOG || '/tmp/employee-consumer.log';
const EMPLOYEE_LOG = process.env.EMPLOYEE_LOG || '/tmp/employee-service.log';
const AUTH_LOG = process.env.AUTH_LOG || '/tmp/auth-service.log';

module.exports = {
  AUTH_URL,
  EMP_URL,
  CONSUMER_URL,
  UI_URL,
  KAFKA_UI_URL,
  S3_ENDPOINT,
  KAFKA_BOOTSTRAP,
  REDIS_CONTAINER,
  KAFKA_CONTAINER,
  LOCALSTACK_CONTAINER,
  S3_BUCKET,
  CONSUMER_LOG,
  EMPLOYEE_LOG,
  AUTH_LOG,
};
