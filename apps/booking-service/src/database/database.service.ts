import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from 'generated/prisma';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppConfig } from 'src/config/app/app-config.type';
import { getAppConfig } from 'src/utils/helpers/getConfig';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit {
  constructor(configService: ConfigService<AppConfig>) {
    const config = getAppConfig(configService);
    const databaseUrl = `postgresql://${config.app.database_username}:${config.app.database_password}@${config.app.database_host}:${config.app.database_port}/${config.app.database_name}?schema=public`;
    super({
      datasources: {
        db: {
          url: `${databaseUrl}`,
        },
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Database connected successfully!.');
    // Middleware bắt lỗi P2002
    this.$use(async (params, next) => {
      try {
        return await next(params);
      } catch (error) {
        if (
          error instanceof PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const fields = (error.meta?.target as string[]).join(', ');
          throw new Error(`❌ Lỗi:: Trường ${fields} đã tồn tại.`);
        }
        throw error;
      }
    });
  }
}
