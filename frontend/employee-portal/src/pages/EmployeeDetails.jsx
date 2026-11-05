import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Typography, Paper, Grid, TextField, Button, Alert, Box, Chip, MenuItem,
} from '@mui/material';
import { empApi, jsonOrError, getRole } from '../api';

export default function EmployeeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const role = getRole();
  const canEdit = role === 'HR_ADMIN' || role === 'MANAGER';
  const canRestore = role === 'HR_ADMIN';

  const load = () => {
    empApi(`/employees/${id}`)
      .then(jsonOrError)
      .then((d) => { setForm(d); setError(''); })
      .catch((e) => setError(e.message));
  };

  useEffect(load, [id]);

  if (!form) {
    return (
      <Box>
        <Typography variant="h4">Employee Details</Typography>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        <Button component={RouterLink} to="/employees" sx={{ mt: 2 }}>Back to list</Button>
      </Box>
    );
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    setError(''); setNotice('');
    try {
      const res = await empApi(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(form) });
      await jsonOrError(res);
      setNotice('Saved.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const restore = async () => {
    setError(''); setNotice('');
    try {
      const res = await empApi(`/employees/${id}/restore`, { method: 'POST' });
      await jsonOrError(res);
      setNotice('Restored to ACTIVE.');
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const f = (label, key, extra = {}) => (
    <TextField
      label={label} value={form[key] ?? ''} onChange={set(key)} fullWidth margin="dense"
      disabled={!canEdit || key === 'employeeId'} {...extra}
    />
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">
          {form.firstName} {form.lastName}{' '}
          <Chip size="small" label={form.status} color={form.status === 'ACTIVE' ? 'success' : 'default'} />
        </Typography>
        <Button component={RouterLink} to="/employees">Back to list</Button>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>{f('Employee ID', 'employeeId')}</Grid>
          <Grid item xs={12} sm={6}>{f('Email', 'email')}</Grid>
          <Grid item xs={12} sm={6}>{f('First Name', 'firstName')}</Grid>
          <Grid item xs={12} sm={6}>{f('Last Name', 'lastName')}</Grid>
          <Grid item xs={12} sm={6}>{f('Contact Number', 'contactNumber')}</Grid>
          <Grid item xs={12} sm={6}>{f('Designation', 'designation')}</Grid>
          <Grid item xs={12} sm={6}>{f('Department', 'department')}</Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Job Level" value={form.jobLevel ?? ''} onChange={set('jobLevel')} fullWidth margin="dense"
              disabled={!canEdit} select
            >
              {['L1', 'L2', 'L3', 'L4', 'L5'].map((l) => <MenuItem key={l} value={l}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>{f('Skills', 'skills')}</Grid>
          <Grid item xs={12} sm={6}>{f('Manager', 'manager')}</Grid>
          <Grid item xs={12} sm={6}>{f('Location', 'location')}</Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Status" value={form.status ?? ''} onChange={set('status')} fullWidth margin="dense"
              disabled={!canEdit} select
            >
              {['ACTIVE', 'TERMINATED'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
        </Grid>
        {canEdit && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
            <Button variant="contained" onClick={save}>Save</Button>
            {canRestore && form.status === 'TERMINATED' && (
              <Button variant="outlined" color="success" onClick={restore}>Restore</Button>
            )}
          </Box>
        )}
        {!canEdit && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Read-only: role {role} cannot edit employees.
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
