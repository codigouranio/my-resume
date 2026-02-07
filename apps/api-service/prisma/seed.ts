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

  console.log("Seed complete:");
  console.log(`- Users: ${jose.email}, ${jane.email}`);
  console.log(`- Resumes: ${joseResume.slug}, ${janeResume.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
