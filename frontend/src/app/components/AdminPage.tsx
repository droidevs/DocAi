import { useEffect, useState } from 'react';
import {
  Users,
  FileText,
  HardDrive,
  Activity,
  Search,
  Eye,
  Trash2,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import {
  apiAdminGetStats,
  apiAdminGetUsers,
  apiAdminGetDocuments,
  apiAdminDeleteDocument,
  apiAdminToggleUser,
} from './shared/mockApi';
import { StatusBadge } from './shared/StatusBadge';
import { formatDate, formatBytes, truncateFilename, getInitials } from './shared/utils';
import { useToast } from '../context/ToastContext';
import type { AdminStatsResponse, AdminUserResponse, DocumentResponse } from './shared/types';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';

type Tab = 'users' | 'documents' | 'system';

function StatCard({
  label,
  value,
  icon,
  bg,
  color,
  link,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  bg: string;
  color: string;
  link?: string;
}) {
  return (
    <div
      onClick={link ? () => window.open(link, '_blank') : undefined}
      style={{
        background: '#fff',
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
        cursor: link ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 10,
          background: bg,
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#212529', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#6c757d', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { showToast } = useToast();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiAdminGetStats(),
      apiAdminGetUsers({ page: 0, size: 20 }),
      apiAdminGetDocuments({ page: 0, size: 20 }),
    ]).then(([s, u, d]) => {
      setStats(s);
      setUsers(u.content);
      setDocuments(d.content);
      setLoading(false);
    });
  }, []);

  const handleUserSearch = async (q: string) => {
    setUserSearch(q);
    const resp = await apiAdminGetUsers({ q });
    setUsers(resp.content);
  };

  const handleToggleUser = async (user: AdminUserResponse) => {
    const updated = await apiAdminToggleUser(user.id, !user.enabled);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
    showToast('success', `User ${updated.username} ${updated.enabled ? 'enabled' : 'disabled'}.`);
  };

  const handleDeleteDoc = async (doc: DocumentResponse) => {
    if (!confirm(`Delete "${truncateFilename(doc.originalName)}"?`)) return;
    await apiAdminDeleteDocument(doc.id);
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    showToast('success', 'Document deleted.');
    if (stats) setStats({ ...stats, documentCount: stats.documentCount - 1 });
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'users', label: 'Users' },
    { id: 'documents', label: 'All Documents' },
    { id: 'system', label: 'System' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ height: 80, background: '#e9ecef', borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <StatCard label="Total Users" value={stats?.userCount ?? 0} icon={<Users size={22} />} bg="#cfe2ff" color="#0a58ca" />
          <StatCard label="Documents" value={stats?.documentCount ?? 0} icon={<FileText size={22} />} bg="#f8d7da" color="#842029" />
          <StatCard
            label="Storage Used"
            value={formatBytes(stats?.totalStorageBytes ?? 0)}
            icon={<HardDrive size={22} />}
            bg="#d1e7dd"
            color="#0f5132"
          />
          <StatCard
            label="Actuator"
            value="Health"
            icon={<Activity size={22} />}
            bg="#fff3cd"
            color="#664d03"
            link="/actuator/health"
          />
        </div>
      )}

      {/* Tabs card */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
        }}
      >
        {/* Tab bar */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: '#f8f9fa' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '12px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${PRIMARY}` : '2px solid transparent',
                color: activeTab === tab.id ? PRIMARY : '#6c757d',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Users tab */}
        {activeTab === 'users' && (
          <div>
            <div
              style={{
                padding: '12px 20px',
                borderBottom: `1px solid ${BORDER}`,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <div style={{ position: 'relative', width: 260 }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#6c757d',
                  }}
                />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  placeholder="Search users..."
                  style={{
                    width: '100%',
                    height: 34,
                    border: `1px solid ${BORDER}`,
                    borderRadius: 6,
                    padding: '0 10px 0 32px',
                    fontSize: 13,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8f9fa', borderBottom: `1px solid ${BORDER}` }}>
                    {['User', 'Email', 'Roles', 'Status', 'Joined', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '10px 16px',
                          textAlign: 'left',
                          fontWeight: 600,
                          color: '#495057',
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#6c757d' }}>
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} style={{ borderBottom: `1px solid #f8f9fa` }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: '#cfe2ff',
                                color: PRIMARY,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: 13,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(user.firstName, user.lastName, user.username)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: '#212529' }}>@{user.username}</div>
                              {user.firstName && (
                                <div style={{ fontSize: 12, color: '#6c757d' }}>
                                  {user.firstName} {user.lastName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6c757d' }}>{user.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {user.roles.map((role) => (
                              <span
                                key={role}
                                style={{
                                  background: role.includes('ADMIN') ? '#f8d7da' : '#e2e3e5',
                                  color: role.includes('ADMIN') ? '#842029' : '#41464b',
                                  borderRadius: 4,
                                  padding: '2px 7px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {role.replace('ROLE_', '')}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              background: user.enabled ? '#d1e7dd' : '#f8d7da',
                              color: user.enabled ? '#0f5132' : '#842029',
                              borderRadius: 6,
                              padding: '3px 8px',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {user.enabled ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                          {formatDate(user.createdAt)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => handleToggleUser(user)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '5px 10px',
                                border: `1px solid ${user.enabled ? '#dc3545' : '#198754'}`,
                                borderRadius: 6,
                                background: 'transparent',
                                color: user.enabled ? '#dc3545' : '#198754',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {user.enabled ? <XCircle size={13} /> : <CheckCircle size={13} />}
                              {user.enabled ? 'Disable' : 'Enable'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: '#f8f9fa', borderBottom: `1px solid ${BORDER}` }}>
                  {['Filename', 'Size', 'Status', 'Pages', 'Chunks', 'Uploaded', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#495057',
                        fontSize: 13,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: `1px solid #f8f9fa` }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={15} color="#842029" />
                        <span
                          style={{
                            fontWeight: 500,
                            color: '#212529',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                          title={doc.originalName}
                        >
                          {truncateFilename(doc.originalName)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                      {doc.fileSizeFormatted}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6c757d' }}>
                      {doc.pageCount ?? '—'}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6c757d' }}>
                      {doc.chunkCount}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#6c757d', whiteSpace: 'nowrap' }}>
                      {formatDate(doc.createdAt)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleDeleteDoc(doc)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          border: '1px solid #dc3545',
                          borderRadius: 6,
                          background: 'transparent',
                          color: '#dc3545',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* System tab */}
        {activeTab === 'system' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* Health endpoints */}
            <div style={{ padding: 20, borderRight: `1px solid ${BORDER}` }}>
              <h6 style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 14 }}>Health Endpoints</h6>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Application Health', path: '/actuator/health' },
                  { label: 'Application Info', path: '/actuator/info' },
                  { label: 'Metrics', path: '/actuator/metrics' },
                  { label: 'Environment', path: '/actuator/env' },
                  { label: 'Beans', path: '/actuator/beans' },
                ].map((ep) => (
                  <a
                    key={ep.path}
                    href={`http://localhost:8080${ep.path}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 8,
                      textDecoration: 'none',
                      color: '#212529',
                      fontSize: 14,
                      background: '#f8f9fa',
                    }}
                  >
                    <Activity size={14} color={PRIMARY} />
                    <span style={{ flex: 1 }}>{ep.label}</span>
                    <span style={{ fontSize: 12, color: '#6c757d', fontFamily: 'monospace' }}>{ep.path}</span>
                  </a>
                ))}
              </div>
            </div>

            {/* RAG Configuration */}
            <div style={{ padding: 20 }}>
              <h6 style={{ margin: '0 0 14px', fontWeight: 600, fontSize: 14 }}>RAG Configuration</h6>
              <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    { key: 'Chunk size', value: '800 tokens' },
                    { key: 'Chunk overlap', value: '150 tokens' },
                    { key: 'Top-K retrieval', value: '5 chunks' },
                    { key: 'Similarity threshold', value: '0.70' },
                    { key: 'Embedding model', value: 'text-embedding-3-small' },
                    { key: 'Chat model', value: 'gpt-4o-mini' },
                  ].map((row) => (
                    <tr key={row.key} style={{ borderBottom: `1px solid #f8f9fa` }}>
                      <td style={{ padding: '8px 0', color: '#6c757d', width: '50%' }}>{row.key}</td>
                      <td style={{ padding: '8px 0', fontWeight: 600, color: '#212529', fontFamily: 'monospace', fontSize: 13 }}>
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
