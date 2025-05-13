// src/common/interfaces/user.interface.ts

import { Role } from 'generated/prisma';

export interface AuthUser {
  id: number;
  sessionId: number;
  hash: string;
  role: Role;
}
