export class BusinessRuleViolationError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BUSINESS_RULE_VIOLATION'
  ) {
    super(message);
    this.name = 'BusinessRuleViolationError';
  }
}