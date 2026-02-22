import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { EmailService } from "@shared/email/email.service";
import { Request, Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Public } from "../auth/decorators/public.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateRecruiterInterestDto } from "./dto/create-recruiter-interest.dto";
import { CreateResumeDto } from "./dto/create-resume.dto";
import { TestRecruiterInterestEmailDto } from "./dto/test-recruiter-interest-email.dto";
import { UpdateResumeDto } from "./dto/update-resume.dto";
import { ResumesService } from "./resumes.service";

@ApiTags("resumes")
@Controller("resumes")
export class ResumesController {
  constructor(
    private readonly resumesService: ResumesService,
    private readonly emailService: EmailService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Create a new resume" })
  create(@CurrentUser() user: any, @Body() createResumeDto: CreateResumeDto) {
    return this.resumesService.create(user.id, createResumeDto);
  }

  @Get("identify-slug")
  @ApiOperation({ summary: "Identify slug" })
  async identifySlug(
    @Headers("X-Referer-URL") referer: string,
    @Req() req: Request,
  ): Promise<any> {
    return this.resumesService.identifySlug(referer);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get all resumes for current user" })
  findAll(@CurrentUser() user: any) {
    return this.resumesService.findAll(user.id);
  }

  @Get("public/:slug")
  @Public()
  @ApiOperation({ summary: "Get public resume by slug" })
  findBySlug(
    @Param("slug") slug: string,
    @Query("view") view?: string,
    @Req() req?: any,
  ) {
    const viewData =
      view === "true"
        ? {
            ipAddress: req?.ip || req?.connection?.remoteAddress,
            userAgent: req?.headers?.["user-agent"],
            referrer: req?.headers?.["referer"] || req?.headers?.["referrer"],
            country: req?.headers?.["cf-ipcountry"],
            city: req?.headers?.["cf-ipcity"],
          }
        : undefined;

    return this.resumesService.findBySlug(slug, view === "true", viewData);
  }

  @Get("public/:slug/pdf")
  @Public()
  @ApiOperation({ summary: "Generate PDF for public resume" })
  async generatePdf(@Param("slug") slug: string, @Res() res: Response) {
    return this.resumesService.generatePdf(slug, res);
  }

  @Get("public/:slug/stats")
  @Public()
  @ApiOperation({ summary: "Get public resume view statistics" })
  async getPublicStats(@Param("slug") slug: string) {
    return this.resumesService.getPublicStats(slug);
  }

  @Get("by-domain/:domain")
  @Public()
  @ApiOperation({ summary: "Get resume by custom domain" })
  findByDomain(
    @Param("domain") domain: string,
    @Query("view") view?: string,
    @Req() req?: any,
  ) {
    const viewData =
      view === "true"
        ? {
            ipAddress: req?.ip || req?.connection?.remoteAddress,
            userAgent: req?.headers?.["user-agent"],
            referrer: req?.headers?.["referer"] || req?.headers?.["referrer"],
            country: req?.headers?.["cf-ipcountry"],
            city: req?.headers?.["cf-ipcity"],
          }
        : undefined;

    return this.resumesService.findByCustomDomain(
      domain,
      view === "true",
      viewData,
    );
  }

  @Get("llm/:slug")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get resume with full context for LLM",
    description:
      "Returns resume including hidden llmContext field for AI processing",
  })
  getForLLM(@Param("slug") slug: string) {
    return this.resumesService.getResumeForLLM(slug);
  }

  @Get(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get resume by ID" })
  findOne(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.findOne(id, user.id);
  }

  @Patch(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Update resume" })
  update(
    @Param("id") id: string,
    @CurrentUser() user: any,
    @Body() updateResumeDto: UpdateResumeDto,
  ) {
    return this.resumesService.update(id, user.id, updateResumeDto);
  }

  @Delete(":id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Delete resume" })
  remove(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.remove(id, user.id);
  }

  @Post("recruiter-interest")
  @Public()
  @ApiOperation({ summary: "Submit recruiter interest for a resume" })
  submitRecruiterInterest(@Body() dto: CreateRecruiterInterestDto) {
    return this.resumesService.createRecruiterInterest(dto);
  }

  @Post("recruiter-interest/test-email")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Send a test recruiter interest email" })
  async sendRecruiterInterestTestEmail(
    @Body() dto: TestRecruiterInterestEmailDto,
  ) {
    try {
      await this.emailService.sendRecruiterInterestEmail(
        dto.email,
        dto.firstName,
        dto.recruiterName,
        dto.company ?? "Company",
        dto.message,
        dto.resumeTitle,
      );
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error?.message ?? "Failed to send test email",
      };
    }
  }

  @Get("recruiter-interest/my-interests")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: "Get all recruiter interests for current user resumes",
  })
  getMyRecruiterInterests(@CurrentUser() user: any) {
    return this.resumesService.getRecruiterInterests(user.id);
  }

  @Patch("recruiter-interest/:id/read")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Mark recruiter interest as read" })
  markInterestAsRead(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.markInterestAsRead(id, user.id);
  }

  @Delete("recruiter-interest/:id")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Soft delete recruiter interest" })
  deleteRecruiterInterest(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.deleteInterest(id, user.id);
  }

  @Patch("recruiter-interest/:id/favorite")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Toggle recruiter interest favorite status" })
  toggleFavorite(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.toggleFavorite(id, user.id);
  }

  @Get(":id/analytics")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get resume analytics and view statistics" })
  getAnalytics(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.getResumeAnalytics(id, user.id);
  }

  @Get(":id/analytics/detailed")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Get detailed analytics (PRO tier only)" })
  getDetailedAnalytics(@Param("id") id: string, @CurrentUser() user: any) {
    return this.resumesService.getDetailedAnalytics(id, user.id);
  }

  @Post("improve-text")
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "Improve text using AI (proxied to LLM service)" })
  async improveText(@Body() body: { text: string; context?: string }) {
    return this.resumesService.improveText(body.text, body.context);
  }
}
