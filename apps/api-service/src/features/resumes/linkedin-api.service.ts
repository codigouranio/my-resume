import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import axios from 'axios';

/**
 * LinkedIn API Service
 * Handles OAuth 2.0 flow and profile data fetching from LinkedIn API
 */
@Injectable()
export class LinkedInApiService {
  private readonly logger = new Logger(LinkedInApiService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly authUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  private readonly tokenUrl = 'https://www.linkedin.com/oauth/v2/accessToken';
  private readonly apiBaseUrl = 'https://api.linkedin.com/v2';

  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID || '';
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET || '';
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || '';

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      this.logger.warn(
        'LinkedIn credentials not configured. Import feature will not work.',
      );
    }
  }

  /**
   * Generate LinkedIn OAuth authorization URL
   * @param state - Random state parameter for CSRF protection
   */
  getAuthorizationUrl(state: string): string {
    const scope = [
      'r_liteprofile', // Basic profile info (name, photo)
      'r_emailaddress', // Email address
      'r_organization_social', // Company pages (if needed)
    ].join(' ');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<string> {
    try {
      const response = await axios.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      return response.data.access_token;
    } catch (error) {
      this.logger.error('Failed to exchange authorization code:', error.message);
      throw new UnauthorizedException('Failed to authenticate with LinkedIn');
    }
  }

  /**
   * Fetch user's basic profile information
   */
  async getProfile(accessToken: string): Promise<LinkedInProfile> {
    try {
      // Fetch basic profile
      const profileResponse = await axios.get(`${this.apiBaseUrl}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          projection: '(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
        },
      });

      // Fetch email
      const emailResponse = await axios.get(
        `${this.apiBaseUrl}/emailAddress?q=members&projection=(elements*(handle~))`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      const profile = profileResponse.data;
      const email = emailResponse.data?.elements?.[0]?.['handle~']?.emailAddress;

      return {
        id: profile.id,
        firstName: profile.firstName?.localized?.en_US || '',
        lastName: profile.lastName?.localized?.en_US || '',
        email,
        profilePicture: this.extractProfilePicture(profile.profilePicture),
      };
    } catch (error) {
      this.logger.error('Failed to fetch LinkedIn profile:', error.message);
      throw new UnauthorizedException('Failed to fetch LinkedIn profile');
    }
  }

  /**
   * Fetch detailed profile data including positions, education, skills
   * Note: This requires additional LinkedIn API permissions that may need approval
   */
  async getDetailedProfile(accessToken: string): Promise<LinkedInDetailedProfile> {
    try {
      const basicProfile = await this.getProfile(accessToken);

      // Note: LinkedIn restricted access to many profile fields in recent years
      // For positions, education, skills - you may need:
      // 1. Apply for Marketing Developer Platform access
      // 2. Use LinkedIn Profile Scraping API (paid)
      // 3. Ask users to manually paste their LinkedIn profile URL for scraping

      this.logger.warn(
        'LinkedIn API has limited access to detailed profile data. ' +
        'Consider implementing manual profile URL scraping or asking users ' +
        'to export their profile data.',
      );

      return {
        ...basicProfile,
        headline: '',
        summary: '',
        positions: [],
        education: [],
        skills: [],
        certifications: [],
        languages: [],
      };
    } catch (error) {
      this.logger.error('Failed to fetch detailed profile:', error.message);
      throw error;
    }
  }

  private extractProfilePicture(profilePicture: any): string | undefined {
    try {
      const displayImage = profilePicture?.['displayImage~'];
      const elements = displayImage?.elements;
      if (elements && elements.length > 0) {
        // Get the largest image
        const largestImage = elements[elements.length - 1];
        return largestImage?.identifiers?.[0]?.identifier;
      }
    } catch (error) {
      this.logger.warn('Could not extract profile picture');
    }
    return undefined;
  }
}

// Type definitions
export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  profilePicture?: string;
}

export interface LinkedInDetailedProfile extends LinkedInProfile {
  headline: string;
  summary: string;
  positions: LinkedInPosition[];
  education: LinkedInEducation[];
  skills: string[];
  certifications: LinkedInCertification[];
  languages: string[];
}

export interface LinkedInPosition {
  title: string;
  companyName: string;
  location?: string;
  startDate: { year: number; month?: number };
  endDate?: { year: number; month?: number };
  description?: string;
  current: boolean;
}

export interface LinkedInEducation {
  schoolName: string;
  degree?: string;
  fieldOfStudy?: string;
  startDate?: { year: number };
  endDate?: { year: number };
  grade?: string;
  activities?: string;
}

export interface LinkedInCertification {
  name: string;
  authority: string;
  licenseNumber?: string;
  startDate?: { year: number; month?: number };
  endDate?: { year: number; month?: number };
  url?: string;
}
