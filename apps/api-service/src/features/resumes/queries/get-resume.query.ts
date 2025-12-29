export class GetResumeQuery {
  constructor(
    public readonly id: string,
    public readonly userId?: string,
  ) {}
}
