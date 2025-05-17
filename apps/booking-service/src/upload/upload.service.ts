import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryResponse } from 'src/utils/types/cloudinary-response';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ImageType, StorageType } from '@prisma/client';

@Injectable()
export class UploadService {
  constructor(
    private readonly database: DatabaseService,
    private readonly cloudinary: CloudinaryProvider,
  ) {}

  /**
   * Upload một mảng ảnh
   * @param files - Mảng file ảnh
   * @param storageType - Kiểu lưu trữ (LOCAL hoặc CLOUDINARY)
   * @param userId - ID của người dùng
   * @param messageId - ID tin nhắn (optional)
   * @returns Danh sách các ảnh đã upload và lưu vào DB
   */
  async upload(
    files: Express.Multer.File[], // Nhận mảng các file ảnh
    storageType: StorageType,
    userId: number,
    branchId?: number,
  ): Promise<any[]> {
    const uploadPromises = files.map((file) => {
      if (storageType === StorageType.LOCAL) {
        return this.uploadLocal(file, userId, branchId);
      } else if (storageType === StorageType.CLOUDINARY) {
        return this.uploadToCloudinary(file, userId, branchId);
      } else {
        throw new Error('Invalid storage type');
      }
    });

    // Chờ tất cả các ảnh được upload xong và trả về kết quả
    return await Promise.all(uploadPromises);
  }

  private async uploadLocal(
    file: Express.Multer.File,
    userId: number,
    branchId?: number,
  ): Promise<any> {
    const uploadDir = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'uploads',
    );

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileExt = path.extname(file.originalname);
    const fileName = `${uuidv4()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);

    fs.writeFileSync(filePath, file.buffer);

    const imageData = await this.database.image.create({
      data: {
        imageUrl: `/uploads/${fileName}`,
        cloudinaryId: null,
        userId: userId,
        storageType: StorageType.LOCAL,
        type: branchId ? ImageType.OTHER : ImageType.AVATAR, // Sử dụng enum ImageType
        createdAt: new Date(),
      },
    });

    return imageData;
  }

  private async uploadToCloudinary(
    file: Express.Multer.File,
    userId: number,
    branchId?: number,
  ): Promise<any> {
    const cloudinary = this.cloudinary.getInstance();

    const result = await new Promise<CloudinaryResponse>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'chat-app/images', resource_type: 'image' },
        (error, result) => {
          if (error)
            return reject(new Error('Upload failed: ' + error.message));
          if (!result)
            return reject(new Error('Upload failed: result is undefined'));
          resolve(result);
        },
      );
      uploadStream.end(file.buffer);
    });

    const imageData = await this.database.image.create({
      data: {
        imageUrl: result.secure_url,
        cloudinaryId: result.public_id,
        userId: userId,
        storageType: StorageType.CLOUDINARY,
        type: branchId ? ImageType.OTHER : ImageType.AVATAR, // Sử dụng enum ImageType
        createdAt: new Date(),
      },
    });

    return imageData;
  }
}
