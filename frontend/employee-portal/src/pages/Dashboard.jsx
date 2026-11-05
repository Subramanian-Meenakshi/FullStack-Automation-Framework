import { useEffect, useState } from 'react';
import { Typography, Grid, Card, CardContent, Box } from '@mui/material';
import { empApi, jsonOrError, getRole } from '../api';

export default function Dashboard() {
  const [employees, setEmployees] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    empApi('/employees')
      .then(jsonOrError)
      .then(setEmployees)
      .catch((e) => setError(e.message));
  }, []);

  const active = employees.filter((e) => e.status === 'ACTIVE').length;
  const terminated = employees.filter((e) => e.status === 'TERMINATED').length;

  const cards = [
    { label: 'Total Employees', value: employees.length },
    { label: 'Active', value: active },
    { label: 'Terminated', value: terminated },
    { label: 'Your Role', value: getRole() || '-' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      {error && <Typography color="error">{error}</Typography>}
      <Grid container spacing={3}>
        {cards.map((c) => (
          <Grid item xs={12} sm={6} md={3} key={c.label}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{c.label}</Typography>
                <Typography variant="h4">{c.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
