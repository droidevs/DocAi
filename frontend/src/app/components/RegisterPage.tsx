import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Bot, User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { apiRegister, apiGetProfile } from './shared/mockApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PRIMARY = '#0d6efd';

function getPasswordStrength(pw: string): { level: number; label: string; color: string } {
  if (!pw) return { level: 0, label: '', color: '#dc3545' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score === 1) return { level: 25, label: 'Weak', color: '#dc3545' };
  if (score === 2) return { level: 50, label: 'Fair', color: '#ffc107' };
  if (score === 3) return { level: 75, label: 'Good', color: '#0dcaf0' };
  return { level: 100, label: 'Strong', color: '#198754' };
}

export function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const strength = getPasswordStrength(form.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!form.username || !form.email || !form.password) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const authResp = await apiRegister(form);
      const profile = await apiGetProfile();
      const user = { ...profile, username: authResp.username, roles: authResp.roles };
      login(authResp.accessToken, user);
      showToast('success', 'Account created successfully! Welcome to DocAI.');
      navigate('/dashboard');
    } catch (err: any) {
      if (err?.errors) {
        setFieldErrors(err.errors);
        setError(err.detail || 'Validation failed');
      } else {
        setError(err?.detail || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (fieldName: string): React.CSSProperties => ({
    width: '100%',
    height: 40,
    border: `1px solid ${fieldErrors[fieldName] ? '#dc3545' : '#ced4da'}`,
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#212529',
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 0.5rem 1.5rem rgba(0,0,0,0.12)',
          padding: '40px 36px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: PRIMARY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <Bot size={32} color="#fff" />
          </div>
          <h2 style={{ margin: '0 0 6px', fontWeight: 700, color: '#212529' }}>Create account</h2>
          <p style={{ margin: 0, color: '#6c757d', fontSize: 14 }}>Start using DocAI for free</p>
        </div>

        {/* Error alert */}
        {error && (
          <div
            style={{
              background: '#f8d7da',
              border: '1px solid #f1aeb5',
              color: '#842029',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 14,
            }}
          >
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* First + Last name row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                placeholder="Alice"
                style={inputStyle('firstName')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                placeholder="Smith"
                style={inputStyle('lastName')}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
              Username <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}
              >
                <User size={16} />
              </span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="alice123"
                required
                style={{ ...inputStyle('username'), paddingLeft: 38 }}
              />
            </div>
            {fieldErrors.username ? (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc3545' }}>{fieldErrors.username}</p>
            ) : (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6c757d' }}>3–50 characters</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
              Email <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}
              >
                <Mail size={16} />
              </span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="alice@example.com"
                required
                style={{ ...inputStyle('email'), paddingLeft: 38 }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
              Password <span style={{ color: '#dc3545' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}
              >
                <Lock size={16} />
              </span>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Min 8 characters"
                required
                style={{ ...inputStyle('password'), paddingLeft: 38, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6c757d',
                  padding: 0,
                }}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {form.password && (
              <div style={{ marginTop: 8 }}>
                <div style={{ height: 4, background: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: strength.level + '%',
                      background: strength.color,
                      borderRadius: 4,
                      transition: 'width 0.3s ease, background 0.3s ease',
                    }}
                  />
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6c757d' }}>
                  Password strength:{' '}
                  <span style={{ color: strength.color, fontWeight: 600 }}>{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 42,
              background: loading ? '#6ea8fe' : PRIMARY,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
            }}
          >
            {loading ? 'Creating account...' : (
              <>
                <CheckCircle size={16} />
                Create Account
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: '#6c757d' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: PRIMARY, fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
