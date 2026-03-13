import * as bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureUser(params: {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}) {
  const passwordHash = await bcrypt.hash(params.password, 10);

  return prisma.user.upsert({
    where: { email: params.email },
    create: {
      email: params.email,
      password: passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
    },
    update: {
      password: passwordHash,
      firstName: params.firstName,
      lastName: params.lastName,
    },
  });
}

async function ensureResume(params: {
  userId: string;
  slug: string;
  title: string;
  content: string;
  llmContext?: string;
  isPublic?: boolean;
  isPublished?: boolean;
}) {
  return prisma.resume.upsert({
    where: { slug: params.slug },
    create: {
      userId: params.userId,
      slug: params.slug,
      title: params.title,
      content: params.content,
      llmContext: params.llmContext,
      isPublic: params.isPublic ?? true,
      isPublished: params.isPublished ?? true,
    },
    update: {
      title: params.title,
      content: params.content,
      llmContext: params.llmContext,
      isPublic: params.isPublic ?? true,
      isPublished: params.isPublished ?? true,
    },
  });
}

async function main() {
  const llm_service = await ensureUser({
    email: "llm-service@resumecast.ai", 
    password: "p@@@@@ssw0rd", 
    firstName: "llm",
    lastName: "service" 
  });

  const jose = await ensureUser({
    email: "jose@example.com",
    password: "password123",
    firstName: "Jose",
    lastName: "Blanco",
  });

  const jane = await ensureUser({
    email: "jane@example.com",
    password: "password123",
    firstName: "Jane",
    lastName: "Doe",
  });

  const joseResume = await ensureResume({
    userId: jose.id,
    slug: "jose-blanco-swe",
    title: "Jose Blanco - Software Engineer",
    content: `# Jose Blanco\n\n## Summary\nSenior Software Engineer focused on backend systems, AI integration, and scalable platforms.\n\n## Experience\n- Built API services with NestJS + PostgreSQL\n- Integrated LLM services with vLLM and Ollama\n- Delivered cloud deployments with Docker and Ansible\n\n## Skills\n- TypeScript, Python, PostgreSQL, Redis\n- AWS, Docker, Kubernetes\n- AI: vLLM, OpenAI-compatible APIs\n`,
    llmContext: `### Hidden Context\n- Led migration to vLLM for 5-10x throughput\n- Implemented recruiter conversation isolation with conversationId\n- Optimized prompt guidance for third-person recruiter interactions\n`,
  });

  const janeResume = await ensureResume({
    userId: jane.id,
    slug: "jane-doe-product",
    title: "Jane Doe - Product Manager",
    content: `# Jane Doe\n\n## Summary\nProduct manager with focus on B2B SaaS and growth experimentation.\n\n## Experience\n- Owned roadmap for analytics platform\n- Led cross-functional teams\n\n## Skills\n- Product strategy, user research, GTM\n- SQL, Mixpanel, A/B testing\n`,
    llmContext: `### Hidden Context\n- Increased activation by 18% through onboarding experiments\n- Managed $1.2M annual budget\n`,
  });

  await prisma.user.update({
    where: { id: jose.id },
    data: { defaultResumeId: joseResume.id },
  });

  await prisma.user.update({
    where: { id: jane.id },
    data: { defaultResumeId: janeResume.id },
  });

  // Seed AI Context Journal Posts
  const josePost1 = await prisma.journalPost.create({
    data: {
      userId: jose.id,
      text: "Presented the new vLLM infrastructure migration to the team today. Got great feedback and approval to proceed with phase 2. The 5-10x throughput improvement is exactly what we need for scaling.",
      includeInAI: true,
      publishedAt: new Date("2026-02-28"),
    },
  });

  const josePost2 = await prisma.journalPost.create({
    data: {
      userId: jose.id,
      text: "Implemented the recruiter conversation isolation feature with conversationId. This will help us track and analyze individual recruiter interactions more effectively. Testing looks good so far.",
      includeInAI: true,
      publishedAt: new Date("2026-02-27"),
    },
  });

  const josePost3 = await prisma.journalPost.create({
    data: {
      userId: jose.id,
      text: "Had a great week - closed 2 enterprise deals and the product roadmap alignment meeting went smoothly. Team morale is high and we're on track for Q1 targets.",
      includeInAI: true,
      publishedAt: new Date("2026-02-25"),
    },
  });

  const janePost1 = await prisma.journalPost.create({
    data: {
      userId: jane.id,
      text: "Onboarding experiment results are in - we achieved 18% activation lift! This validates our hypothesis about the intuitive dashboard design. Rolling out to all new users next week.",
      includeInAI: true,
      publishedAt: new Date("2026-02-28"),
    },
  });

  const janePost2 = await prisma.journalPost.create({
    data: {
      userId: jane.id,
      text: "Led product strategy workshop with leadership. Aligned on 2026 roadmap priorities and got budget approval for Q2 initiatives. Excited about the growth experiments we're planning.",
      includeInAI: true,
      publishedAt: new Date("2026-02-26"),
    },
  });

  // Add reactions to posts
  await prisma.journalPostReaction.create({
    data: {
      postId: josePost1.id,
      reactionType: "FIRE",
    },
  });

  await prisma.journalPostReaction.create({
    data: {
      postId: josePost2.id,
      reactionType: "THUMBSUP",
    },
  });

  // Add reply to post
  await prisma.journalPostReply.create({
    data: {
      postId: josePost1.id,
      text: "Follow-up thought: Should also document the load testing results for the vLLM setup to share with stakeholders.",
    },
  });

  // Tag posts to resumes
  await prisma.postResumeTag.create({
    data: {
      postId: josePost1.id,
      resumeId: joseResume.id,
    },
  });

  await prisma.postResumeTag.create({
    data: {
      postId: janePost1.id,
      resumeId: janeResume.id,
    },
  });

  console.log("Seed complete:");
  console.log(`- Users: ${jose.email}, ${jane.email}`);
  console.log(`- Resumes: ${joseResume.slug}, ${janeResume.slug}`);
  console.log(`- Journal Posts: ${[josePost1.id, josePost2.id, josePost3.id, janePost1.id, janePost2.id].length} total`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
