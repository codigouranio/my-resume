import { All, Controller, Inject, Next, Req, Res } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Controller('admin/queues')
export class BullBoardController {
  constructor(
    @Inject('BULL_BOARD_INSTANCE')
    private readonly serverAdapter: any,
  ) {}

  @All('*')
  admin(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    this.serverAdapter.getRouter()(req, res, next);
  }
}
