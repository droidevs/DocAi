import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, MessageSquare, X, FileText, ChevronDown } from 'lucide-react';
import { apiSearch, apiGetDocuments } from './shared/mockApi';
import { formatSimilarity, truncateFilename } from './shared/utils';
import { useToast } from '../context/ToastContext';
import type { SearchResultResponse, DocumentResponse } from './shared/types';
import { useEffect } from 'react';

const PRIMARY = '#0d6efd';
const BORDER = '#e9ecef';

const SUGGESTIONS = [
  'What are the key findings?',
  'Summarize the main points',
  'What are the conclusions?',
];

function getSimilarityBadge(score: number): { bg: string; color: string } {
  const pct = score * 100;
  if (pct >= 85) return { bg: '#d1e7dd', color: '#0f5132' };
  if (pct >= 70) return { bg: '#cfe2ff', color: '#0a58ca' };
  return { bg: '#fff3cd', color: '#664d03' };
}

function ExcerptModal({
  result,
  onClose,
  onAskAbout,
}: {
  result: SearchResultResponse;
  onClose: () => void;
  onAskAbout: () => void;
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
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 660,
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
            <h6 style={{ margin: 0, fontWeight: 600 }}>Full Excerpt</h6>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6c757d' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#6c757d' }}>
              {truncateFilename(result.documentName)} · Page {result.pageNumber} ·{' '}
              <strong style={{ color: PRIMARY }}>{formatSimilarity(result.similarityScore)} match</strong>
            </span>
          </div>
          <div
            style={{
              background: '#f8f9fa',
              borderLeft: `4px solid ${PRIMARY}`,
              padding: 16,
              borderRadius: '0 8px 8px 0',
              fontSize: 14,
              lineHeight: 1.8,
              color: '#212529',
              marginBottom: 16,
            }}
          >
            <em>"{result.excerpt}"</em>
          </div>
          <button
            onClick={onAskAbout}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: PRIMARY,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <MessageSquare size={15} />
            Ask about this →
          </button>
        </div>
      </div>
    </div>
  );
}

