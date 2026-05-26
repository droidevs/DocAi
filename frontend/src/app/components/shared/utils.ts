export function formatBytes(b: number | null): string {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatSimilarity(score: number): string {
  return (score * 100).toFixed(0) + '%';
}

export function truncateFilename(name: string, max = 35): string {
  const base = name.split('/').pop() || name;
  return base.length > max ? base.substring(0, max - 3) + '…' : base;
}

export function getInitials(firstName?: string | null, lastName?: string | null, username?: string): string {
  if (firstName && lastName) return (firstName[0] + lastName[0]).toUpperCase();
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return 'U';
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}
