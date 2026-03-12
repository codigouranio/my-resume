export class InterviewCreatedEvent {
  constructor(
    public readonly interviewId: string,
    public readonly userId: string,
    public readonly company: string,
    public readonly position: string,
  ) {}
}
