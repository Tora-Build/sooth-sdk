/** An error whose message is already plain and safe to show as is. */
export class TradeMessageError extends Error {
  /** Raw text for a details disclosure, when a read or send failed under the plain message. */
  readonly detail: string | null;
  constructor(message: string, detail: string | null = null) {
    super(message);
    this.name = 'TradeMessageError';
    this.detail = detail;
  }
}
