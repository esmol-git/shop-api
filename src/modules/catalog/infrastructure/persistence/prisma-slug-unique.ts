import { Prisma } from
  '../../../../generated/prisma/client.js';

const SLUG_UNIQUE_CONSTRAINT = 'products_slug_key';

export function isProductSlugUniqueViolation(
  error: unknown,
): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2002') {
    return false;
  }

  const meta = error.meta as Record<string, unknown> | undefined;
  const target = meta?.target;

  if (Array.isArray(target) && target.includes('slug')) {
    return true;
  }

  if (typeof target === 'string' && target.includes('slug')) {
    return true;
  }

  const constraint = meta?.constraint;

  if (constraint === SLUG_UNIQUE_CONSTRAINT) {
    return true;
  }

  if (
    typeof error.message === 'string'
    && error.message.includes(SLUG_UNIQUE_CONSTRAINT)
  ) {
    return true;
  }

  return false;
}