export function SearchPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [topK, setTopK] = useState(10);
  const [documentId, setDocumentId] = useState('');
  const [documents, setDocuments] = useState<DocumentResponse[]>([]);
  const [selectedExcerpt, setSelectedExcerpt] = useState<SearchResultResponse | null>(null);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiGetDocuments({ size: 100 }).then((resp) =>
      setDocuments(resp.content.filter((d) => d.status === 'COMPLETED'))
    );
  }, []);

  const handleSearch = async (q = query) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiSearch({ q: q.trim(), topK, documentId: documentId || undefined });
      setResults(res);
    } catch {
      showToast('danger', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestion = (s: string) => {
    setQuery(s);
    handleSearch(s);
  };

  const handleAskAI = () => {
    navigate(`/chat?q=${encodeURIComponent(query)}`);
  };

  const toggleExpand = (id: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800, margin: '0 auto' }}>
      {/* Search bar card */}
      <div
        style={{
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 20,
          boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#6c757d',
              }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your documents semantically..."
              style={{
                width: '100%',
                height: 42,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: '0 12px 0 40px',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            style={{
              padding: '0 20px',
              background: loading || !query.trim() ? '#e9ecef' : PRIMARY,
              color: loading || !query.trim() ? '#adb5bd' : '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <select
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            style={{
              height: 34,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 13,
              background: '#fff',
            }}
          >
            <option value="">All documents</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {truncateFilename(d.originalName, 30)}
              </option>
            ))}
          </select>
          <select
            value={topK}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{
              height: 34,
              border: `1px solid ${BORDER}`,
              borderRadius: 6,
              padding: '0 8px',
              fontSize: 13,
              background: '#fff',
            }}
          >
            {[5, 10, 15, 20].map((k) => (
              <option key={k} value={k}>Top {k} results</option>
            ))}
          </select>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#cff4fc',
            borderRadius: 8,
            fontSize: 13,
            color: '#055160',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Search size={13} />
          Semantic search finds conceptually related content — not just keyword matches.
        </div>
      </div>

      {/* Empty / suggestions state */}
      {!searched && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Search size={52} style={{ color: '#adb5bd', marginBottom: 16, opacity: 0.5 }} />
          <h5 style={{ margin: '0 0 6px', color: '#495057' }}>Search your documents</h5>
          <p style={{ margin: '0 0 24px', color: '#6c757d', fontSize: 14 }}>
            Type a query above to find semantically related passages across all your documents.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSuggestion(s)}
                style={{
                  padding: '8px 16px',
                  background: '#fff',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 20,
                  fontSize: 13,
                  cursor: 'pointer',
                  color: '#495057',
                  fontWeight: 500,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {searched && !loading && (
        <>
          {results.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <span style={{ color: '#6c757d', fontSize: 14 }}>
                Found <strong style={{ color: '#212529' }}>{results.length}</strong> relevant passages
                {query && (
                  <>
                    {' '}for <strong style={{ color: '#212529' }}>"{query}"</strong>
                  </>
                )}
              </span>
              <button
                onClick={handleAskAI}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  background: PRIMARY,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <MessageSquare size={14} />
                Ask AI about these results →
              </button>
            </div>
          )}

          {results.length === 0 ? (
            <div
              style={{
                background: '#fff',
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: '50px 20px',
                textAlign: 'center',
              }}
            >
              <Search size={44} style={{ color: '#adb5bd', marginBottom: 12, opacity: 0.5 }} />
              <h6 style={{ margin: '0 0 6px', color: '#495057' }}>No results found</h6>
              <p style={{ margin: 0, color: '#6c757d', fontSize: 14 }}>
                Try a different query or make sure your documents are processed.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((result, index) => {
                const badge = getSimilarityBadge(result.similarityScore);
                const isExpanded = expandedResults.has(result.chunkId);
                return (
                  <div
                    key={result.chunkId}
                    style={{
                      background: '#fff',
                      border: `1px solid ${BORDER}`,
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 0.125rem 0.25rem rgba(0,0,0,0.075)',
                    }}
                  >
                    <div style={{ padding: '14px 16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          marginBottom: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            background: '#cfe2ff',
                            borderRadius: 8,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: PRIMARY,
                            fontSize: 14,
                            flexShrink: 0,
                          }}
                        >
                          {index + 1}
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
                          >
                            {truncateFilename(result.documentName)}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <span
                              style={{
                                background: '#e2e3e5',
                                color: '#41464b',
                                borderRadius: 6,
                                padding: '2px 8px',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              Page {result.pageNumber}
                            </span>
                            <span
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                borderRadius: 6,
                                padding: '2px 8px',
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {formatSimilarity(result.similarityScore)} match
                            </span>
                          </div>
                        </div>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 14,
                          color: '#495057',
                          lineHeight: 1.6,
                          overflow: isExpanded ? 'visible' : 'hidden',
                          display: isExpanded ? 'block' : '-webkit-box',
                          WebkitLineClamp: isExpanded ? undefined : 3,
                          WebkitBoxOrient: 'vertical' as const,
                        }}
                      >
                        {result.excerpt}
                      </p>
                    </div>
                    <div
                      style={{
                        padding: '10px 16px',
                        borderTop: `1px solid ${BORDER}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <button
                        onClick={() => toggleExpand(result.chunkId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#6c757d',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: 0,
                        }}
                      >
                        {isExpanded ? 'Show less' : 'Full excerpt'}
                        <ChevronDown
                          size={14}
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                        />
                      </button>
                      <button
                        onClick={() => navigate(`/chat?docId=${result.documentId}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '5px 12px',
                          background: 'none',
                          border: `1px solid ${PRIMARY}`,
                          borderRadius: 6,
                          color: PRIMARY,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <MessageSquare size={13} />
                        Chat with doc →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selectedExcerpt && (
        <ExcerptModal
          result={selectedExcerpt}
          onClose={() => setSelectedExcerpt(null)}
          onAskAbout={() => {
            navigate(`/chat?docId=${selectedExcerpt.documentId}`);
            setSelectedExcerpt(null);
          }}
        />
      )}
    </div>
  );
}
