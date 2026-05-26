import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText,
  MessageSquare,
  Layers,
  HardDrive,
  Upload,
  Bot,
  ArrowRight,
  FilePlus,
  MessageCircle,
} from 'lucide-react';
import { apiGetDocuments, apiGetChats } from './shared/mockApi';
import { StatusBadge } from './shared/StatusBadge';
import { formatDate, truncateFilename } from './shared/utils';
import { useAuth } from '../context/AuthContext';
import type { DocumentResponse, ChatResponse } from './shared/types';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';

function StatCard({
  label,
  value,
  icon,
  bg,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
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
        <div style={{ fontSize: 24, fontWeight: 700, color: '#212529', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 13, color: '#6c757d', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [chats, setChats] = useState<ChatResponse[]>([]);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalChats, setTotalChats] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [totalStorage, setTotalStorage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiGetDocuments({ page: 0, size: 5 }), apiGetChats({ page: 0, size: 5 })]).then(
      ([docsResp, chatsResp]) => {
        setDocs(docsResp.content);
        setTotalDocs(docsResp.totalElements);
        const chunks = docsResp.content.reduce((s, d) => s + (d.chunkCount || 0), 0);
        setTotalChunks(chunks);
        const storageBytes = docsResp.content.reduce((s, d) => s + d.fileSize, 0);
        const storageMB = (storageBytes / 1048576).toFixed(1);
        setTotalStorage(storageMB + ' MB');
        setChats(chatsResp.content);
        setTotalChats(chatsResp.totalElements);
        setLoading(false);
      }
    );
  }, []);

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
    : user?.username || 'User';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Welcome Banner */}
      <div
        style={{
          background: `linear-gradient(135deg, ${PRIMARY}, #0b5ed7)`,
          borderRadius: 16,
          padding: '28px 32px',
          color: '#fff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 22 }}>
            Welcome back, {displayName} 👋
          </h2>
          <p style={{ margin: '0 0 20px', opacity: 0.85, fontSize: 14 }}>
            Your AI document assistant is ready to help you find answers from your documents.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/upload')}
              style={{
                background: '#fff',
                color: PRIMARY,
                border: 'none',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Upload size={15} />
              Upload Document
            </button>
            <button
              onClick={() => navigate('/chat')}
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: 8,
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MessageSquare size={15} />
              Start Chat
            </button>
          </div>
        </div>
        <Bot
          size={120}
          style={{
            position: 'absolute',
            right: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: 0.12,
          }}
        />
      </div>

      {/* Stats row */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 80,
                background: '#e9ecef',
                borderRadius: 12,
                animation: 'pulse 1.5s infinite',
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          <StatCard label="Documents" value={totalDocs} icon={<FileText size={24} />} bg="#f8d7da" color="#842029" />
          <StatCard label="Chats" value={totalChats} icon={<MessageSquare size={24} />} bg="#d1e7dd" color="#0f5132" />
          <StatCard label="Chunks" value={totalChunks} icon={<Layers size={24} />} bg="#fff3cd" color="#664d03" />
          <StatCard label="Storage" value={totalStorage} icon={<HardDrive size={24} />} bg="#cff4fc" color="#055160" />
        </div>
      )}

      {/* Two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }} className="lg:grid-cols-[7fr_5fr]">
        {/* Recent Documents */}
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
            <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#212529' }}>Recent Documents</h6>
            <button
              onClick={() => navigate('/documents')}
              style={{
                background: 'none',
                border: 'none',
                color: PRIMARY,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
              }}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>Loading…</div>
            ) : docs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <FilePlus size={40} style={{ color: '#adb5bd', marginBottom: 12 }} />
                <p style={{ margin: '0 0 12px', color: '#6c757d', fontSize: 14 }}>No documents yet</p>
                <button
                  onClick={() => navigate('/upload')}
                  style={{
                    background: PRIMARY,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Upload your first PDF
                </button>
              </div>
            ) : (
              docs.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 20px',
                    borderBottom: `1px solid #f8f9fa`,
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate('/documents')}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: '#f8d7da',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileText size={18} color="#842029" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#212529',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={doc.originalName}
                    >
                      {truncateFilename(doc.originalName)}
                    </div>
                    <div style={{ fontSize: 12, color: '#6c757d' }}>
                      {doc.fileSizeFormatted} · {formatDate(doc.createdAt)}
                    </div>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Chats */}
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
            <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#212529' }}>Recent Chats</h6>
            <button
              onClick={() => navigate('/chat')}
              style={{
                background: 'none',
                border: 'none',
                color: PRIMARY,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: 0,
              }}
            >
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div style={{ padding: '8px 0' }}>
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>Loading…</div>
            ) : chats.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <MessageCircle size={40} style={{ color: '#adb5bd', marginBottom: 12 }} />
                <p style={{ margin: '0 0 12px', color: '#6c757d', fontSize: 14 }}>No chats yet</p>
                <button
                  onClick={() => navigate('/chat')}
                  style={{
                    background: PRIMARY,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Start chatting
                </button>
              </div>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 20px',
                    borderBottom: `1px solid #f8f9fa`,
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/chat?chatId=${chat.id}`)}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: '#d1e7dd',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <MessageSquare size={18} color="#0f5132" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: '#212529',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {chat.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#6c757d' }}>
                      {chat.messageCount} messages · {formatDate(chat.updatedAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
