import { deleteByPublicId, uploadBuffer } from '@/lib/cloudinary';
import { AppError } from '@/shared/errors/AppError';
import type { UploadFolder } from './uploads.validation';

export const UploadService = {
  async uploadOne(file: Express.Multer.File | undefined, folder: UploadFolder) {
    if (!file) throw AppError.badRequest('No file uploaded. Send the image in the "file" field');
    return uploadBuffer(file.buffer, folder);
  },

  async uploadMany(files: Express.Multer.File[] | undefined, folder: UploadFolder) {
    if (!files?.length)
      throw AppError.badRequest('No files uploaded. Send images in the "files" field');
    return Promise.all(files.map((f) => uploadBuffer(f.buffer, folder)));
  },

  async remove(publicId: string) {
    const deleted = await deleteByPublicId(publicId);
    if (!deleted) throw AppError.notFound('File');
  },
};
