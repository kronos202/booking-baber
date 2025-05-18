import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ServiceService } from './service.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { AuthUser } from 'src/common/interfaces/user.interface';
import { RolesGuard } from 'src/common/guards/role.guard';
import { RoleEnum } from 'src/common/enums/role.enum';
import { Roles } from 'src/common/decorators/role.decorator';
import { CreateServiceDto } from './dto/create-service.dto';
import { Service } from '@prisma/client';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể tạo dịch vụ
  async create(
    @Body() createServiceDto: CreateServiceDto,
    @CurrentUser() user: AuthUser, // Lấy thông tin người dùng từ request
  ): Promise<Service> {
    return this.serviceService.create(createServiceDto, user.role);
  }

  @Get()
  async getServices(@Param('branchId') branchId: string): Promise<Service[]> {
    return this.serviceService.getServices(parseInt(branchId));
  }

  @Get(':id')
  async getService(
    @Param('branchId', ParseIntPipe) branchId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.serviceService.getService(id, branchId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể cập nhật dịch vụ
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateServiceDto: UpdateServiceDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Service> {
    return this.serviceService.update(id, user.role, updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể xóa dịch vụ
  async deleteService(
    @Param('id', ParseIntPipe) id: number,
    @Param('branchId', ParseIntPipe) branchId: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.serviceService.deleteService(branchId, id, user.role);
  }
}
