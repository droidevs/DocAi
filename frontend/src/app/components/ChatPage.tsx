import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import {
  Plus,
  MessageSquareDashed,
  Send,
  Bot,
  User,
  FileText,
  Edit2,
  Trash2,
  ShieldCheck,
  Upload,
  X,
  MessageSquare,
} from 'lucide-react';
import {
  apiGetChats,
  apiGetChat,
  apiCreateChat,
  apiSendMessage,
  apiRenameChat,
  apiDeleteChat,
  apiGetDocuments,
} from './shared/mockApi';
import { formatSimilarity, truncateFilename } from './shared/utils';
import { useToast } from '../context/ToastContext';
import type { ChatResponse, MessageResponse, CitationResponse, DocumentResponse } from './shared/types';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px' }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#adb5bd',
            animation: `bounce 1.2s infinite ${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function CitationPill({
  citation,
  onClick,
}: {
  citation: CitationResponse;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#f0f4ff',
        border: '1px solid #c7d7fd',
        color: '#3b5bdb',
        borderRadius: 20,
        padding: '3px 10px',
        fontSize: 11.5,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <FileText size={13} />
      {truncateFilename(citation.documentName, 20)} · p.{citation.pageNumber}
      <span style={{ fontWeight: 700, color: '#0d6efd' }}>{formatSimilarity(citation.similarityScore)}</span>
    </button>
  );
}

function CitationModal({
  citation,
  onClose,
}: {
  citation: CitationResponse;
  onClose: () => void;
}) {
  const pct = Math.round(citation.similarityScore * 100);
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
          maxWidth: 700,
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.2)',
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
            <FileText size={18} color={PRIMARY} />
            <h6 style={{ margin: 0, fontWeight: 600 }}>Source Reference</h6>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <table style={{ width: '100%', marginBottom: 16, fontSize: 14 }}>
            <tbody>
              <tr>
                <td style={{ color: '#6c757d', paddingBottom: 8, width: 120 }}>Document</td>
                <td style={{ fontWeight: 600, paddingBottom: 8 }}>{truncateFilename(citation.documentName)}</td>
              </tr>
              <tr>
                <td style={{ color: '#6c757d', paddingBottom: 8 }}>Page</td>
                <td style={{ paddingBottom: 8 }}>Page {citation.pageNumber}</td>
              </tr>
              <tr>
                <td style={{ color: '#6c757d', paddingBottom: 8 }}>Similarity</td>
                <td style={{ paddingBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{ flex: 1, height: 6, background: '#e9ecef', borderRadius: 4, overflow: 'hidden' }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: pct + '%',
                          background: pct >= 85 ? '#198754' : pct >= 70 ? PRIMARY : '#ffc107',
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontWeight: 600 }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <div
            style={{
              background: '#f8f9fa',
              borderLeft: `4px solid ${PRIMARY}`,
              padding: 14,
              borderRadius: '0 8px 8px 0',
              fontSize: 14,
              color: '#212529',
              lineHeight: 1.7,
            }}
          >
            <em>"{citation.excerpt}"</em>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCitationClick,
}: {
  message: MessageResponse;
  onCitationClick: (c: CitationResponse) => void;
}) {
  const isUser = message.role === 'USER';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 10,
        alignItems: 'flex-end',
        maxWidth: '80%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isUser ? '#e2e3e5' : '#cfe2ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isUser ? <User size={14} color="#41464b" /> : <Bot size={14} color={PRIMARY} />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div
          style={{
            background: isUser ? PRIMARY : '#fff',
            color: isUser ? '#fff' : '#212529',
            border: isUser ? 'none' : `1px solid ${BORDER}`,
            borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {message.content}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {message.citations.map((c) => (
              <CitationPill key={c.chunkId} citation={c} onClick={() => onCitationClick(c)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [sessions, setSessions] = useState<ChatResponse[]>([]);
  const [activeChat, setActiveChat] = useState<ChatResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [typing, setTyping] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState<CitationResponse | null>(null);
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [loadingSessions, setLoadingSessions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const chatIdParam = searchParams.get('chatId');
  const docIdParam = searchParams.get('docId');

  const loadSessions = useCallback(async () => {
    const resp = await apiGetChats({ page: 0, size: 50 });
    setSessions(resp.content);
    setLoadingSessions(false);
  }, []);

  useEffect(() => {
    loadSessions();
    apiGetDocuments({ size: 100 }).then((resp) =>
      setDocuments(resp.content.filter((d) => d.status === 'COMPLETED'))
    );
  }, []);

  useEffect(() => {
    if (docIdParam) setSelectedDocId(docIdParam);
  }, [docIdParam]);

  useEffect(() => {
    if (chatIdParam) openChat(chatIdParam);
  }, [chatIdParam]);

  const openChat = async (chatId: string) => {
    try {
      const chat = await apiGetChat(chatId);
      setActiveChat(chat);
      setMessages(chat.messages || []);
      navigate(`/chat?chatId=${chatId}`, { replace: true });
    } catch {
      showToast('danger', 'Chat not found.');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleNewChat = async () => {
    const chat = await apiCreateChat();
    await loadSessions();
    setActiveChat(chat);
    setMessages([]);
    navigate(`/chat?chatId=${chat.id}`, { replace: true });
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending || !activeChat) return;
    const question = inputText.trim();
    setInputText('');
    setSending(true);

    const optimisticUser: MessageResponse = {
      id: 'optimistic-' + Date.now(),
      role: 'USER',
      content: question,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimisticUser]);
    setTyping(true);

    try {
      const resp = await apiSendMessage(activeChat.id, {
        question,
        documentId: selectedDocId || null,
      });
      setTyping(false);
      setMessages((m) => [...m, resp]);
      await loadSessions();
      if (activeChat.title === 'New Chat') {
        setActiveChat((prev) =>
          prev
            ? { ...prev, title: question.length > 60 ? question.substring(0, 57) + '...' : question }
            : prev
        );
      }
    } catch {
      setTyping(false);
      showToast('danger', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRename = async () => {
    if (!activeChat) return;
    const newTitle = prompt('Enter new title:', activeChat.title);
    if (!newTitle || newTitle === activeChat.title) return;
    await apiRenameChat(activeChat.id, newTitle);
    setActiveChat((c) => (c ? { ...c, title: newTitle } : c));
    await loadSessions();
    showToast('success', 'Chat renamed.');
  };

  const handleDeleteChat = async () => {
    if (!activeChat) return;
    if (!confirm('Delete this chat? This cannot be undone.')) return;
    await apiDeleteChat(activeChat.id);
    setActiveChat(null);
    setMessages([]);
    navigate('/chat', { replace: true });
    await loadSessions();
    showToast('success', 'Chat deleted.');
  };

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 56px)',
        margin: -24,
        overflow: 'hidden',
      }}
    >
      {/* Sessions sidebar */}
      <div
        style={{
          width: 260,
          background: '#f8f9fa',
          borderRight: `1px solid ${BORDER}`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: '12px 12px 8px' }}>
          <button
            onClick={handleNewChat}
            style={{
              width: '100%',
              padding: '9px',
              background: PRIMARY,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>
        <div style={{ height: 1, background: BORDER, margin: '4px 0' }} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {loadingSessions ? (
            <div style={{ padding: 12, color: '#6c757d', fontSize: 13 }}>Loading…</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: 12, color: '#6c757d', fontSize: 13 }}>No chats yet</div>
          ) : (
            sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => openChat(session.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: activeChat?.id === session.id ? PRIMARY : 'transparent',
                  color: activeChat?.id === session.id ? '#fff' : '#495057',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 2,
                  fontSize: 13,
                }}
              >
                <MessageSquare
                  size={14}
                  style={{ opacity: 0.6, flexShrink: 0 }}
                />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {session.title}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Chat top bar */}
        {activeChat ? (
          <div
            style={{
              padding: '10px 20px',
              borderBottom: `1px solid ${BORDER}`,
              background: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <h6
              style={{
                margin: 0,
                fontWeight: 600,
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 15,
              }}
            >
              {activeChat.title}
            </h6>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              style={{
                height: 34,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: '0 8px',
                fontSize: 13,
                background: '#fff',
                maxWidth: 180,
              }}
            >
              <option value="">All documents</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  {truncateFilename(d.originalName, 25)}
                </option>
              ))}
            </select>
            <button
              onClick={handleRename}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6c757d',
                padding: 6,
              }}
              title="Rename chat"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={handleDeleteChat}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#dc3545',
                padding: 6,
              }}
              title="Delete chat"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '10px 20px',
              borderBottom: `1px solid ${BORDER}`,
              background: '#fff',
              height: 49,
            }}
          />
        )}

        {/* Messages area */}
        {!activeChat ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: 32,
            }}
          >
            <div>
              <MessageSquareDashed size={56} style={{ color: '#adb5bd', marginBottom: 16 }} />
              <h5 style={{ margin: '0 0 8px', color: '#495057' }}>Start a conversation</h5>
              <p style={{ margin: '0 0 20px', color: '#6c757d', fontSize: 14, maxWidth: 320 }}>
                Click "New Chat" or select an existing chat. Make sure you have uploaded and processed
                documents first.
              </p>
              <button
                onClick={() => navigate('/upload')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  background: PRIMARY,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Upload size={15} />
                Upload a PDF
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6c757d', fontSize: 14, paddingTop: 40 }}>
                  <MessageSquare size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
                  <p style={{ margin: 0 }}>Send a message to start the conversation.</p>
                </div>
              )}
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onCitationClick={setSelectedCitation}
                />
              ))}
              {typing && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 10,
                    alignSelf: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: '#cfe2ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Bot size={14} color={PRIMARY} />
                  </div>
                  <div
                    style={{
                      background: '#fff',
                      border: `1px solid ${BORDER}`,
                      borderRadius: '16px 16px 16px 4px',
                      padding: '8px 14px',
                    }}
                  >
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div
              style={{
                padding: '12px 20px 16px',
                borderTop: `1px solid ${BORDER}`,
                background: '#fff',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-end',
                  background: '#f8f9fa',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: '8px 10px',
                }}
              >
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question about your documents..."
                  rows={2}
                  style={{
                    flex: 1,
                    border: 'none',
                    background: 'transparent',
                    resize: 'none',
                    outline: 'none',
                    fontSize: 14,
                    lineHeight: 1.5,
                    maxHeight: 160,
                    color: '#212529',
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || sending}
                  style={{
                    width: 36,
                    height: 36,
                    background: !inputText.trim() || sending ? '#e9ecef' : PRIMARY,
                    color: !inputText.trim() || sending ? '#adb5bd' : '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: !inputText.trim() || sending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  fontSize: 12,
                  color: '#6c757d',
                }}
              >
                <ShieldCheck size={13} color="#198754" />
                Answers are grounded in your uploaded documents only · Press Ctrl+Enter to send
              </div>
            </div>
          </>
        )}
      </div>

      {/* Citation modal */}
      {selectedCitation && (
        <CitationModal citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
      )}
    </div>
  );
}
