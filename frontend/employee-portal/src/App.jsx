import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, Box, Container } from '@mui/material';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetails from './pages/EmployeeDetails';
import AuditLogs from './pages/AuditLogs';
import About from './pages/About';
import { getToken, getUsername, getRole, clearSession } from './api';

function RequireAuth({ children }) {
  const location = useLocation();
  if (!getToken()) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  const navigate = useNavigate();
  const authed = !!getToken();

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
    } catch { /* ignore */ }
    clearSession();
    navigate('/login');
  };

  const linkStyle = ({ isActive }) => ({
    color: 'white',
    textDecoration: 'none',
    padding: '6px 12px',
    borderRadius: 4,
    backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
  });

  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Sandhata Employee Portal
          </Typography>
          {authed && (
            <>
              <NavLink to="/" style={linkStyle} end>Dashboard</NavLink>
              <NavLink to="/employees" style={linkStyle}>Employees</NavLink>
              <NavLink to="/audit" style={linkStyle}>Audit Logs</NavLink>
              <NavLink to="/about" style={linkStyle}>About</NavLink>
              <Typography variant="body2" sx={{ mx: 2 }}>
                {getUsername()} ({getRole()})
              </Typography>
              <Button color="inherit" onClick={logout}>Logout</Button>
            </>
          )}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
          <Route path="/employees" element={<RequireAuth><Employees /></RequireAuth>} />
          <Route path="/employees/:id" element={<RequireAuth><EmployeeDetails /></RequireAuth>} />
          <Route path="/audit" element={<RequireAuth><AuditLogs /></RequireAuth>} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}
