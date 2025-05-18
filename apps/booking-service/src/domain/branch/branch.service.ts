import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Branch, Role } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(protected databaseService: DatabaseService) {}
  async create(createBranchDto: CreateBranchDto, role: Role): Promise<Branch> {
    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ ADMIN có thể tạo chi nhánh');
    }

    return await this.databaseService.branch.create({
      data: {
        name: createBranchDto.name,
        address: createBranchDto.address,
        phone: createBranchDto.phone,
        imageUrl: createBranchDto.imageUrl,
        open_time: createBranchDto.openTime,
        close_time: createBranchDto.closeTime,
      },
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

  async update(
    id: number,
    userRole: Role,
    updateBranchDto: UpdateBranchDto,
  ): Promise<Branch> {
    if (userRole !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ ADMIN có thể tạo chi nhánh');
    }
    const branch = await this.databaseService.branch.findUnique({
      where: { id },
    });
    if (!branch)
      throw new NotFoundException(`Không tìm thấy chi nhánh với ID ${id}`);
    return this.databaseService.branch.update({
      where: { id },
      data: {
        name: updateBranchDto.name,
        address: updateBranchDto.address,
        phone: updateBranchDto.phone,
        imageUrl: updateBranchDto.imageUrl,
        open_time: updateBranchDto.openTime,
        close_time: updateBranchDto.closeTime,
      },
    });
  }

  async deleteBranch(id: number, userRole: string) {
    if (userRole !== Role.ADMIN)
      throw new ForbiddenException('Only admins can delete branches');

    const branch = await this.databaseService.branch.findUnique({
      where: { id },
    });

    if (!branch) throw new BadRequestException('Branch not found');

    return this.databaseService.branch.delete({ where: { id } });
  }
}
