import { Typography, Paper, Box, Link, Divider } from '@mui/material';

export default function About() {
  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h4" gutterBottom>About</Typography>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6">Sandhata Employee Portal</Typography>
        <Typography variant="body1" sx={{ mt: 2 }}>
          This project demonstrates the automation of a large distributed system — a WebUI,
          an API layer secured with JWT, and supporting infrastructure including DB, Kafka,
          S3 and Redis. Playwright drives the end-to-end automation, backed by reusable
          utilities and helper functions built to keep the test suite maintainable.
        </Typography>
        <Divider sx={{ my: 3 }} />
        <Typography variant="subtitle1" gutterBottom>Architecture at a glance</Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          React (Vite + Material UI) portal → Spring Boot microservices (auth-service,
          employee-service, employee-consumer) secured with JWT + RBAC (HR_ADMIN, MANAGER,
          EMPLOYEE) → PostgreSQL for persistence, Redis for read caching, Kafka for async
          events, LocalStack S3 for encrypted employee snapshots. Correlation IDs thread every
          request through API, Kafka and audit logs. Playwright + Allure drive the test suite.
          Docker Compose runs the whole stack.
        </Typography>
        <Typography variant="subtitle1" gutterBottom>Contact</Typography>
        <Typography variant="body2">
          Subramanian Meenakshi —{' '}
          <Link href={`mailto:Subramanian.Meenakshi@Sandhata.com`}>
            Subramanian.Meenakshi@Sandhata.com
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
