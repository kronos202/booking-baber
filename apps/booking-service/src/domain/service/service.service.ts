import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role, Service } from '@prisma/client';
import { DatabaseService } from 'src/database/database.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServiceService {
  constructor(protected databaseService: DatabaseService) {}

  async create(
    createServiceDto: CreateServiceDto,
    role: Role,
  ): Promise<Service> {
    if (role !== Role.ADMIN) {
      throw new ForbiddenException('Chỉ ADMIN có thể tạo dịch vụ');
    }

    // Kiểm tra branch_id tồn tại
    const branch = await this.databaseService.branch.findUnique({
      where: { id: createServiceDto.branchId },
    });
    if (!branch) {
      throw new NotFoundException(
        `Không tìm thấy chi nhánh với ID ${createServiceDto.branchId}`,
      );
    }

    return this.databaseService.service.create({
      data: {
        branch: { connect: { id: createServiceDto.branchId } },
        name: createServiceDto.name,
        description: createServiceDto.description,
        price: createServiceDto.price,
        duration: createServiceDto.duration,
      },
    });
  }

  async getServices(branchId: number): Promise<Service[]> {
    return this.databaseService.service.findMany({
      where: { branch_id: branchId },
      include: { branch: true, bookings: true, reviews: true },
    });
  }

  async getService(id: number, branchId: number): Promise<Service> {
    const service = await this.databaseService.service.findUnique({
      where: { id, branch_id: branchId },
      include: { branch: true, bookings: true, reviews: true },
    });
    if (!service || service.branch_id !== branchId)
      throw new BadRequestException('Không tìm thấy dịch vụ');
    return service;
  }

  async update(
    id: number,
    userRole: Role,
    updateServiceDto: UpdateServiceDto,
  ): Promise<Service> {
    if (userRole !== Role.ADMIN && userRole !== Role.BRANCH_MANAGER) {
      throw new ForbiddenException('Chỉ ADMIN có thể cập nhật dịch vụ');
    }

    const service = await this.databaseService.service.findUnique({
      where: { id },
    });
    if (!service)
      throw new NotFoundException(`Không tìm thấy dịch vụ với ID ${id}`);

    // Kiểm tra branch_id nếu được cung cấp
    if (updateServiceDto.branchId) {
      const branch = await this.databaseService.branch.findUnique({
        where: { id: updateServiceDto.branchId },
      });
      if (!branch) {
        throw new NotFoundException(
          `Không tìm thấy chi nhánh với ID ${updateServiceDto.branchId}`,
        );
      }
    }

    return this.databaseService.service.update({
      where: { id },
      data: {
        branch: updateServiceDto.branchId
          ? { connect: { id: updateServiceDto.branchId } }
          : undefined,
        name: updateServiceDto.name,
        description: updateServiceDto.description,
        price: updateServiceDto.price,
        duration: updateServiceDto.duration,
      },
    });
  }

  async deleteService(branchId: number, id: number, userRole: string) {
    if (userRole !== 'admin' && userRole !== 'branch_manager')
      throw new ForbiddenException('Chỉ ADMIN có thể xóa dịch vụ');
    const service = await this.databaseService.service.findUnique({
      where: { id },
    });
    if (!service || service.branch_id !== branchId)
      throw new BadRequestException('Không tìm thấy dịch vụ');
    return this.databaseService.service.delete({ where: { id } });
  }
}
