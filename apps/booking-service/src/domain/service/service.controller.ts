import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
} from '@nestjs/common';
import { ServiceService } from './service.service';
import { CurrentUser } from 'src/common/decorators/user.decorator';
import { AuthUser } from 'src/common/interfaces/user.interface';

@Controller('service')
export class ServiceController {
  constructor(private readonly serviceService: ServiceService) {}

  @Post()
  async create(
    @Param('branchId') branchId: string,
    @Body('name') name: string,
    @Body('price') price: number,
    @Body('duration') duration: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.serviceService.createService(
      parseInt(branchId),
      name,
      price,
      duration,
      user.role,
    );
  }

  @Get()
  async getServices(@Param('branchId') branchId: string) {
    return this.serviceService.getServices(parseInt(branchId));
  }

  @Get(':id')
  async getService(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
  ) {
    return this.serviceService.getService(parseInt(branchId), parseInt(id));
  }

  @Put(':id')
  async update(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @Body('name') name: string,
    @Body('price') price: number,
    @Body('duration') duration: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.serviceService.updateService(
      parseInt(branchId),
      parseInt(id),
      name,
      price,
      duration,
      user.role,
    );
  }

  @Delete(':id')
  async delete(
    @Param('branchId') branchId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.serviceService.deleteService(
      parseInt(branchId),
      parseInt(id),
      user.role,
    );
  }
}
