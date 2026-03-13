import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class LlmServiceLoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;
}

export class LlmServiceTokenResponseDto {
  accessToken: string;
  expiresIn: number; // seconds (3600 = 1 hour)
  tokenType: 'Bearer';
  issuedAt: number; // Unix timestamp
}
