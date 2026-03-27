# Google Cloud Platform Infrastructure for ResumeCast AI
# Terraform configuration for hybrid cloud deployment
# Frontend + API on GCP Cloud Run, LLM service at home

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state (recommended for production)
  # backend "gcs" {
  #   bucket = "resumecast-terraform-state"
  #   prefix = "terraform/state"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "sql-component.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  service            = each.key
  disable_on_destroy = false
}

# Random suffix for globally unique names
resource "random_id" "suffix" {
  byte_length = 4
}

# Cloud SQL Instance (PostgreSQL)
resource "google_sql_database_instance" "main" {
  name             = "resumecast-db-${random_id.suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier              = var.database_tier
    disk_size         = var.database_disk_size
    availability_type = var.database_availability_type

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled = true

      # Authorize home network for LLM service access
      authorized_networks {
        name  = "home-llm-service"
        value = var.home_network_ip
      }

      # Enable private IP for Cloud Run if needed
      # private_network = google_compute_network.main.id
    }

    database_flags {
      name  = "max_connections"
      value = "100"
    }
  }

  deletion_protection = var.deletion_protection

  depends_on = [google_project_service.required_apis]
}

# Database
resource "google_sql_database" "main" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
}

# Database user
resource "google_sql_user" "main" {
  name     = var.database_user
  instance = google_sql_database_instance.main.name
  password = var.database_password
}

# Run Prisma migrations after database is ready
resource "null_resource" "prisma_migrations" {
  # Re-run migrations when database changes or when forced
  triggers = {
    database_instance = google_sql_database_instance.main.id
    database_name     = google_sql_database.main.name
    database_user     = google_sql_user.main.name
  }

  provisioner "local-exec" {
    command     = "cd ../../apps/api-service && npx prisma migrate deploy"
    working_dir = path.module
    environment = {
      DATABASE_URL = "postgresql://${google_sql_user.main.name}:${urlencode(var.database_password)}@${google_sql_database_instance.main.public_ip_address}:5432/${google_sql_database.main.name}"
    }
  }

  depends_on = [
    google_sql_database.main,
    google_sql_user.main,
    google_sql_database_instance.main
  ]
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "resumecast-images"
  description   = "Docker images for ResumeCast AI"
  format        = "DOCKER"

  depends_on = [google_project_service.required_apis]
}

# Cloud Storage bucket for uploads (resume PDFs, attachments)
resource "google_storage_bucket" "uploads" {
  name          = "${var.project_id}-uploads-${random_id.suffix.hex}"
  location      = var.storage_location
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = var.frontend_urls
    method          = ["GET", "HEAD", "PUT", "POST"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }
}

# Cloud Storage bucket for frontend static assets
resource "google_storage_bucket" "frontend_assets" {
  name          = "${var.project_id}-frontend-${random_id.suffix.hex}"
  location      = var.storage_location
  force_destroy = false

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }
}

