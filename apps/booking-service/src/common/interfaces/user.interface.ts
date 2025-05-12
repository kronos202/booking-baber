// src/common/interfaces/user.interface.ts

import { RoleEnum } from '../enums/role.enum';

export interface AuthUser {
  id: number;
  sessionId: number;
  hash: string;
  role: RoleEnum;
}
