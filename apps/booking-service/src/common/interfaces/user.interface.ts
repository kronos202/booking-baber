// src/common/interfaces/user.interface.ts

import { Role } from '@prisma/client';

export interface AuthUser {
  id: number;
  sessionId: number;
  hash: string;
  role: Role;
}
