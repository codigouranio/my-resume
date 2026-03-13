import { Injectable } from '@nestjs/common';
import {
  LinkedInDetailedProfile,
  LinkedInPosition,
  LinkedInEducation,
  LinkedInCertification,
} from './linkedin-api.service';

/**
 * LinkedIn Parser Service
 * Transforms LinkedIn profile data into markdown resume format
 */
@Injectable()
export class LinkedInParserService {
  /**
   * Convert LinkedIn profile to markdown resume
   */
  parseToMarkdown(profile: LinkedInDetailedProfile): string {
    const sections: string[] = [];

    // Header with name and headline
    sections.push(this.formatHeader(profile));

    // Summary/About section
    if (profile.summary) {
      sections.push(this.formatSummary(profile.summary));
    }

    // Experience section
    if (profile.positions && profile.positions.length > 0) {
      sections.push(this.formatExperience(profile.positions));
    }

    // Education section
    if (profile.education && profile.education.length > 0) {
      sections.push(this.formatEducation(profile.education));
    }

    // Skills section
    if (profile.skills && profile.skills.length > 0) {
      sections.push(this.formatSkills(profile.skills));
    }

    // Certifications section
    if (profile.certifications && profile.certifications.length > 0) {
      sections.push(this.formatCertifications(profile.certifications));
    }

    // Languages section
    if (profile.languages && profile.languages.length > 0) {
      sections.push(this.formatLanguages(profile.languages));
    }

    return sections.join('\n\n');
  }

  private formatHeader(profile: LinkedInDetailedProfile): string {
    const fullName = `${profile.firstName} ${profile.lastName}`.trim();
    let header = `# ${fullName}\n`;

    if (profile.headline) {
      header += `\n*${profile.headline}*\n`;
    }

    if (profile.email) {
      header += `\n📧 ${profile.email}`;
    }

    return header;
  }

  private formatSummary(summary: string): string {
    return `## About\n\n${summary.trim()}`;
  }

  private formatExperience(positions: LinkedInPosition[]): string {
    let section = '## Experience\n';

    // Sort by start date (most recent first)
    const sortedPositions = [...positions].sort((a, b) => {
      if (a.current && !b.current) return -1;
      if (!a.current && b.current) return 1;
      return (b.startDate.year * 12 + (b.startDate.month || 0)) -
             (a.startDate.year * 12 + (a.startDate.month || 0));
    });

    sortedPositions.forEach((position) => {
      section += `\n### ${position.title}\n`;
      section += `**${position.companyName}**`;

      if (position.location) {
        section += ` | ${position.location}`;
      }

      section += `\n\n*${this.formatDateRange(position.startDate, position.endDate, position.current)}*\n`;

      if (position.description) {
        section += `\n${position.description.trim()}\n`;
      }
    });

    return section;
  }

  private formatEducation(education: LinkedInEducation[]): string {
    let section = '## Education\n';

    // Sort by end date (most recent first)
    const sortedEducation = [...education].sort((a, b) => {
      const aYear = a.endDate?.year || a.startDate?.year || 0;
      const bYear = b.endDate?.year || b.startDate?.year || 0;
      return bYear - aYear;
    });

    sortedEducation.forEach((edu) => {
      section += `\n### ${edu.schoolName}\n`;

      if (edu.degree && edu.fieldOfStudy) {
        section += `**${edu.degree}** in ${edu.fieldOfStudy}\n`;
      } else if (edu.degree) {
        section += `**${edu.degree}**\n`;
      } else if (edu.fieldOfStudy) {
        section += `**${edu.fieldOfStudy}**\n`;
      }

      if (edu.startDate || edu.endDate) {
        const startYear = edu.startDate?.year || '';
        const endYear = edu.endDate?.year || 'Present';
        section += `\n*${startYear} - ${endYear}*\n`;
      }

      if (edu.grade) {
        section += `\nGrade: ${edu.grade}\n`;
      }

      if (edu.activities) {
        section += `\n${edu.activities}\n`;
      }
    });

    return section;
  }

  private formatSkills(skills: string[]): string {
    let section = '## Skills\n\n';
    
    // Format as bullet list
    skills.forEach((skill) => {
      section += `- ${skill}\n`;
    });

    return section;
  }

  private formatCertifications(certifications: LinkedInCertification[]): string {
    let section = '## Certifications\n';

    certifications.forEach((cert) => {
      section += `\n### ${cert.name}\n`;
      section += `**${cert.authority}**\n`;

      if (cert.licenseNumber) {
        section += `\nLicense: ${cert.licenseNumber}\n`;
      }

      if (cert.url) {
        section += `\n[View Credential](${cert.url})\n`;
      }

      if (cert.startDate) {
        const issued = this.formatDate(cert.startDate);
        const expires = cert.endDate ? this.formatDate(cert.endDate) : 'No Expiration';
        section += `\n*Issued: ${issued} | Expires: ${expires}*\n`;
      }
    });

    return section;
  }

  private formatLanguages(languages: string[]): string {
    let section = '## Languages\n\n';
    
    languages.forEach((language) => {
      section += `- ${language}\n`;
    });

    return section;
  }

  private formatDateRange(
    startDate: { year: number; month?: number },
    endDate?: { year: number; month?: number },
    current?: boolean,
  ): string {
    const start = this.formatDate(startDate);
    const end = current ? 'Present' : endDate ? this.formatDate(endDate) : 'Present';
    return `${start} - ${end}`;
  }

  private formatDate(date: { year: number; month?: number }): string {
    if (date.month) {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return `${monthNames[date.month - 1]} ${date.year}`;
    }
    return date.year.toString();
  }

  /**
   * Generate a slug from the person's name
   */
  generateSlug(firstName: string, lastName: string): string {
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Remove duplicate hyphens
      .trim();
  }

  /**
   * Generate a resume title
   */
  generateTitle(firstName: string, lastName: string, headline?: string): string {
    const name = `${firstName} ${lastName}`.trim();
    if (headline) {
      return `${name} - ${headline}`;
    }
    return `${name}'s Resume`;
  }
}
