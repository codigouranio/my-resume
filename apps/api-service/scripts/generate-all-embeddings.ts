import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '@shared/database/prisma.service';
import { EmbeddingQueueService } from '../src/features/embeddings/embedding-queue.service';
import { EmbeddingJobType } from '../src/features/embeddings/dto/generate-embedding.dto';

async function generateAllEmbeddings() {
  console.log('🚀 Starting embedding generation for all resumes...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const embeddingQueue = app.get(EmbeddingQueueService);

  try {
    // Get all resumes
    const resumes = await prisma.resume.findMany({
      select: { 
        id: true, 
        title: true, 
        userId: true,
        embeddings: {
          select: { id: true }
        }
      },
    });

    console.log(`📊 Found ${resumes.length} total resumes\n`);

    // Filter resumes without embeddings
    const resumesWithoutEmbeddings = resumes.filter(r => !r.embeddings);
    console.log(`📝 Resumes needing embeddings: ${resumesWithoutEmbeddings.length}\n`);

    if (resumesWithoutEmbeddings.length === 0) {
      console.log('✅ All resumes already have embeddings!');
      await app.close();
      return;
    }

    // Queue embedding generation jobs
    const jobIds: string[] = [];
    for (const resume of resumesWithoutEmbeddings) {
      const jobId = await embeddingQueue.addEmbeddingJob(
        resume.id,
        EmbeddingJobType.MANUAL,
        resume.userId,
      );
      jobIds.push(jobId);
      console.log(`✓ Queued: ${resume.title || 'Untitled'} (${resume.id})`);
    }

    console.log(`\n✅ Successfully queued ${jobIds.length} embedding generation jobs`);
    console.log(`\n💡 Jobs are being processed in the background. Check progress with:`);
    console.log(`   curl http://localhost:3000/api/embeddings/queue/stats\n`);

  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    throw error;
  } finally {
    await app.close();
  }
}

generateAllEmbeddings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
