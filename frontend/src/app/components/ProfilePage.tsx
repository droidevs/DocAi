import { useState, useEffect } from 'react';
import { Lock, X, CheckCircle, AlertCircle, Edit2 } from 'lucide-react';
import { apiGetProfile, apiUpdateProfile, apiChangePassword } from './shared/mockApi';
import { getInitials, formatDate, formatBytes } from './shared/utils';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { UserProfileResponse } from './shared/types';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setLoading(true);
    try {
      await apiChangePassword(form);
      showToast('success', 'Password updated successfully.');
      onClose();
    } catch (err: any) {
      setError(err?.detail || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 480,
          boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${BORDER}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} color={PRIMARY} />
            <h6 style={{ margin: 0, fontWeight: 600 }}>Change Password</h6>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div
              style={{
                background: '#f8d7da',
                border: '1px solid #f1aeb5',
                color: '#842029',
                borderRadius: 8,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
              }}
            >
              <AlertCircle size={15} />
              {error}
            </div>
          )}
          {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => (
            <div key={field}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                {field === 'currentPassword' ? 'Current Password' : field === 'newPassword' ? 'New Password' : 'Confirm New Password'}
              </label>
              <input
                type="password"
                value={form[field]}
                onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                required
                style={{
                  width: '100%',
                  height: 38,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  padding: '0 12px',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
                background: 'transparent',
                color: '#6c757d',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: loading ? '#6ea8fe' : PRIMARY,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user: authUser, updateUser } = useAuth();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    apiGetProfile().then((p) => {
      setProfile(p);
      setEditForm({ firstName: p.firstName || '', lastName: p.lastName || '', email: p.email });
    });
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setEditError('');
    try {
      const updated = await apiUpdateProfile(editForm);
      setProfile(updated);
      updateUser(updated);
      setEditing(false);
      showToast('success', 'Profile updated successfully.');
    } catch (err: any) {
      setEditError(err?.detail || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <div style={{ color: '#6c757d', fontSize: 14 }}>Loading profile…</div>;
  }

  const initials = getInitials(profile.firstName, profile.lastName, profile.username);
  const displayName = profile.firstName
    ? `${profile.firstName} ${profile.lastName || ''}`.trim()
    : profile.username;

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    height: 38,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
    background: '#fff',
  };

  const readonlyStyle: React.CSSProperties = {
    ...fieldStyle,
    background: '#f8f9fa',
    color: '#6c757d',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20, maxWidth: 960, margin: '0 auto' }}
      className="lg:grid-cols-[5fr_6fr]"
    >
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Avatar card */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: 24,
            textAlign: 'center',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#cfe2ff',
              color: PRIMARY,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              fontWeight: 700,
              margin: '0 auto 14px',
            }}
          >
            {initials}
          </div>
          <h5 style={{ margin: '0 0 4px', fontWeight: 700 }}>{displayName}</h5>
          <p style={{ margin: '0 0 12px', color: '#6c757d', fontSize: 14 }}>{profile.email}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
            {profile.roles.map((role) => (
              <span
                key={role}
                style={{
                  background: role.includes('ADMIN') ? '#f8d7da' : '#d1e7dd',
                  color: role.includes('ADMIN') ? '#842029' : '#0f5132',
                  borderRadius: 6,
                  padding: '3px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {role.replace('ROLE_', '')}
              </span>
            ))}
          </div>
        </div>

        {/* Usage stats card */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
          }}
        >
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Usage Statistics</h6>
          </div>
          <div style={{ padding: '8px 0' }}>
            {[
              { label: 'Documents uploaded', value: '6' },
              { label: 'Total chats', value: '3' },
              { label: 'Storage used', value: '8.5 MB' },
              { label: 'Member since', value: formatDate(profile.createdAt) },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 20px',
                  borderBottom: `1px solid #f8f9fa`,
                  fontSize: 14,
                }}
              >
                <span style={{ color: '#6c757d' }}>{stat.label}</span>
                <span style={{ fontWeight: 600, color: '#212529' }}>{stat.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Account info card */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
          }}
        >
          <div
            style={{
              padding: '14px 20px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Account Information</h6>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: 'transparent',
                  border: `1px solid ${PRIMARY}`,
                  color: PRIMARY,
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Edit2 size={13} />
                Edit Profile
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => { setEditing(false); setEditError(''); }}
                  style={{
                    padding: '6px 12px',
                    background: 'transparent',
                    border: `1px solid ${BORDER}`,
                    color: '#6c757d',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    background: saving ? '#6ea8fe' : PRIMARY,
                    border: 'none',
                    color: '#fff',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                >
                  <CheckCircle size={13} />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editError && (
              <div
                style={{
                  background: '#f8d7da',
                  border: '1px solid #f1aeb5',
                  color: '#842029',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <AlertCircle size={15} />
                {editError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                  readOnly={!editing}
                  style={editing ? fieldStyle : readonlyStyle}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                  readOnly={!editing}
                  style={editing ? fieldStyle : readonlyStyle}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                Username
              </label>
              <input type="text" value={profile.username} readOnly style={readonlyStyle} />
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6c757d' }}>Username cannot be changed.</p>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#495057', marginBottom: 5 }}>
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                readOnly={!editing}
                style={editing ? fieldStyle : readonlyStyle}
              />
            </div>
          </div>
        </div>

        {/* Security card */}
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
          }}
        >
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}` }}>
            <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Security</h6>
          </div>
          <div style={{ padding: '8px 0' }}>
            {[
              {
                label: 'Password',
                desc: 'Update your account password',
                action: 'Change',
                onClick: () => setShowPasswordModal(true),
                color: PRIMARY,
              },
              {
                label: 'Active Sessions',
                desc: 'Revoke all active login sessions',
                action: 'Revoke All',
                onClick: () => showToast('info', 'All sessions revoked.'),
                color: '#dc3545',
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  borderBottom: `1px solid #f8f9fa`,
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#212529' }}>{item.label}</div>
                  <div style={{ fontSize: 13, color: '#6c757d' }}>{item.desc}</div>
                </div>
                <button
                  onClick={item.onClick}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: `1px solid ${item.color}`,
                    background: 'transparent',
                    color: item.color,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}
