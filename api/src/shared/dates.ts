import { BadRequestException } from '@nestjs/common';

/**
 * Treat incoming values as calendar dates (YYYY-MM-DD), not local datetimes.
 * ISO strings are sliced to the leading date so timezone offsets cannot shift the month.
 */
export function parseCalendarDate(value: string): Date {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  const day = match?.[1];

  if (day) {
    return new Date(`${day}T12:00:00.000Z`);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid date "${value}"`);
  }

  return new Date(`${parsed.toISOString().slice(0, 10)}T12:00:00.000Z`);
}

export function utcMonthRange(
  year: number,
  month: number,
): { $gte: Date; $lte: Date } {
  return {
    $gte: new Date(Date.UTC(year, month, 1)),
    $lte: new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)),
  };
}