# Make frontend bucket publicly readable
resource "google_storage_bucket_iam_member" "frontend_public" {
  bucket = google_storage_bucket.frontend_assets.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Service account for Cloud Run services
resource "google_service_account" "cloudrun" {
  account_id   = "cloudrun-sa"
  display_name = "Cloud Run Service Account"
  description  = "Service account for Cloud Run API and frontend"
}

# Grant Cloud Run SA access to Cloud SQL
resource "google_project_iam_member" "cloudrun_sql" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Grant Cloud Run SA access to Secret Manager
resource "google_project_iam_member" "cloudrun_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Grant Cloud Run SA access to Storage
resource "google_project_iam_member" "cloudrun_storage" {
  project = var.project_id
  role    = "roles/storage.objectAdmin"
  member  = "serviceAccount:${google_service_account.cloudrun.email}"
}

# Secrets in Secret Manager
resource "google_secret_manager_secret" "jwt_secret" {
  secret_id = "jwt-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "database-url"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "llm_webhook_secret" {
  secret_id = "llm-webhook-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_secret_key" {
  secret_id = "stripe-secret-key"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_webhook_secret" {
  secret_id = "stripe-webhook-secret"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_price_id" {
  secret_id = "stripe-price-id"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "stripe_product_id" {
  secret_id = "stripe-product-id"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "jwt_secret_latest" {
  secret      = google_secret_manager_secret.jwt_secret.id
  secret_data = var.jwt_secret
}

resource "google_secret_manager_secret_version" "database_url_latest" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${google_sql_user.main.name}:${urlencode(var.database_password)}@localhost/${google_sql_database.main.name}?host=/cloudsql/${google_sql_database_instance.main.connection_name}"
}

resource "google_secret_manager_secret_version" "llm_webhook_secret_latest" {
  secret      = google_secret_manager_secret.llm_webhook_secret.id
  secret_data = var.llm_webhook_secret
}

resource "google_secret_manager_secret_version" "stripe_secret_key_latest" {
  secret      = google_secret_manager_secret.stripe_secret_key.id
  secret_data = var.stripe_secret_key
}

resource "google_secret_manager_secret_version" "stripe_webhook_secret_latest" {
  secret      = google_secret_manager_secret.stripe_webhook_secret.id
  secret_data = var.stripe_webhook_secret
}

resource "google_secret_manager_secret_version" "stripe_price_id_latest" {
  secret      = google_secret_manager_secret.stripe_price_id.id
  secret_data = var.stripe_price_id
}

resource "google_secret_manager_secret_version" "stripe_product_id_latest" {
  secret      = google_secret_manager_secret.stripe_product_id.id
  secret_data = var.stripe_product_id
}

# Cloud Run - API Service
resource "google_cloud_run_v2_service" "api" {
  name     = "api-service"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun.email
    timeout         = "300s"

    annotations = {
      "run.googleapis.com/cloudsql-instances" = google_sql_database_instance.main.connection_name
    }

    scaling {
      min_instance_count = var.api_min_instances
      max_instance_count = var.api_max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/api-service:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "REDIS_URL"
        value = var.redis_url
      }

      # Parse Redis URL for BullMQ (expects individual components)
      env {
        name  = "REDIS_HOST"
        value = regex("://(?:[^:]+:)?[^@]+@([^:]+):", var.redis_url)[0]
      }

      env {
        name  = "REDIS_PORT"
        value = regex(":([0-9]+)$", var.redis_url)[0]
      }

      env {
        name  = "REDIS_PASSWORD"
        value = regex("://[^:]+:([^@]+)@", var.redis_url)[0]
      }

      env {
        name  = "REDIS_DB"
        value = "0"
      }

      env {
        name  = "LLM_SERVICE_URL"
        value = var.llm_service_url
      }

      env {
        name = "LLM_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.llm_webhook_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_secret_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_WEBHOOK_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_webhook_secret.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_PRICE_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_price_id.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "STRIPE_PRODUCT_ID"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.stripe_product_id.secret_id
            version = "latest"
          }
        }
      }

      env {
        name  = "LLM_API_KEY"
        value = var.llm_api_key
      }

      env {
        name  = "LLM_SERVICE_USERNAME"
        value = var.llm_service_username
      }

      env {
        name  = "LLM_SERVICE_PASSWORD"
        value = var.llm_service_password
      }

      env {
        name  = "FRONTEND_URL"
        value = var.frontend_url
      }

      env {
        name  = "API_BASE_URL"
        value = var.api_base_url
      }

      env {
        name  = "DOCUMENT_STORAGE_TYPE"
        value = "gcs"
      }

      env {
        name  = "GCS_BUCKET_NAME"
        value = google_storage_bucket.uploads.name
      }

      env {
        name  = "GCS_PROJECT_ID"
        value = var.project_id
      }

      env {
        name  = "STORAGE_BUCKET"
        value = google_storage_bucket.uploads.name
      }

      # AWS Configuration (for SES email and S3 storage)
      env {
        name  = "AWS_ACCESS_KEY_ID"
        value = var.aws_access_key_id
      }

      env {
        name  = "AWS_SECRET_ACCESS_KEY"
        value = var.aws_secret_access_key
      }

      env {
        name  = "AWS_REGION"
        value = var.aws_region
      }

      env {
        name  = "SES_FROM_EMAIL"
        value = var.ses_from_email
      }
    }
  }

  depends_on = [
    google_project_service.required_apis,
    google_sql_database.main,
    google_secret_manager_secret.database_url,
    google_secret_manager_secret.stripe_secret_key,
    google_secret_manager_secret.stripe_webhook_secret,
    google_secret_manager_secret.stripe_price_id,
    google_secret_manager_secret.stripe_product_id,
  ]
}

# Allow unauthenticated access to API service
resource "google_cloud_run_v2_service_iam_member" "api_public" {
  location = google_cloud_run_v2_service.api.location
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Cloud Run - Frontend
resource "google_cloud_run_v2_service" "frontend" {
  name     = "frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloudrun.email

    scaling {
      min_instance_count = var.frontend_min_instances
      max_instance_count = var.frontend_max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.main.repository_id}/frontend:latest"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "PUBLIC_API_URL"
        value = "${trimsuffix(var.api_base_url, "/")}/api"
      }

      env {
        name  = "PUBLIC_LLM_API_URL"
        value = var.llm_service_url
      }

      env {
        name  = "PUBLIC_STRIPE_PRICE_ID"
        value = var.stripe_price_id
      }
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Allow unauthenticated access to frontend
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  location = google_cloud_run_v2_service.frontend.location
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Domain mappings for custom domains
resource "google_cloud_run_domain_mapping" "frontend_main" {
  location = var.region
  name     = "resumecast.ai"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }
}

resource "google_cloud_run_domain_mapping" "frontend_www" {
  location = var.region
  name     = "www.resumecast.ai"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.frontend.name
  }
}

resource "google_cloud_run_domain_mapping" "api" {
  location = var.region
  name     = "api.resumecast.ai"

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }
}
