import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Patch,
  ParseIntPipe,
} from '@nestjs/common';
import { StylistService } from './stylist.service';
import { AuthUser } from 'src/common/interfaces/user.interface';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { RolesGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/role.decorator';
import { RoleEnum } from 'src/common/enums/role.enum';
import { CreateStylistDto } from './dto/create-stylist.dto';
import { Stylist } from '@prisma/client';
import { UpdateStylistDto } from './dto/update-stylist.dto';

@Controller('stylist')
export class StylistController {
  constructor(private readonly stylistService: StylistService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN) // Chỉ ADMIN có thể tạo stylist
  async create(
    @Body() createStylistDto: CreateStylistDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Stylist> {
    return this.stylistService.create(createStylistDto, user.role);
  }

  @Get()
  async getStylists(@Param('branchId') branchId: string): Promise<Stylist[]> {
    return this.stylistService.getStylists(parseInt(branchId));
  }

  @Get(':id')
  async getStylist(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
  ): Promise<Stylist> {
    return await this.stylistService.getStylist(
      parseInt(branchId),
      parseInt(id),
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER) // Chỉ ADMIN có thể cập nhật stylist
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStylistDto: UpdateStylistDto,
    @CurrentUser() user: AuthUser,
  ): Promise<Stylist> {
    return this.stylistService.update(id, user.role, updateStylistDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(RoleEnum.ADMIN, RoleEnum.MANAGER) // Chỉ ADMIN có thể xóa stylist
  async deleteStylist(
    @Param('branchId', ParseIntPipe) branchId: number,
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ): Promise<void> {
    await this.stylistService.deleteStylist(branchId, id, user.role);
  }
}
