export type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REPROCESSING';

export interface DocumentResponse {
  id: string;
  originalName: string;
  fileSize: number;
  fileSizeFormatted: string;
  pageCount: number | null;
  status: DocumentStatus;
  errorMessage: string | null;
  title: string | null;
  author: string | null;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CitationResponse {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  similarityScore: number;
}

export interface MessageResponse {
  id: string;
  role: 'USER' | 'ASSISTANT';
  content: string;
  citations: CitationResponse[];
  createdAt: string;
}

export interface ChatResponse {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  messages: MessageResponse[] | null;
}

export interface SearchResultResponse {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  excerpt: string;
  similarityScore: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  userId: string;
  username: string;
  email: string;
  roles: string[];
}

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserResponse {
  id: string;
  username: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  enabled: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminStatsResponse {
  userCount: number;
  documentCount: number;
  totalStorageBytes: number;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface SendMessageRequest {
  question: string;
  documentId: string | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'danger' | 'warning' | 'info';
  message: string;
}
