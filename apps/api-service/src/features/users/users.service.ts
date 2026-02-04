import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EmailService } from '../../shared/email/email.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    return this.prisma.user.create({
      data: createUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionTier: true,
        subscriptionEndsAt: true,
        customDomain: true,
        defaultResumeId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id); // Check if user exists

    // Check if trying to set custom domain
    if (updateUserDto.customDomain !== undefined) {
      // Only PRO users can set custom domains
      if (user.subscriptionTier !== 'PRO') {
        throw new ConflictException('Custom subdomains are only available for PRO users');
      }

      // Check if subdomain is already taken
      if (updateUserDto.customDomain) {
        const existingUser = await this.prisma.user.findUnique({
          where: { customDomain: updateUserDto.customDomain },
        });

        if (existingUser && existingUser.id !== id) {
          throw new ConflictException('This subdomain is already taken');
        }
      }
    }

    // Check if trying to set default resume
    if (updateUserDto.defaultResumeId !== undefined) {
      // Only PRO users can set default resume
      if (user.subscriptionTier !== 'PRO') {
        throw new ConflictException('Default resume is only available for PRO users');
      }

      // Verify the resume belongs to the user
      if (updateUserDto.defaultResumeId) {
        const resume = await this.prisma.resume.findFirst({
          where: {
            id: updateUserDto.defaultResumeId,
            userId: id,
          },
        });

        if (!resume) {
          throw new NotFoundException('Resume not found or does not belong to you');
        }
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        subscriptionTier: true,
        customDomain: true,
        defaultResumeId: true,
        updatedAt: true,
      },
    });

    // Send email if custom domain was set (and is new or was changed)
    if (updateUserDto.customDomain && updateUserDto.customDomain !== user.customDomain) {
      try {
        await this.emailService.sendSubdomainSetEmail(
          updatedUser.email,
          updatedUser.firstName,
          updatedUser.customDomain,
        );
      } catch (error) {
        // Log error but don't throw - domain was set successfully
        console.error(`Failed to send subdomain setup email: ${error.message}`);
      }
    }

    return updatedUser;
  }

  async remove(id: string) {
    await this.findById(id); // Check if user exists
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    if (!subdomain) {
      return false;
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { customDomain: subdomain },
    });

    return !existingUser;
  }
}
