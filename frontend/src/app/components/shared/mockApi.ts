import type {
  AuthResponse,
  DocumentResponse,
  PageResponse,
  ChatResponse,
  MessageResponse,
  SearchResultResponse,
  UserProfileResponse,
  AdminUserResponse,
  AdminStatsResponse,
  RegisterRequest,
  LoginRequest,
  SendMessageRequest,
  UpdateProfileRequest,
} from './types';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Mock data store ───────────────────────────────────────────────────────

let mockDocuments: DocumentResponse[] = [
  {
    id: 'doc-1',
    originalName: 'Annual_Report_2025.pdf',
    fileSize: 2621440,
    fileSizeFormatted: '2.5 MB',
    pageCount: 42,
    status: 'COMPLETED',
    errorMessage: null,
    title: 'Annual Report 2025',
    author: 'Finance Team',
    chunkCount: 78,
    createdAt: '2026-05-20T10:30:00',
    updatedAt: '2026-05-20T10:35:00',
  },
  {
    id: 'doc-2',
    originalName: 'Research_Paper_AI.pdf',
    fileSize: 1048576,
    fileSizeFormatted: '1.0 MB',
    pageCount: 18,
    status: 'COMPLETED',
    errorMessage: null,
    title: 'AI in Healthcare',
    author: 'Dr. Johnson',
    chunkCount: 34,
    createdAt: '2026-05-18T14:20:00',
    updatedAt: '2026-05-18T14:25:00',
  },
  {
    id: 'doc-3',
    originalName: 'Product_Roadmap_Q3.pdf',
    fileSize: 512000,
    fileSizeFormatted: '500 KB',
    pageCount: null,
    status: 'PROCESSING',
    errorMessage: null,
    title: null,
    author: null,
    chunkCount: 0,
    createdAt: '2026-05-26T09:00:00',
    updatedAt: '2026-05-26T09:01:00',
  },
  {
    id: 'doc-4',
    originalName: 'Legal_Contract_2026.pdf',
    fileSize: 786432,
    fileSizeFormatted: '768 KB',
    pageCount: 12,
    status: 'FAILED',
    errorMessage: 'OCR processing failed: scanned image document not supported',
    title: null,
    author: null,
    chunkCount: 0,
    createdAt: '2026-05-15T11:00:00',
    updatedAt: '2026-05-15T11:05:00',
  },
  {
    id: 'doc-5',
    originalName: 'Market_Analysis_Report.pdf',
    fileSize: 3145728,
    fileSizeFormatted: '3.0 MB',
    pageCount: 56,
    status: 'COMPLETED',
    errorMessage: null,
    title: 'Global Market Analysis 2026',
    author: 'Analytics Dept',
    chunkCount: 112,
    createdAt: '2026-05-10T08:00:00',
    updatedAt: '2026-05-10T08:10:00',
  },
  {
    id: 'doc-6',
    originalName: 'Employee_Handbook.pdf',
    fileSize: 1572864,
    fileSizeFormatted: '1.5 MB',
    pageCount: 30,
    status: 'PENDING',
    errorMessage: null,
    title: null,
    author: null,
    chunkCount: 0,
    createdAt: '2026-05-26T08:50:00',
    updatedAt: '2026-05-26T08:50:00',
  },
];

let mockChats: ChatResponse[] = [
  {
    id: 'chat-1',
    title: 'What are the main findings?',
    messageCount: 8,
    createdAt: '2026-05-25T10:00:00',
    updatedAt: '2026-05-25T10:30:00',
    messages: null,
  },
  {
    id: 'chat-2',
    title: 'Summarize the key recommendations',
    messageCount: 4,
    createdAt: '2026-05-24T14:00:00',
    updatedAt: '2026-05-24T14:20:00',
    messages: null,
  },
  {
    id: 'chat-3',
    title: 'AI healthcare use cases discussion',
    messageCount: 12,
    createdAt: '2026-05-22T09:00:00',
    updatedAt: '2026-05-22T10:00:00',
    messages: null,
  },
];

