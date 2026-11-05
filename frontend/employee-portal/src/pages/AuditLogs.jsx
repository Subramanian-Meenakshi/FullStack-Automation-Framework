import { useEffect, useState } from 'react';
import {
  Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody,
  Alert, Box, Chip, TextField, MenuItem,
} from '@mui/material';
import { empApi, jsonOrError, getRole } from '../api';

const ACTIONS = ['', 'LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'CREATE_EMPLOYEE', 'UPDATE_EMPLOYEE',
  'DELETE_EMPLOYEE', 'RESTORE_EMPLOYEE', 'VIEW_EMPLOYEE', 'CONSUME_CREATE', 'CONSUME_READ',
  'CONSUME_UPDATE', 'CONSUME_DELETE'];

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');
  const role = getRole();

  useEffect(() => {
    if (role !== 'HR_ADMIN' && role !== 'MANAGER') {
      setError(`Role ${role} cannot view audit logs.`);
      return;
    }
    empApi('/audit')
      .then(jsonOrError)
      .then(setRows)
      .catch((e) => setError(e.message));
  }, [role]);

  const filtered = action ? rows.filter((r) => r.action === action) : rows;
  const resultColor = (r) => (r.result === 'SUCCESS' ? 'success' : 'error');

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Audit Logs</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!error && (
        <>
          <TextField
            select label="Filter by action" value={action} onChange={(e) => setAction(e.target.value)}
            size="small" sx={{ mb: 2, minWidth: 240 }}
          >
            {ACTIONS.filter(Boolean).map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
            <MenuItem value="">All</MenuItem>
          </TextField>
          <Paper>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell><TableCell>When</TableCell><TableCell>Action</TableCell>
                  <TableCell>Employee</TableCell><TableCell>User</TableCell>
                  <TableCell>Result</TableCell><TableCell>Correlation ID</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.createdAt}</TableCell>
                    <TableCell>{r.action}</TableCell>
                    <TableCell>{r.employeeId || '-'}</TableCell>
                    <TableCell>{r.username || '-'}</TableCell>
                    <TableCell><Chip size="small" label={r.result} color={resultColor(r)} /></TableCell>
                    <TableCell>{r.correlationId || '-'}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7}>No audit entries.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </Box>
  );
}
