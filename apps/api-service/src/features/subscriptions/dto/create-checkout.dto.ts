import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'Stripe price ID for the subscription',
    example: 'price_1234567890',
  })
  @IsString()
  priceId: string;
}
