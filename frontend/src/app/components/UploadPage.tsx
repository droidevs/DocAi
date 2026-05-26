import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { CloudUpload, FileText, X, CheckCircle, XCircle, Lightbulb, ArrowRight } from 'lucide-react';
import { apiUploadDocument } from './shared/mockApi';
import { useToast } from '../context/ToastContext';
import { formatBytes } from './shared/utils';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';

interface QueueFile {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

export function UploadPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [queue, setQueue] = useState<QueueFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((files: FileList | File[]) => {
    const newFiles: QueueFile[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).substring(2) + Date.now(),
      file,
      status: 'queued',
      progress: 0,
    }));
    setQueue((q) => [...q, ...newFiles]);
  }, []);

  const removeFile = (id: string) => {
    setQueue((q) => q.filter((f) => f.id !== id));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };

  const uploadAll = async () => {
    const toUpload = queue.filter((f) => f.status === 'queued');
    if (!toUpload.length) return;
    setUploading(true);

    for (const item of toUpload) {
      setQueue((q) => q.map((f) => (f.id === item.id ? { ...f, status: 'uploading' } : f)));
      try {
        await apiUploadDocument(item.file, (progress) => {
          setQueue((q) => q.map((f) => (f.id === item.id ? { ...f, progress } : f)));
        });
        setQueue((q) => q.map((f) => (f.id === item.id ? { ...f, status: 'done', progress: 100 } : f)));
      } catch (err: any) {
        const errMsg = err?.detail || 'Upload failed';
        setQueue((q) => q.map((f) => (f.id === item.id ? { ...f, status: 'error', error: errMsg } : f)));
      }
    }

    setUploading(false);
    const allDone = queue.every((f) => f.status === 'done' || f.id === toUpload[toUpload.length - 1]?.id);

    showToast('success', 'Upload complete! Redirecting to Documents...');
    setTimeout(() => navigate('/documents'), 1800);
  };

  const clearQueue = () => {
    setQueue((q) => q.filter((f) => f.status === 'uploading'));
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? PRIMARY : '#86b7fe'}`,
          borderRadius: 16,
          background: dragging ? '#f0f6ff' : '#fff',
          padding: '52px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
        <CloudUpload
          size={52}
          style={{ color: dragging ? PRIMARY : '#86b7fe', marginBottom: 16 }}
        />
        <h5 style={{ margin: '0 0 8px', fontWeight: 600, color: '#212529' }}>
          {dragging ? 'Drop your PDF files here' : 'Drag & drop PDF files here'}
        </h5>
        <p style={{ margin: '0 0 20px', color: '#6c757d', fontSize: 14 }}>
          or click to browse from your computer
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          {['PDF only', '50MB max', 'Multiple files'].map((hint) => (
            <span key={hint} style={{ fontSize: 13, color: '#6c757d', display: 'flex', alignItems: 'center', gap: 5 }}>
              <CheckCircle size={14} color="#198754" />
              {hint}
            </span>
          ))}
        </div>
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
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
              padding: '12px 16px',
              borderBottom: `1px solid ${BORDER}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <h6 style={{ margin: 0, fontWeight: 600, fontSize: 15 }}>
              Upload Queue ({queue.length} file{queue.length !== 1 ? 's' : ''})
            </h6>
            <button
              onClick={clearQueue}
              disabled={uploading}
              style={{
                background: 'none',
                border: 'none',
                color: '#6c757d',
                fontSize: 13,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          </div>

          <div>
            {queue.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderBottom: `1px solid #f8f9fa`,
                }}
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
                      fontWeight: 500,
                      color: '#212529',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.file.name}
                  </div>
                  <div style={{ fontSize: 12, color: '#6c757d', marginBottom: 4 }}>
                    {formatBytes(item.file.size)}
                  </div>
                  {item.status === 'uploading' && (
                    <div style={{ height: 3, background: '#e9ecef', borderRadius: 3, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: item.progress + '%',
                          background: PRIMARY,
                          borderRadius: 3,
                          transition: 'width 0.2s ease',
                          backgroundImage: `repeating-linear-gradient(
                            45deg,
                            transparent,
                            transparent 10px,
                            rgba(255,255,255,0.2) 10px,
                            rgba(255,255,255,0.2) 20px
                          )`,
                        }}
                      />
                    </div>
                  )}
                  {item.status === 'queued' && (
                    <div style={{ height: 3, background: '#e9ecef', borderRadius: 3 }} />
                  )}
                  {item.error && (
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#dc3545' }}>{item.error}</p>
                  )}
                </div>
                <div style={{ flexShrink: 0 }}>
                  {item.status === 'uploading' && (
                    <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>
                      {item.progress}%
                    </span>
                  )}
                  {item.status === 'done' && <CheckCircle size={20} color="#198754" />}
                  {item.status === 'error' && <XCircle size={20} color="#dc3545" />}
                  {item.status === 'queued' && (
                    <button
                      onClick={() => removeFile(item.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#6c757d',
                        padding: 0,
                      }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ padding: '12px 16px' }}>
            <button
              onClick={uploadAll}
              disabled={uploading || queue.every((f) => f.status !== 'queued')}
              style={{
                width: '100%',
                padding: '10px',
                background: uploading ? '#6ea8fe' : PRIMARY,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 600,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {uploading ? (
                'Uploading...'
              ) : (
                <>
                  <ArrowRight size={16} />
                  Upload All Files
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tips card */}
      <div
        style={{
          background: '#cfe2ff',
          border: '1px solid #b6d4fe',
          borderRadius: 12,
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
            fontWeight: 600,
            color: '#0a58ca',
            fontSize: 14,
          }}
        >
          <Lightbulb size={16} />
          Tips for best results
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            'Text-based PDFs work best (not scanned images)',
            'Clear, well-structured documents produce better answers',
            'Processing may take 1–2 minutes for large files',
            'Duplicate files are automatically detected',
          ].map((tip) => (
            <li
              key={tip}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#0a58ca' }}
            >
              <CheckCircle size={14} color="#0d6efd" />
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