const mockMessages: Record<string, MessageResponse[]> = {
  'chat-1': [
    {
      id: 'msg-1',
      role: 'USER',
      content: 'What are the main findings?',
      citations: [],
      createdAt: '2026-05-25T10:00:00',
    },
    {
      id: 'msg-2',
      role: 'ASSISTANT',
      content:
        'Based on the Annual Report 2025, the main findings are:\n\n1. **Revenue Growth**: Total revenue increased by 23% year-over-year, reaching $4.2B.\n2. **Operational Efficiency**: Operating costs reduced by 12% through digital transformation initiatives.\n3. **Market Expansion**: The company entered 3 new markets in Southeast Asia, contributing 8% of total revenue.\n4. **R&D Investment**: R&D spending increased to 15% of revenue, the highest in company history.',
      citations: [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          documentName: 'Annual_Report_2025.pdf',
          pageNumber: 4,
          excerpt: 'Revenue grew by 23% year-over-year, reaching $4.2 billion in fiscal year 2025, driven primarily by strong performance in the enterprise segment...',
          similarityScore: 0.92,
        },
        {
          chunkId: 'chunk-2',
          documentId: 'doc-1',
          documentName: 'Annual_Report_2025.pdf',
          pageNumber: 11,
          excerpt: 'Operating cost reduction of 12% was achieved through strategic automation and workforce optimization programs implemented in Q2 2025...',
          similarityScore: 0.87,
        },
      ],
      createdAt: '2026-05-25T10:00:05',
    },
    {
      id: 'msg-3',
      role: 'USER',
      content: 'What was the operating margin?',
      citations: [],
      createdAt: '2026-05-25T10:05:00',
    },
    {
      id: 'msg-4',
      role: 'ASSISTANT',
      content:
        'According to the Annual Report 2025, the operating margin improved significantly:\n\n- **Current Year Operating Margin**: 28.4% (up from 22.1% in 2024)\n- **EBITDA Margin**: 34.2%\n- **Net Profit Margin**: 19.8%\n\nThe improvement was primarily driven by economies of scale and the cost reduction initiatives mentioned in the executive summary.',
      citations: [
        {
          chunkId: 'chunk-3',
          documentId: 'doc-1',
          documentName: 'Annual_Report_2025.pdf',
          pageNumber: 7,
          excerpt: 'Operating margin improved to 28.4% from 22.1% the prior year, reflecting the positive impact of our efficiency programs and favorable pricing...',
          similarityScore: 0.95,
        },
      ],
      createdAt: '2026-05-25T10:05:05',
    },
  ],
  'chat-2': [
    {
      id: 'msg-5',
      role: 'USER',
      content: 'Summarize the key recommendations',
      citations: [],
      createdAt: '2026-05-24T14:00:00',
    },
    {
      id: 'msg-6',
      role: 'ASSISTANT',
      content:
        'The document outlines several key strategic recommendations:\n\n1. **Digital Transformation**: Accelerate cloud migration to reduce infrastructure costs by an estimated 30%.\n2. **Talent Acquisition**: Hire 500 additional engineers in AI/ML roles over the next 18 months.\n3. **Customer Experience**: Implement a unified CRM platform to improve NPS from 42 to 65.\n4. **Sustainability**: Achieve carbon neutrality by 2028 through renewable energy procurement.',
      citations: [
        {
          chunkId: 'chunk-4',
          documentId: 'doc-1',
          documentName: 'Annual_Report_2025.pdf',
          pageNumber: 38,
          excerpt: 'The strategic roadmap calls for aggressive digital transformation with cloud-first infrastructure targeting 30% cost savings over 3 years...',
          similarityScore: 0.89,
        },
      ],
      createdAt: '2026-05-24T14:00:05',
    },
  ],
  'chat-3': [],
};

const mockUser: UserProfileResponse = {
  id: 'user-1',
  username: 'johndoe',
  email: 'john@example.com',
  firstName: 'John',
  lastName: 'Doe',
  roles: ['ROLE_USER', 'ROLE_ADMIN'],
  createdAt: '2026-01-15T09:00:00',
  updatedAt: '2026-05-20T14:30:00',
};

