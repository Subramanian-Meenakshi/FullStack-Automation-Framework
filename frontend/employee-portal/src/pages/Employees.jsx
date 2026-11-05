import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Typography, Button, Table, TableHead, TableRow, TableCell, TableBody,
  Paper, Alert, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Box, Chip,
} from '@mui/material';
import { empApi, jsonOrError, getRole } from '../api';

const EMPTY = {
  employeeId: '', firstName: '', lastName: '', email: '', contactNumber: '',
  designation: '', department: '', jobLevel: '', skills: '', manager: '', location: '',
};

export default function Employees() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const role = getRole();
  const canCreate = role === 'HR_ADMIN';
  const canDelete = role === 'HR_ADMIN';

  const load = () => {
    empApi('/employees')
      .then(jsonOrError)
      .then((d) => { setRows(d); setError(''); })
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    setError(''); setNotice('');
    try {
      const res = await empApi('/employees', { method: 'POST', body: JSON.stringify(form) });
      await jsonOrError(res);
      setNotice(`Created ${form.employeeId}`);
      setOpen(false);
      setForm(EMPTY);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const remove = async (id) => {
    setError(''); setNotice('');
    if (!window.confirm(`Soft-delete ${id}?`)) return;
    try {
      const res = await empApi(`/employees/${id}`, { method: 'DELETE' });
      await jsonOrError(res);
      setNotice(`Deleted ${id} (TERMINATED)`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const statusColor = (s) => (s === 'ACTIVE' ? 'success' : 'default');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4">Employees</Typography>
        {canCreate && (
          <Button variant="contained" onClick={() => setOpen(true)}>Create Employee</Button>
        )}
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }}>{notice}</Alert>}
      <Paper>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell><TableCell>Name</TableCell><TableCell>Email</TableCell>
              <TableCell>Designation</TableCell><TableCell>Department</TableCell>
              <TableCell>Status</TableCell><TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.employeeId}>
                <TableCell>{r.employeeId}</TableCell>
                <TableCell>{r.firstName} {r.lastName}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>{r.designation}</TableCell>
                <TableCell>{r.department}</TableCell>
                <TableCell><Chip size="small" label={r.status} color={statusColor(r.status)} /></TableCell>
                <TableCell align="right">
                  <Button size="small" component={RouterLink} to={`/employees/${r.employeeId}`}>View</Button>
                  {canDelete && r.status !== 'TERMINATED' && (
                    <Button size="small" color="error" onClick={() => remove(r.employeeId)}>Delete</Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={7}>No employees found.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Employee</DialogTitle>
        <DialogContent>
          <TextField label="Employee ID" value={form.employeeId} onChange={set('employeeId')} fullWidth margin="dense" helperText="max 20 chars" />
          <TextField label="First Name" value={form.firstName} onChange={set('firstName')} fullWidth margin="dense" />
          <TextField label="Last Name" value={form.lastName} onChange={set('lastName')} fullWidth margin="dense" />
          <TextField label="Email" value={form.email} onChange={set('email')} fullWidth margin="dense" />
          <TextField label="Contact Number" value={form.contactNumber} onChange={set('contactNumber')} fullWidth margin="dense" />
          <TextField label="Designation" value={form.designation} onChange={set('designation')} fullWidth margin="dense" />
          <TextField label="Department" value={form.department} onChange={set('department')} fullWidth margin="dense" />
          <TextField label="Job Level" value={form.jobLevel} onChange={set('jobLevel')} fullWidth margin="dense" />
          <TextField label="Skills" value={form.skills} onChange={set('skills')} fullWidth margin="dense" />
          <TextField label="Manager" value={form.manager} onChange={set('manager')} fullWidth margin="dense" />
          <TextField label="Location" value={form.location} onChange={set('location')} fullWidth margin="dense" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={create}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
