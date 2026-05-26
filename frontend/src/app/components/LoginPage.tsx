import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Bot, User, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiLogin } from './shared/mockApi';
import { apiGetProfile } from './shared/mockApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const PRIMARY = '#0d6efd';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password) {
      setError('Please enter your username and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const authResp = await apiLogin(form);
      const profile = await apiGetProfile();
      const user = { ...profile, username: authResp.username, roles: authResp.roles };
      login(authResp.accessToken, user);
      showToast('success', `Welcome back, ${authResp.username}!`);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

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
          maxWidth: 420,
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
          <h2 style={{ margin: '0 0 6px', fontWeight: 700, color: '#212529' }}>Welcome back</h2>
          <p style={{ margin: 0, color: '#6c757d', fontSize: 14 }}>Sign in to your DocAI account</p>
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Username */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#495057', marginBottom: 6 }}>
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6c757d',
                }}
              >
                <User size={16} />
              </span>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="Enter your username"
                style={{
                  width: '100%',
                  height: 40,
                  border: '1px solid #ced4da',
                  borderRadius: 8,
                  padding: '0 12px 0 38px',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#212529',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#495057', marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6c757d',
                }}
              >
                <Lock size={16} />
              </span>
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  height: 40,
                  border: '1px solid #ced4da',
                  borderRadius: 8,
                  padding: '0 40px 0 38px',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#212529',
                }}
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
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: 40,
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
            {loading ? (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-flex' }}>
                  ◌
                </span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: '#6c757d' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: PRIMARY, fontWeight: 600, textDecoration: 'none' }}>
            Create one
          </Link>
        </div>
      </div>
    </div>
  );
}
