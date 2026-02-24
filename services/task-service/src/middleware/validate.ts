import { NextFunction, Response } from 'express';
import { ZodError } from 'zod';
import { VALIDATION_STRICT_MODE } from '../config/flags';

type Parser = {
  parse: (input: unknown) => unknown;
};

type ValidationShape = {
  body?: Parser;
  query?: Parser;
  params?: Parser;
};

const formatZod = (error: ZodError) => {
  return error.issues.map(issue => ({
    path: issue.path.join('.'),
    code: issue.code,
    message: issue.message,
  }));
};

export const validate =
  (shape: ValidationShape) =>
  (req: any, res: Response, next: NextFunction) => {
    try {
      if (shape.params) shape.params.parse(req.params);
      if (shape.query) shape.query.parse(req.query);
      if (shape.body) shape.body.parse(req.body);
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: formatZod(error),
        });
      }

      return next(error);
    }
  };

export const validateByMode = (
  relaxed: ValidationShape,
  strict: ValidationShape,
) => {
  return validate(VALIDATION_STRICT_MODE ? strict : relaxed);
};
