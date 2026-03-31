# ============================================================================
# Root Module - Outputs
# These values are displayed after terraform apply and can be referenced
# by CI/CD pipelines, other Terraform configurations, or manual operations
# ============================================================================

# ---- ECR Outputs ----

# Full ECR repository URL used in docker push/pull commands and ECS task defs
output "ecr_repository_url" {
  description = "ECR repository URL for Docker image push/pull"
  value       = module.ecr.repository_url
}

# ---- ALB Outputs ----

# ALB DNS name - useful for debugging (bypasses Route 53)
output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

# ---- Application URL ----

# The full HTTPS URL where the application is accessible
output "app_url" {
  description = "Public HTTPS URL of the application"
  value       = "https://${var.subdomain}.${var.domain_name}"
}

# ---- ECS Outputs ----

# ECS cluster name - used by CI/CD for deployment commands
output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

# ECS service name - used by CI/CD to update the running service
output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

# ECS task definition family - used to identify task definition revisions
output "ecs_task_definition" {
  description = "ECS task definition family name"
  value       = module.ecs.task_definition_family
}

# ---- RDS Outputs ----

# Database endpoint (host:port) - marked sensitive to avoid log exposure
output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = module.rds.endpoint
  sensitive   = true
}

# Database name for connection configuration
output "rds_database_name" {
  description = "Name of the RDS database"
  value       = module.rds.db_name
}

# ---- VPC Outputs ----

# VPC ID for reference and debugging
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

# Private subnet IDs where ECS and RDS are placed
output "private_subnets" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

# Public subnet IDs where the ALB is placed
output "public_subnets" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

# ---- Logging Outputs ----

# CloudWatch log group for viewing container logs
output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name for ECS task logs"
  value       = module.ecs.cloudwatch_log_group
}

# ---- ACM Outputs ----

# ACM certificate ARN used by the ALB HTTPS listener
output "acm_certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  value       = module.acm.certificate_arn
}
