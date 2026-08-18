import { Pipe, PipeTransform } from '@angular/core';

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

/**
 * Formats an ISO timestamp as a relative time ("3h ago").
 *
 * The API returns UTC-stamped ISO strings; a value that somehow arrives without a
 * timezone designator is treated as UTC rather than local, matching how the
 * backend stores these columns. Without that, JavaScript would parse a naive
 * string as local time and shift every timestamp by the viewer's UTC offset.
 */
@Pipe({ name: 'timeAgo', standalone: true, pure: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null | undefined): string {
    if (!value) {
      return '';
    }

    const date = value instanceof Date ? value : this.parse(value);
    if (!date || Number.isNaN(date.getTime())) {
      return '';
    }

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 0) {
      return 'just now';
    }
    if (seconds < MINUTE) {
      return 'just now';
    }
    if (seconds < HOUR) {
      return `${Math.floor(seconds / MINUTE)}m ago`;
    }
    if (seconds < DAY) {
      return `${Math.floor(seconds / HOUR)}h ago`;
    }
    if (seconds < WEEK) {
      return `${Math.floor(seconds / DAY)}d ago`;
    }
    if (seconds < MONTH) {
      return `${Math.floor(seconds / WEEK)}w ago`;
    }
    if (seconds < YEAR) {
      return `${Math.floor(seconds / MONTH)}mo ago`;
    }
    return `${Math.floor(seconds / YEAR)}y ago`;
  }

  private parse(value: string): Date | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    // Has an explicit zone (Z or ±HH:MM) — parse as-is.
    const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
    return new Date(hasZone ? trimmed : `${trimmed}Z`);
  }
}
