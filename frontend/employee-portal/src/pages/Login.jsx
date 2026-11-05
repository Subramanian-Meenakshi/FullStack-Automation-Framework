import { useState } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { Paper, TextField, Button, Typography, Alert, Box, Link } from '@mui/material';
import { authApi, jsonOrError, saveSession } from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await authApi('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await jsonOrError(res);
      saveSession(data);
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <Paper sx={{ p: 4, width: 380 }}>
        <Typography variant="h5" gutterBottom align="center">
          Sandhata Employee Portal
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
          Sign in to continue
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={submit}>
          <TextField
            label="Username" fullWidth margin="normal" value={username}
            onChange={(e) => setUsername(e.target.value)}
            name="username" autoComplete="username" required
          />
          <TextField
            label="Password" type="password" fullWidth margin="normal" value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required
          />
          <Button type="submit" variant="contained" fullWidth sx={{ mt: 2 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Login'}
          </Button>
        </form>
        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
          <Link component={RouterLink} to="/about">About this project</Link>
        </Typography>
      </Paper>
    </Box>
  );
}
