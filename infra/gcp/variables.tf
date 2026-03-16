# Project Configuration
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "storage_location" {
  description = "Location for Cloud Storage buckets (multi-region: US, EU, ASIA)"
  type        = string
  default     = "US"
}

# Database Configuration
variable "database_tier" {
  description = "Cloud SQL instance tier (db-f1-micro for sandbox, db-custom-4-32768 for production)"
  type        = string
  default     = "db-f1-micro"
}

variable "database_disk_size" {
  description = "Database disk size in GB"
  type        = number
  default     = 10
}

variable "database_availability_type" {
  description = "Database availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "database_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "resume_db"
}

variable "database_user" {
  description = "PostgreSQL database user"
  type        = string
  default     = "resumecast"
}

variable "database_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "deletion_protection" {
  description = "Enable deletion protection for Cloud SQL"
  type        = bool
  default     = true
}

# Home Network Configuration
variable "home_network_ip" {
  description = "Your home network IP (CIDR format, e.g., 1.2.3.4/32) for LLM service access to Cloud SQL"
  type        = string
}

# Redis Configuration
variable "redis_url" {
  description = "Redis connection URL (Upstash or Redis Cloud)"
  type        = string
  sensitive   = true
}

# LLM Service Configuration
variable "llm_service_url" {
  description = "URL of your home LLM service (e.g., https://llm.yourdomain.com via Cloudflare Tunnel)"
  type        = string
}

variable "llm_webhook_secret" {
  description = "Secret for authenticating LLM service webhook callbacks"
  type        = string
  sensitive   = true
}

# Application Secrets
variable "jwt_secret" {
  description = "JWT secret for authentication (min 32 characters)"
  type        = string
  sensitive   = true
}

# Frontend Configuration
variable "frontend_url" {
  description = "Frontend URL for CORS"
  type        = string
}

variable "frontend_urls" {
  description = "List of frontend URLs for CORS"
  type        = list(string)
  default     = []
}

# Cloud Run Scaling
variable "api_min_instances" {
  description = "Minimum instances for API service"
  type        = number
  default     = 0
}

variable "api_max_instances" {
  description = "Maximum instances for API service"
  type        = number
  default     = 10
}

variable "frontend_min_instances" {
  description = "Minimum instances for frontend"
  type        = number
  default     = 0
}

variable "frontend_max_instances" {
  description = "Maximum instances for frontend"
  type        = number
  default     = 10
}

# AWS Configuration (for SES email and S3 storage)
variable "aws_access_key_id" {
  description = "AWS access key ID for SES and S3"
  type        = string
  sensitive   = true
}

variable "aws_secret_access_key" {
  description = "AWS secret access key for SES and S3"
  type        = string
  sensitive   = true
}

variable "aws_region" {
  description = "AWS region for SES and S3"
  type        = string
  default     = "us-east-1"
}

variable "ses_from_email" {
  description = "Email address for sending emails via SES"
  type        = string
}
