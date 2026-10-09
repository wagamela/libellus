export interface Formatter {
  /** Detect if content is valid for this formatter. */
  canFormat(content: string): boolean;

  /** Check if content is already formatted according to this formatter's rules. */
  isFormatted(content: string): boolean;

  /** Format the content according to this formatter's rules. */
  format(content: string): string;
}
