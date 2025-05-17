import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class BranchService {
  constructor(protected databaseService: DatabaseService) {}
  async createBranch(
    name: string,
    address: string,
    phone: string,
    userRole: Role,
    close_time: string,
    open_time: string,
  ) {
    if (userRole !== 'ADMIN')
      throw new ForbiddenException('Only admins can create branches');
    return this.databaseService.branch.create({
      data: { name, address, phone, close_time, open_time },
    });
  }

  async getBranches() {
    return this.databaseService.branch.findMany();
  }

  async getBranch(id: number) {
    const branch = await this.databaseService.branch.findUnique({
      where: { id },
    });
    if (!branch) throw new BadRequestException('Branch not found');
    return branch;
  }

  async updateBranch(
    id: number,
    name?: string,
    address?: string,
    phone?: string,
    userRole?: string,
  ) {
    if (userRole !== 'admin')
      throw new ForbiddenException('Only admins can update branches');
    const branch = await this.databaseService.branch.findUnique({
      where: { id },
    });
    if (!branch) throw new BadRequestException('Branch not found');
    return this.databaseService.branch.update({
      where: { id },
      data: { name, address, phone },
    });
  }

  async deleteBranch(id: number, userRole: string) {
    if (userRole !== 'admin')
      throw new ForbiddenException('Only admins can delete branches');
    const branch = await this.databaseService.branch.findUnique({
      where: { id },
    });
    if (!branch) throw new BadRequestException('Branch not found');
    return this.databaseService.branch.delete({ where: { id } });
  }
}
