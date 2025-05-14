import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { UserService } from '../user/user.service';
import { AuthRegisterLoginDto } from './dto/auth-register-login.dto';
import { JwtService } from '@nestjs/jwt';
import dayjs from 'dayjs';
import { getAuthConfig, getTemplateConfig } from 'src/utils/helpers/getConfig';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from 'src/config/auth/auth-config.types';
import { Session, User } from 'generated/prisma';
import { DatabaseService } from 'src/database/database.service';
import { TemplateConfig } from 'src/config/template/template.type';
import { AuthEmailLoginDto } from './dto/auth-email-login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { EncryptHelper } from 'src/utils/helpers/encrypt.helper';
import { SessionsService } from '../sessions/sessions.service';
import { JwtRefreshPayloadType } from './strategy/types/jwt-refresh-payload.type';
import { mapUserToDto } from '../user/mapper/userToDto.mapper';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { TokenResponseDto } from './dto/token-response.dto';
import { NullableType } from 'src/utils/types/nullable';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { AuthUser } from 'src/common/interfaces/user.interface';
import ms from 'ms';
import { google } from 'googleapis';
@Injectable()
export class AuthService {
  private readonly templateConfig: TemplateConfig;
  private readonly authConfig: AuthConfig;
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly userService: UserService,
    protected databaseService: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionsService,
    private readonly authConfigService: ConfigService<AuthConfig>,
    private readonly templateConfigService: ConfigService<TemplateConfig>,
    private readonly configService: ConfigService,
    @InjectQueue('email-queue') private readonly emailQueue: Queue,
  ) {
    this.authConfig = getAuthConfig(this.authConfigService);
    this.templateConfig = getTemplateConfig(this.templateConfigService);
  }

  async register(dto: AuthRegisterLoginDto): Promise<void> {
    const { email, password, username, firstName, lastName, phone } = dto;
    const hashedPassword = EncryptHelper.hash(password);

    const user = await this.databaseService.user.create({
      data: {
        email,
        password: hashedPassword,
        username,
        firstName,
        lastName,
        role: 'CUSTOMER',
        phone,
      },
    });

    const hash = await this.jwtService.signAsync(
      {
        confirmEmailUserId: user.id,
      },
      {
        secret: this.authConfig.confirm_email_secret,
        expiresIn: this.authConfig.confirm_email_expires,
      },
    );

    try {
      await this.emailQueue.add('registration-job', {
        email: user.email,
        activation_email_template_id:
          this.templateConfig.activation_email_template_id,
        username: user.username,
        verification_link: hash,
      });
    } catch (error) {
      console.log(error);
    }
  }

  async confirmEmail(hash: string): Promise<void> {
    let userId: User['id'];

    try {
      const payload = await this.jwtService.verifyAsync<{
        confirmEmailUserId: User['id'];
      }>(hash, {
        secret: this.authConfig.confirm_email_secret,
      });

      userId = payload.confirmEmailUserId;
    } catch {
      throw new UnprocessableEntityException({ message: 'invalid hash' });
    }

    const user = await this.userService.findOneOrFail(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.active) {
      throw new BadRequestException('User already activated');
    }

    await this.userService.activateUser(user.id);
  }

  async login(authEmailLoginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.userService.findOneOrFailByEmailWithRoles(
      authEmailLoginDto.email,
    );

    if (!user.password) {
      throw new UnprocessableEntityException(
        'Có lỗi xảy ra khi đăng nhập. Hãy kiểm tra lại tài khoản hoặc mật khẩu.',
      );
    }

    const isValid = this.isPasswordValid(
      authEmailLoginDto.password,
      user.password,
    );

    if (!isValid) {
      throw new UnprocessableEntityException(
        'Có lỗi xảy ra khi đăng nhập. Hãy kiểm tra lại tài khoản hoặc mật khẩu.',
      );
    }

    const sessionHash = EncryptHelper.genSha256();

    const session = await this.sessionService.create({
      userId: user.id,
      hash: sessionHash,
    });

    console.log('sessionHash: ', sessionHash);

    // Lấy roles của người dùng
    const role = user.role; // Lấy các vai trò của người dùng

    console.log('roles: ', role);

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      sessionId: session.id,
      hash: sessionHash,
      role,
    });
    return {
      refreshToken,
      token,
      tokenExpires,

      user: mapUserToDto(user),
    };
  }

  private async getTokensData(data: {
    id: User['id'];
    sessionId: Session['id'];
    hash: Session['hash'];
    role: string;
  }): Promise<TokenResponseDto> {
    const tokenExpiresIn = this.authConfig.access_expires_time;
    const refreshExpiresIn = this.authConfig.refresh_expires_time;

    const tokenExpiresInMs = ms(tokenExpiresIn as ms.StringValue);

    const refreshExpiresInMS = ms(refreshExpiresIn as ms.StringValue);

    const tokenExpires = dayjs().add(tokenExpiresInMs).valueOf();
    const refreshTokenExpires = dayjs().add(refreshExpiresInMS).valueOf();

    console.log('tokenExpires', tokenExpires);
    console.log('refreshTokenExpires', refreshTokenExpires);

    const [token, refreshToken] = await Promise.all([
      await this.jwtService.signAsync(
        {
          id: data.id,
          sessionId: data.sessionId,
          role: data.role,
        },
        {
          secret: this.authConfig.access_secret_key,
          expiresIn: tokenExpiresIn,
        },
      ),
      await this.jwtService.signAsync(
        {
          sessionId: data.sessionId,
          hash: data.hash,
        },
        {
          secret: this.authConfig.refresh_secret_key,
          expiresIn: refreshTokenExpires,
        },
      ),
    ]);

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<NullableType<User>> {
    const user = await this.userService.findOneOrFailByEmail(email);
    const isMatch = this.isPasswordValid(password, user.password);

    if (!isMatch) {
      throw new UnprocessableEntityException(
        'Có lỗi xảy ra khi đăng nhập. Hãy kiểm tra lại tài khoản hoặc mật khẩu',
      );
    }
    return user;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.userService.findOneOrFailByEmail(email);

    const tokenExpiresIn = this.authConfig.forgot_password_expires;

    const tokenExpires = dayjs().add(Number(tokenExpiresIn), 'ms').valueOf();

    const hash = await this.jwtService.signAsync(
      {
        forgotUserId: user.id,
      },
      {
        secret: this.authConfig.forgot_password_secret,
        expiresIn: tokenExpiresIn,
      },
    );
    console.log('hash', hash);

    try {
      await this.emailQueue.add('password-reset-job', {
        email: user.email,
        reset_password_template_id:
          this.templateConfig.reset_password_template_id,
        username: user.username,
        forgot_link: hash,
        expires_in: dayjs(tokenExpires).format('HH:mm DD/MM/YYYY'),
      });
    } catch (error) {
      console.log(error);
      console.log('xảy ra lỗi ở queue');
    }
  }

  async resetPassword(hash: string, password: string): Promise<void> {
    let userId: User['id'];
    console.log('hash', hash);
    console.log('password', password);

    try {
      const jwtData = await this.jwtService.verifyAsync<{
        forgotUserId: User['id'];
      }>(hash, {
        secret: this.authConfig.forgot_password_secret,
      });

      userId = jwtData.forgotUserId;
    } catch {
      console.log('invalid hash');

      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: {
          hash: `invalidHash`,
        },
      });
    }

    const user = await this.userService.findOrFailById({ id: userId });

    user.password = password;

    await this.sessionService.deleteAllSessionsByUserId(user.id);

    await this.userService.updateForgotPassword(user.id, user);
  }

  async refreshToken(
    data: Pick<JwtRefreshPayloadType, 'sessionId' | 'hash'>,
  ): Promise<TokenResponseDto> {
    console.log('data: ', data);

    const session = await this.sessionService.findSessionById(data.sessionId);
    console.log('session: ', session);

    if (!session) {
      throw new UnauthorizedException('session not found');
    }

    console.log('hash: ', data.hash);
    console.log('session.hash: ', session.hash);

    if (session.hash !== data.hash) {
      throw new UnauthorizedException('invalid data hash');
    }

    const hash = EncryptHelper.genSha256();

    await this.sessionService.updateSession(session.id, {
      hash,
    });

    const user = await this.userService.findById({
      id: session.userId,
    });

    console.log('user: ', user.roles);

    const role = user.role; // Lấy các vai trò của người dùng

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.userId,
      sessionId: session.id,
      hash,
      role,
    });

    return {
      token,
      refreshToken,
      tokenExpires,
    };
  }

  async me(userJwtPayload: AuthUser): Promise<UserResponseDto> {
    const user = await this.databaseService.user.findFirst({
      where: {
        id: userJwtPayload.id,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return mapUserToDto(user);
  }

  async logout(data: Pick<JwtRefreshPayloadType, 'sessionId'>): Promise<void> {
    if (!data.sessionId) {
      throw new BadRequestException('Session id is required');
    }
    return this.sessionService.deleteById(data.sessionId);
  }

  // Phương thức riêng để kiểm tra mật khẩu hợp lệ
  private isPasswordValid(
    password: string,
    storedPassword: string | null,
  ): boolean {
    if (!storedPassword) {
      throw new UnprocessableEntityException('Tài khoản không tồn tại.');
    }
    return EncryptHelper.compare(password, storedPassword);
  }

  async refreshGoogleAccessToken(userId: number): Promise<string> {
    this.logger.log(`Làm mới access token Google cho người dùng ${userId}`);

    // Lấy thông tin credential từ database
    const credential = await this.databaseService.credential.findFirst({
      where: {
        user_id: userId,
        integration_type: 'GOOGLE',
      },
    });

    if (!credential || !credential.refresh_token) {
      this.logger.error(
        `Không tìm thấy refresh token cho người dùng ${userId}`,
      );
      throw new UnauthorizedException('Không tìm thấy refresh token');
    }

    // Khởi tạo OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_REDIRECT_URI'),
    );

    // Đặt refresh token cho client
    oauth2Client.setCredentials({
      refresh_token: credential.refresh_token,
    });

    try {
      // Yêu cầu access token mới
      const { credentials } = await oauth2Client.refreshAccessToken();
      const newAccessToken = credentials.access_token;

      if (!newAccessToken) {
        this.logger.error(
          `Không thể làm mới access token cho người dùng ${userId}`,
        );
        throw new UnauthorizedException('Không thể làm mới access token');
      }

      // Cập nhật access token mới vào database
      await this.databaseService.credential.update({
        where: { id: credential.id },
        data: {
          token: newAccessToken,
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Làm mới access token thành công cho người dùng ${userId}`,
      );
      return newAccessToken;
    } catch (error) {
      this.logger.error(`Lỗi khi làm mới access token: ${error.message}`);
      throw new UnauthorizedException(
        `Lỗi khi làm mới access token: ${error.message}`,
      );
    }
  }
}