const mockAdminUsers: AdminUserResponse[] = [
  {
    id: 'user-1',
    username: 'johndoe',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
    enabled: true,
    roles: ['ROLE_USER', 'ROLE_ADMIN'],
    createdAt: '2026-01-15T09:00:00',
    updatedAt: '2026-05-20T14:30:00',
  },
  {
    id: 'user-2',
    username: 'alice',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    enabled: true,
    roles: ['ROLE_USER'],
    createdAt: '2026-02-10T10:00:00',
    updatedAt: '2026-05-15T08:00:00',
  },
  {
    id: 'user-3',
    username: 'bobmarley',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Marley',
    enabled: false,
    roles: ['ROLE_USER'],
    createdAt: '2026-03-05T11:00:00',
    updatedAt: '2026-04-20T09:00:00',
  },
  {
    id: 'user-4',
    username: 'carol',
    email: 'carol@example.com',
    firstName: 'Carol',
    lastName: 'White',
    enabled: true,
    roles: ['ROLE_USER'],
    createdAt: '2026-04-01T12:00:00',
    updatedAt: '2026-05-10T14:00:00',
  },
];

// ─── Auth API ──────────────────────────────────────────────────────────────

export async function apiLogin(req: LoginRequest): Promise<AuthResponse> {
  await delay(800);
  if (req.username === 'wrong' || req.password === 'wrong') {
    throw { status: 401, detail: 'Authentication failed' };
  }
  const response: AuthResponse = {
    accessToken: 'mock-jwt-token-' + Date.now(),
    refreshToken: 'mock-refresh-' + Date.now(),
    tokenType: 'Bearer',
    expiresIn: 86400,
    userId: 'user-1',
    username: req.username || mockUser.username,
    email: mockUser.email,
    roles: mockUser.roles,
  };
  return response;
}

export async function apiRegister(req: RegisterRequest): Promise<AuthResponse> {
  await delay(1000);
  if (req.username === 'taken') {
    throw { status: 400, detail: 'Username already taken' };
  }
  if (req.username.length < 3) {
    throw {
      status: 400,
      detail: 'Validation failed',
      errors: { username: 'Username must be 3-50 characters' },
    };
  }
  return {
    accessToken: 'mock-jwt-token-' + Date.now(),
    refreshToken: 'mock-refresh-' + Date.now(),
    tokenType: 'Bearer',
    expiresIn: 86400,
    userId: 'user-new',
    username: req.username,
    email: req.email,
    roles: ['ROLE_USER'],
  };
}

// ─── Documents API ─────────────────────────────────────────────────────────

export async function apiGetDocuments(params: {
  page?: number;
  size?: number;
  q?: string;
  status?: string;
}): Promise<PageResponse<DocumentResponse>> {
  await delay(400);
  let filtered = [...mockDocuments];
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter((d) => d.originalName.toLowerCase().includes(q));
  }
  if (params.status) {
    filtered = filtered.filter((d) => d.status === params.status);
  }
  const page = params.page ?? 0;
  const size = params.size ?? 12;
  const start = page * size;
  const content = filtered.slice(start, start + size);
  return {
    content,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    number: page,
    size,
  };
}

export async function apiDeleteDocument(id: string): Promise<void> {
  await delay(500);
  mockDocuments = mockDocuments.filter((d) => d.id !== id);
}

export async function apiReprocessDocument(id: string): Promise<void> {
  await delay(400);
  const doc = mockDocuments.find((d) => d.id === id);
  if (doc) {
    doc.status = 'REPROCESSING';
    doc.updatedAt = new Date().toISOString();
    setTimeout(() => {
      doc.status = 'COMPLETED';
      doc.updatedAt = new Date().toISOString();
    }, 5000);
  }
}

export async function apiUploadDocument(
  file: File,
  onProgress: (pct: number) => void
): Promise<DocumentResponse> {
  return new Promise((resolve, reject) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 20;
      if (progress >= 90) {
        progress = 90;
        clearInterval(interval);
        setTimeout(() => {
          onProgress(100);
          const newDoc: DocumentResponse = {
            id: 'doc-' + Date.now(),
            originalName: file.name,
            fileSize: file.size,
            fileSizeFormatted:
              file.size < 1048576
                ? (file.size / 1024).toFixed(1) + ' KB'
                : (file.size / 1048576).toFixed(1) + ' MB',
            pageCount: null,
            status: 'PENDING',
            errorMessage: null,
            title: null,
            author: null,
            chunkCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          mockDocuments.unshift(newDoc);
          resolve(newDoc);
        }, 500);
      } else {
        onProgress(Math.round(progress));
      }
    }, 200);

    if (file.type !== 'application/pdf') {
      clearInterval(interval);
      reject({ detail: 'Only PDF files are accepted' });
    }
  });
}

