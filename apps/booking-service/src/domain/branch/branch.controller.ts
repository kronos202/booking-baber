import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { AuthUser } from 'src/common/interfaces/user.interface';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { Branch } from '@prisma/client';
import { Roles } from 'src/common/decorators/role.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { RoleEnum } from 'src/common/enums/role.enum';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể tạo chi nhánh
  async create(
    @Body() createBranchDto: CreateBranchDto,
    @CurrentUser() user: AuthUser, // Lấy thông tin người dùng từ request
  ): Promise<Branch> {
    return this.branchService.create(createBranchDto, user.role);
  }

  @Get()
  async findAll(): Promise<Branch[]> {
    return await this.branchService.getBranches();
  }

  @Get(':id')
  async getBranch(@Param('id', ParseIntPipe) id: number): Promise<Branch> {
    return this.branchService.getBranch(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể cập nhật chi nhánh
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateBranchDto: UpdateBranchDto,
    @CurrentUser() user: AuthUser, // Lấy thông tin người dùng từ decorator
  ): Promise<Branch> {
    return this.branchService.update(id, user.role, updateBranchDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể xóa chi nhánh
  async deleteBranch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    // Chuyển đổi user.role thành string để phù hợp với định nghĩa của deleteBranch
    await this.branchService.deleteBranch(id, user.role);
  }
}
