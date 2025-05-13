import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { StylistService } from './stylist.service';
import { AuthUser } from 'src/common/interfaces/user.interface';
import { CurrentUser } from 'src/common/decorators/user.decorator';

@Controller('stylist')
export class StylistController {
  constructor(private readonly stylistService: StylistService) {}

  @Post()
  async create(
    @Param('branchId') branchId: string,
    @Body('name') name: string,
    @Body('phone') phone: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stylistService.createStylist(
      parseInt(branchId),
      name,
      phone,
      user.role,
    );
  }

  @Get()
  async getStylists(@Param('branchId') branchId: string) {
    return this.stylistService.getStylists(parseInt(branchId));
  }

  @Get(':id')
  async getStylist(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
  ) {
    return this.stylistService.getStylist(parseInt(branchId), parseInt(id));
  }

  @Put(':id')
  async update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('phone') phone: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stylistService.updateStylist(
      parseInt(branchId),
      parseInt(id),
      name,
      phone,
      user.role,
    );
  }

  @Delete(':id')
  async delete(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stylistService.deleteStylist(
      parseInt(branchId),
      parseInt(id),
      user.role,
    );
  }
}