// ─── Chats API ─────────────────────────────────────────────────────────────

export async function apiGetChats(params: {
  page?: number;
  size?: number;
}): Promise<PageResponse<ChatResponse>> {
  await delay(400);
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const start = page * size;
  const content = mockChats.slice(start, start + size);
  return {
    content,
    totalElements: mockChats.length,
    totalPages: Math.ceil(mockChats.length / size),
    number: page,
    size,
  };
}

export async function apiGetChat(chatId: string): Promise<ChatResponse> {
  await delay(300);
  const chat = mockChats.find((c) => c.id === chatId);
  if (!chat) throw { status: 404, detail: 'Chat not found' };
  return { ...chat, messages: mockMessages[chatId] || [] };
}

export async function apiCreateChat(title?: string): Promise<ChatResponse> {
  await delay(300);
  const newChat: ChatResponse = {
    id: 'chat-' + Date.now(),
    title: title || 'New Chat',
    messageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  mockChats.unshift(newChat);
  mockMessages[newChat.id] = [];
  return newChat;
}

export async function apiSendMessage(
  chatId: string,
  req: { question: string; documentId: string | null }
): Promise<MessageResponse> {
  await delay(1500 + Math.random() * 1000);
  const userMsg: MessageResponse = {
    id: 'msg-' + Date.now(),
    role: 'USER',
    content: req.question,
    citations: [],
    createdAt: new Date().toISOString(),
  };
  if (!mockMessages[chatId]) mockMessages[chatId] = [];
  mockMessages[chatId].push(userMsg);

  const aiResponses = [
    'Based on the documents you have uploaded, I can provide the following insights:\n\nThe key points from your documents indicate several important themes that are worth exploring in detail. The information suggests a comprehensive approach to the topic at hand.',
    'According to the uploaded documents, there are multiple perspectives on this topic:\n\n1. **Primary finding**: The data consistently shows significant patterns across all analyzed documents.\n2. **Secondary insight**: Cross-referencing multiple sources reveals additional context.\n3. **Conclusion**: The overall evidence supports a structured interpretation of the findings.',
    'The documents contain relevant information about your query. Here is what I found:\n\nThe primary sources indicate that this is a multifaceted issue requiring careful consideration of all available evidence. The supporting materials provide additional context that enriches the overall understanding.',
  ];

  const assistantMsg: MessageResponse = {
    id: 'msg-ai-' + Date.now(),
    role: 'ASSISTANT',
    content: aiResponses[Math.floor(Math.random() * aiResponses.length)],
    citations:
      mockDocuments.filter((d) => d.status === 'COMPLETED').length > 0
        ? [
            {
              chunkId: 'chunk-' + Date.now(),
              documentId: mockDocuments.find((d) => d.status === 'COMPLETED')!.id,
              documentName: mockDocuments.find((d) => d.status === 'COMPLETED')!.originalName,
              pageNumber: Math.floor(Math.random() * 20) + 1,
              excerpt:
                'This excerpt is directly relevant to your question and provides supporting evidence from the source document content...',
              similarityScore: 0.7 + Math.random() * 0.25,
            },
          ]
        : [],
    createdAt: new Date().toISOString(),
  };

  mockMessages[chatId].push(assistantMsg);

  const chat = mockChats.find((c) => c.id === chatId);
  if (chat) {
    if (chat.title === 'New Chat') {
      chat.title = req.question.length > 60 ? req.question.substring(0, 57) + '...' : req.question;
    }
    chat.messageCount = (chat.messageCount || 0) + 2;
    chat.updatedAt = new Date().toISOString();
  }

  return assistantMsg;
}

export async function apiRenameChat(chatId: string, title: string): Promise<ChatResponse> {
  await delay(300);
  const chat = mockChats.find((c) => c.id === chatId);
  if (!chat) throw { status: 404, detail: 'Chat not found' };
  chat.title = title;
  chat.updatedAt = new Date().toISOString();
  return { ...chat, messages: null };
}

export async function apiDeleteChat(chatId: string): Promise<void> {
  await delay(400);
  mockChats = mockChats.filter((c) => c.id !== chatId);
  delete mockMessages[chatId];
}

// ─── Search API ────────────────────────────────────────────────────────────

export async function apiSearch(params: {
  q: string;
  topK?: number;
  documentId?: string;
}): Promise<SearchResultResponse[]> {
  await delay(800);
  const completedDocs = mockDocuments.filter((d) => d.status === 'COMPLETED');
  if (completedDocs.length === 0) return [];

  const results: SearchResultResponse[] = completedDocs
    .slice(0, params.topK ?? 10)
    .flatMap((doc) => {
      const count = Math.floor(Math.random() * 3) + 1;
      return Array.from({ length: count }, (_, i) => ({
        chunkId: 'chunk-' + doc.id + '-' + i,
        documentId: doc.id,
        documentName: doc.originalName,
        pageNumber: Math.floor(Math.random() * (doc.pageCount || 20)) + 1,
        excerpt:
          `This passage from ${doc.originalName} is semantically related to "${params.q}". ` +
          'The content provides relevant context and supporting evidence for the query. ' +
          'Further details are available by viewing the full document in the citation modal.',
        similarityScore: 0.6 + Math.random() * 0.38,
      }));
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, params.topK ?? 10);

  return results;
}

// ─── User Profile API ──────────────────────────────────────────────────────

export async function apiGetProfile(): Promise<UserProfileResponse> {
  await delay(300);
  return { ...mockUser };
}

export async function apiUpdateProfile(req: UpdateProfileRequest): Promise<UserProfileResponse> {
  await delay(600);
  if (req.firstName !== undefined) mockUser.firstName = req.firstName;
  if (req.lastName !== undefined) mockUser.lastName = req.lastName;
  if (req.email !== undefined) mockUser.email = req.email;
  mockUser.updatedAt = new Date().toISOString();
  return { ...mockUser };
}

export async function apiChangePassword(_req: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  await delay(700);
  if (_req.currentPassword === 'wrong') {
    throw { status: 400, detail: 'Current password is incorrect' };
  }
  if (_req.newPassword !== _req.confirmPassword) {
    throw { status: 400, detail: 'New password and confirmation do not match' };
  }
}

// ─── Admin API ─────────────────────────────────────────────────────────────

export async function apiAdminGetStats(): Promise<AdminStatsResponse> {
  await delay(400);
  return {
    userCount: mockAdminUsers.length,
    documentCount: mockDocuments.length,
    totalStorageBytes: mockDocuments.reduce((sum, d) => sum + d.fileSize, 0),
  };
}

export async function apiAdminGetUsers(params: {
  page?: number;
  size?: number;
  q?: string;
}): Promise<PageResponse<AdminUserResponse>> {
  await delay(400);
  let filtered = [...mockAdminUsers];
  if (params.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.firstName && u.firstName.toLowerCase().includes(q))
    );
  }
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  return {
    content: filtered.slice(page * size, page * size + size),
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    number: page,
    size,
  };
}

export async function apiAdminGetDocuments(params: {
  page?: number;
  size?: number;
}): Promise<PageResponse<DocumentResponse>> {
  await delay(400);
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  return {
    content: mockDocuments.slice(page * size, page * size + size),
    totalElements: mockDocuments.length,
    totalPages: Math.ceil(mockDocuments.length / size),
    number: page,
    size,
  };
}

export async function apiAdminDeleteDocument(id: string): Promise<void> {
  await delay(500);
  mockDocuments = mockDocuments.filter((d) => d.id !== id);
}

export async function apiAdminToggleUser(userId: string, enabled: boolean): Promise<AdminUserResponse> {
  await delay(400);
  const user = mockAdminUsers.find((u) => u.id === userId);
  if (!user) throw { status: 404, detail: 'User not found' };
  user.enabled = enabled;
  return { ...user };
}
