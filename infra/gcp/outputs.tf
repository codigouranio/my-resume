# Outputs for important resource information

output "project_id" {
  description = "GCP Project ID"
  value       = var.project_id
}

output "region" {
  description = "GCP Region"
  value       = var.region
}

# Database Outputs
output "database_instance_name" {
  description = "Cloud SQL instance name"
  value       = google_sql_database_instance.main.name
}

output "database_connection_name" {
  description = "Cloud SQL connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.main.connection_name
}

output "database_public_ip" {
  description = "Cloud SQL public IP address (for home LLM service)"
  value       = google_sql_database_instance.main.public_ip_address
}

output "database_private_ip" {
  description = "Cloud SQL private IP address (if configured)"
  value       = try(google_sql_database_instance.main.private_ip_address, "Not configured")
}

# Storage Outputs
output "uploads_bucket_name" {
  description = "Cloud Storage bucket for uploads"
  value       = google_storage_bucket.uploads.name
}

output "uploads_bucket_url" {
  description = "Cloud Storage bucket URL"
  value       = google_storage_bucket.uploads.url
}

output "frontend_assets_bucket_name" {
  description = "Cloud Storage bucket for frontend assets"
  value       = google_storage_bucket.frontend_assets.name
}

# Artifact Registry
output "artifact_registry_url" {
  description = "Artifact Registry repository URL"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}"
}

# Cloud Run Outputs
output "api_service_url" {
  description = "API Service URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "frontend_service_url" {
  description = "Frontend Service URL"
  value       = google_cloud_run_v2_service.frontend.uri
}

# Custom Domain Mappings
output "domain_mapping_dns_records" {
  description = "DNS records to configure in Cloudflare for custom domains"
  value = {
    resumecast_ai = {
      domain = "resumecast.ai"
      records = google_cloud_run_domain_mapping.frontend_main.status[0].resource_records
    }
    www_resumecast_ai = {
      domain = "www.resumecast.ai"
      records = google_cloud_run_domain_mapping.frontend_www.status[0].resource_records
    }
    api_resumecast_ai = {
      domain = "api.resumecast.ai"
      records = google_cloud_run_domain_mapping.api.status[0].resource_records
    }
  }
}

# Service Account
output "cloudrun_service_account" {
  description = "Cloud Run service account email"
  value       = google_service_account.cloudrun.email
}

# Secrets
output "secrets_created" {
  description = "List of secrets created in Secret Manager"
  value = [
    google_secret_manager_secret.jwt_secret.secret_id,
    google_secret_manager_secret.database_url.secret_id,
    google_secret_manager_secret.llm_webhook_secret.secret_id,
  ]
}

# Connection Strings
output "database_url_for_home_llm" {
  description = "Database URL for home LLM service (use this in your home .env)"
  value       = "postgresql://${google_sql_user.main.name}:${var.database_password}@${google_sql_database_instance.main.public_ip_address}:5432/${google_sql_database.main.name}"
  sensitive   = true
}

# Deployment Commands
output "docker_push_commands" {
  description = "Commands to push Docker images to Artifact Registry"
  value = {
    configure = "gcloud auth configure-docker ${var.region}-docker.pkg.dev"
    api_build = "docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/api-service:latest ./apps/api-service"
    api_push  = "docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/api-service:latest"
    frontend_build = "docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/frontend:latest ./apps/my-resume"
    frontend_push  = "docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/frontend:latest"
  }
}

output "next_steps" {
  description = "What to do after Terraform apply"
  sensitive   = true
  value = <<-EOT
    
    ✅ Infrastructure deployed successfully!
    
    Next steps:
    
    1. Build and push Docker images:
       gcloud auth configure-docker ${var.region}-docker.pkg.dev
       
       cd ../..
       docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/api-service:latest -f apps/api-service/Dockerfile .
       docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/api-service:latest
       
       docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/frontend:latest -f apps/my-resume/Dockerfile .
       docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/frontend:latest
       
    2. Database migrations:
       ✅ Prisma migrations are automatically applied during terraform apply
       
    3. Configure home LLM service .env:
       DATABASE_URL=postgresql://${google_sql_user.main.name}:${var.database_password}@${google_sql_database_instance.main.public_ip_address}:5432/${google_sql_database.main.name}
       API_SERVICE_URL=${google_cloud_run_v2_service.api.uri}
       
    4. Access your services:
       - API: ${google_cloud_run_v2_service.api.uri}
       - Frontend: ${google_cloud_run_v2_service.frontend.uri}
       
    5. Setup custom domain (optional):
       - Go to Cloud Run console
       - Add custom domain mapping
       - Update DNS records
  EOT
}
