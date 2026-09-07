
import { z } from 'zod';

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = this.constructor.name; // pour un stack trace lisible avec le bon nom de classe
    this.statusCode = statusCode;

    // nécessaire en TS quand on extend Error, sinon `instanceof` peut casser selon la target de compilation
    Object.setPrototypeOf(this, new.target.prototype);
  }
}


export function commonErrorHandler(error: unknown): { message: string; statusCode: number }
{
  if (error instanceof AppError) {
    return { message: error.message, statusCode: error.statusCode };
  }
  if (error instanceof z.ZodError) {
      const issue = error.issues[0];
      const message = issue?.message || 'Invalid request body';
      return { message, statusCode: 400 };
  }
  if (error instanceof SyntaxError) {
      return { message: 'Invalid JSON in request body', statusCode: 400 };
  }
  return { message: 'Internal server error', statusCode: 500 };
}
