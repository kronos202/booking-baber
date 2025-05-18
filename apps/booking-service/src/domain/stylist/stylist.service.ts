import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CreateStylistDto } from './dto/create-stylist.dto';
import { Role, Stylist } from '@prisma/client';
import { UpdateStylistDto } from './dto/update-stylist.dto';

@Injectable()
export class StylistService {
  constructor(protected databaseService: DatabaseService) {}

  async create(
    createStylistDto: CreateStylistDto,
    userRole: Role,
  ): Promise<Stylist> {
    if (userRole !== Role.ADMIN && userRole !== Role.BRANCH_MANAGER)
      throw new ForbiddenException(
        'Only admins and branch managers can create stylists',
      );

    // Kiểm tra branch_id tồn tại
    const branch = await this.databaseService.branch.findUnique({
      where: { id: createStylistDto.branchId },
    });
    if (!branch) {
      throw new NotFoundException(
        `Không tìm thấy chi nhánh với ID ${createStylistDto.branchId}`,
      );
    }

    return this.databaseService.stylist.create({
      data: {
        branch: { connect: { id: createStylistDto.branchId } },
        name: createStylistDto.name,
        phone: createStylistDto.phone,
      },
    });
  }

  async getStylists(branchId: number): Promise<Stylist[]> {
    return this.databaseService.stylist.findMany({
      where: { branch_id: branchId },
    });
  }

  async getStylist(branchId: number, id: number): Promise<Stylist> {
    const stylist = await this.databaseService.stylist.findUnique({
      where: { id },
    });
    if (!stylist || stylist.branch_id !== branchId)
      throw new BadRequestException('Không tìm thấy stylist');
    return stylist;
  }

  async update(
    id: number,
    userRole: Role,
    updateStylistDto: UpdateStylistDto,
  ): Promise<Stylist> {
    if (userRole !== Role.ADMIN && userRole !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException(
        'Chỉ ADMIN và MANAGER có thể cập nhật stylist',
      );
    }

    const stylist = await this.databaseService.stylist.findUnique({
      where: { id },
    });

    if (!stylist || stylist.branch_id !== updateStylistDto.branchId)
      throw new NotFoundException(`Không tìm thấy stylist với ID ${id}`);

    // Kiểm tra branch_id nếu được cung cấp
    if (updateStylistDto.branchId) {
      const branch = await this.databaseService.branch.findUnique({
        where: { id: updateStylistDto.branchId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Không tìm thấy chi nhánh với ID ${updateStylistDto.branchId}`,
        );
      }
    }

    return this.databaseService.stylist.update({
      where: { id },
      data: {
        branch: updateStylistDto.branchId
          ? { connect: { id: updateStylistDto.branchId } }
          : undefined,
        name: updateStylistDto.name,
        phone: updateStylistDto.phone,
      },
    });
  }

  async deleteStylist(
    branchId: number,
    id: number,
    userRole: Role,
  ): Promise<void> {
    if (userRole !== Role.ADMIN && userRole !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException('Chỉ ADMIN có thể xóa stylist');
    }

    const stylist = await this.databaseService.stylist.findUnique({
      where: { id },
    });

    if (!stylist) throw new BadRequestException('Không tìm thấy stylist');

    if (stylist.branch_id !== branchId)
      throw new BadRequestException('Stylist không thuộc chi nhánh này');

    await this.databaseService.stylist.delete({ where: { id } });
  }
}
