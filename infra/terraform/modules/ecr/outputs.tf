# ============================================================================
# ECR Module - Outputs
# These values are used by the ECS module and CI/CD pipeline
# ============================================================================

# Full repository URL used in docker push/pull and ECS task definitions
# Format: <account_id>.dkr.ecr.<region>.amazonaws.com/<repo_name>
output "repository_url" {
  description = "Full URL of the ECR repository"
  value       = aws_ecr_repository.app.repository_url
}

# Repository name used by lifecycle policies and CI/CD scripts
output "repository_name" {
  description = "Name of the ECR repository"
  value       = aws_ecr_repository.app.name
}
