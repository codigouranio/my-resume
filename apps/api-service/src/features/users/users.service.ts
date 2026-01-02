import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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

    return this.prisma.user.update({
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
        updatedAt: true,
      },
    });
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
