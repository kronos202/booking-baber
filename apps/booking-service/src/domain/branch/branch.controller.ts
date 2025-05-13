import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { Role } from 'generated/prisma';
import { AuthUser } from 'src/common/interfaces/user.interface';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('branch')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Post()
  async create(@Body() dto: CreateBranchDto, @CurrentUser() user: AuthUser) {
    if (user.role !== 'ADMIN') {
      throw new ForbiddenException('Only admins can create branches');
    }
    return this.branchService.createBranch(
      dto.name,
      dto.address,
      dto.phone,
      user.role as Role,
      dto.close_time,
      dto.open_time,
    );
  }

  @Get()
  async findAll() {
    return this.branchService.getBranches();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.branchService.getBranch(parseInt(id));
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.branchService.updateBranch(
      parseInt(id),
      dto.name,
      dto.address,
      dto.phone,
      user.role,
    );
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.branchService.deleteBranch(parseInt(id), user.role);
  }
}
