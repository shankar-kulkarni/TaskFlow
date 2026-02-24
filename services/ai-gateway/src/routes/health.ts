import type { Request, Response } from 'express';

export const healthHandler = async (_req: Request, res: Response): Promise<void> => {
  res.status(200).json({
    status: 'ok',
    provider: process.env.AI_PROVIDER ?? 'ollama',
    mode: 'embedding-first',
  });
};
