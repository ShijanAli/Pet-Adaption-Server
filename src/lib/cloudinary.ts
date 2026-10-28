import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';
import { env } from '@/config/env';
import { AppError } from '@/shared/errors/AppError';

const isConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

if (isConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const ensureConfigured = () => {
  if (!isConfigured)
    throw AppError.serviceUnavailable('File upload is not configured on the server');
};

export type UploadedFile = {
  url: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

export const uploadBuffer = (buffer: Buffer, folder: string): Promise<UploadedFile> => {
  ensureConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `${env.CLOUDINARY_FOLDER}/${folder}`, resource_type: 'image' },
      (error, result?: UploadApiResponse) => {
        if (error || !result) return reject(error ?? new Error('Upload failed'));
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
};

export const deleteByPublicId = async (publicId: string) => {
  ensureConfigured();
  const result = (await cloudinary.uploader.destroy(publicId)) as { result: string };
  return result.result === 'ok';
};
