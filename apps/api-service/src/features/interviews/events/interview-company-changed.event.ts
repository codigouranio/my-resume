export class InterviewCompanyChangedEvent {
  constructor(
    public readonly interviewId: string,
    public readonly userId: string,
    public readonly oldCompany: string,
    public readonly newCompany: string,
  ) {}
}
