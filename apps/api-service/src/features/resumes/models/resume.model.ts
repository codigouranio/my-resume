import { ObjectType, Field, ID, Int } from '@nestjs/graphql';

@ObjectType()
export class Template {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  preview?: string;

  @Field()
  isPremium: boolean;

  @Field()
  isActive: boolean;
}

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;
}

@ObjectType()
export class Resume {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field()
  content: string;

  @Field({ nullable: true })
  llmContext?: string;

  @Field()
  isPublic: boolean;

  @Field()
  isPublished: boolean;

  @Field({ nullable: true })
  templateId?: string;

  @Field({ nullable: true })
  theme?: string;

  @Field({ nullable: true })
  customCss?: string;

  @Field({ nullable: true })
  metaTitle?: string;

  @Field({ nullable: true })
  metaDescription?: string;

  @Field(() => Int)
  viewCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field(() => Template, { nullable: true })
  template?: Template;

  @Field(() => User, { nullable: true })
  user?: User;
}
