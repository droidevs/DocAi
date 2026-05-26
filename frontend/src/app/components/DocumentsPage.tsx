import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  FileText,
  Search,
  Upload,
  Trash2,
  MessageSquare,
  RefreshCw,
  FilePlus,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import {
  apiGetDocuments,
  apiDeleteDocument,
  apiReprocessDocument,
} from './shared/mockApi';
import { StatusBadge } from './shared/StatusBadge';
import { formatDate, truncateFilename } from './shared/utils';
import { useToast } from '../context/ToastContext';
import type { DocumentResponse, DocumentStatus } from './shared/types';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';
const PAGE_SIZE = 12;

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Status', value: '' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'Processing', value: 'PROCESSING' },
  { label: 'Pending', value: 'PENDING' },
  { label: 'Failed', value: 'FAILED' },
];

function DeleteModal({
  doc,
  onConfirm,
  onCancel,
}: {
  doc: DocumentResponse;
  onConfirm: () => void;
  onCancel: () => void;
}) {
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
      onClick={onCancel}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 360,
          boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.2)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <Trash2 size={18} color="#dc3545" />
          <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>Delete Document</h6>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <p style={{ margin: 0, color: '#6c757d', fontSize: 14 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#212529' }}>{truncateFilename(doc.originalName)}</strong>? This
            action cannot be undone and will remove all associated chunks and chat history.
          </p>
        </div>
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #6c757d',
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
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: 'none',
              background: '#dc3545',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentCard({
  doc,
  onDelete,
  onReprocess,
  onChat,
}: {
  doc: DocumentResponse;
  onDelete: () => void;
  onReprocess: () => void;
  onChat: () => void;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: `0.5px solid ${BORDER}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ padding: 16, flex: 1 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: '#f8d7da',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FileText size={22} color="#842029" />
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
            <div style={{ fontSize: 12, color: '#6c757d', marginTop: 2 }}>{doc.fileSizeFormatted}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <StatusBadge status={doc.status} />
          {doc.pageCount != null && (
            <span
              style={{
                background: '#cfe2ff',
                color: '#0a58ca',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              {doc.pageCount} pages
            </span>
          )}
          {doc.chunkCount > 0 && (
            <span
              style={{
                background: '#e2e3e5',
                color: '#41464b',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              {doc.chunkCount} chunks
            </span>
          )}
        </div>

        {doc.errorMessage && (
          <div
            style={{
              background: '#f8d7da',
              color: '#842029',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 12,
              marginBottom: 8,
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{doc.errorMessage}</span>
          </div>
        )}

        <div style={{ fontSize: 12, color: '#6c757d' }}>Uploaded {formatDate(doc.createdAt)}</div>
      </div>

      <div
        style={{
          padding: '10px 16px',
          display: 'flex',
          gap: 6,
          borderTop: `1px solid ${BORDER}`,
        }}
      >
        <button
          onClick={onChat}
          disabled={doc.status !== 'COMPLETED'}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: doc.status === 'COMPLETED' ? PRIMARY : '#e9ecef',
            color: doc.status === 'COMPLETED' ? '#fff' : '#adb5bd',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: doc.status === 'COMPLETED' ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
          }}
        >
          <MessageSquare size={13} />
          Chat
        </button>
        {(doc.status === 'FAILED' || doc.status === 'COMPLETED') && (
          <button
            onClick={onReprocess}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid #6c757d',
              color: '#6c757d',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
            }}
          >
            <RefreshCw size={13} />
            Reprocess
          </button>
        )}
        <button
          onClick={onDelete}
          style={{
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid #dc3545',
            color: '#dc3545',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

export function DocumentsPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [docs, setDocs] = useState<DocumentResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<DocumentResponse | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDocs = useCallback(
    async (page = 0, q = search, status = statusFilter) => {
      setLoading(true);
      try {
        const resp = await apiGetDocuments({ page, size: PAGE_SIZE, q: q || undefined, status: status || undefined });
        setDocs(resp.content);
        setTotal(resp.totalElements);
        setTotalPages(resp.totalPages);
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter]
  );

  useEffect(() => {
    loadDocs(currentPage);
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(0);
    loadDocs(0, search, statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(0);
      loadDocs(0, search, statusFilter);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  useEffect(() => {
    const hasActive = docs.some((d) => d.status === 'PROCESSING' || d.status === 'PENDING');
    if (hasActive) {
      pollRef.current = setInterval(() => loadDocs(currentPage), 5000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [docs]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await apiDeleteDocument(deleteTarget.id);
    showToast('success', `"${truncateFilename(deleteTarget.originalName)}" deleted.`);
    setDeleteTarget(null);
    loadDocs(currentPage);
  };

  const handleReprocess = async (doc: DocumentResponse) => {
    await apiReprocessDocument(doc.id);
    showToast('info', `Reprocessing "${truncateFilename(doc.originalName)}"...`);
    loadDocs(currentPage);
  };

  const handleChat = (doc: DocumentResponse) => {
    navigate(`/chat?docId=${doc.id}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6c757d' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents..."
            style={{
              width: '100%',
              height: 38,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '0 12px 0 38px',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            height: 38,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: '0 32px 0 12px',
            fontSize: 14,
            outline: 'none',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span style={{ color: '#6c757d', fontSize: 14, whiteSpace: 'nowrap' }}>
          {total} document{total !== 1 ? 's' : ''}
        </span>
        <button
          onClick={() => navigate('/upload')}
          style={{
            display: 'flex',
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
          Upload PDF
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{ height: 200, background: '#e9ecef', borderRadius: 12, animation: 'pulse 1.5s infinite' }}
            />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div
          style={{
            background: '#fff',
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '60px 20px',
            textAlign: 'center',
          }}
        >
          <FilePlus size={56} style={{ color: '#adb5bd', marginBottom: 16, opacity: 0.5 }} />
          <h6 style={{ margin: '0 0 8px', color: '#495057' }}>No documents found</h6>
          <p style={{ margin: '0 0 20px', color: '#6c757d', fontSize: 14 }}>
            {search || statusFilter
              ? 'Try a different search or filter.'
              : 'Upload a PDF to get started with AI-powered Q&A.'}
          </p>
          <button
            onClick={() => navigate('/upload')}
            style={{
              background: PRIMARY,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Upload PDF
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {docs.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              onDelete={() => setDeleteTarget(doc)}
              onReprocess={() => handleReprocess(doc)}
              onChat={() => handleChat(doc)}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              width: 36,
              height: 36,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              background: '#fff',
              cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
              color: currentPage === 0 ? '#adb5bd' : '#495057',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronLeft size={16} />
          </button>
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i)}
              style={{
                width: 36,
                height: 36,
                border: `1px solid ${i === currentPage ? PRIMARY : BORDER}`,
                borderRadius: 6,
                background: i === currentPage ? PRIMARY : '#fff',
                color: i === currentPage ? '#fff' : '#495057',
                fontWeight: i === currentPage ? 700 : 400,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            style={{
              width: 36,
              height: 36,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              background: '#fff',
              cursor: currentPage === totalPages - 1 ? 'not-allowed' : 'pointer',
              color: currentPage === totalPages - 1 ? '#adb5bd' : '#495057',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <DeleteModal
          doc={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
