import type { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendResponse } from '@/shared/utils/sendResponse';
import { UploadService } from './uploads.service';
import type { UploadFolder } from './uploads.validation';

const folderOf = (req: Request) => (req.query as { folder: UploadFolder }).folder;

export const UploadController = {
  async uploadOne(req: Request, res: Response) {
    const data = await UploadService.uploadOne(req.file, folderOf(req));
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'File uploaded successfully',
      data,
    });
  },

  async uploadMany(req: Request, res: Response) {
    const data = await UploadService.uploadMany(req.files as Express.Multer.File[], folderOf(req));
    sendResponse(res, {
      statusCode: StatusCodes.CREATED,
      message: 'Files uploaded successfully',
      data,
    });
  },

  async remove(req: Request, res: Response) {
    await UploadService.remove(req.body.publicId);
    sendResponse(res, { message: 'File deleted successfully' });
  },
};
