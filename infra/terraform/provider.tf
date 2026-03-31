# ============================================================================
# Provider Configuration
# Configures the AWS provider and sets default tags for all resources
# ============================================================================

# AWS provider - all resources will be created in this region
provider "aws" {
  # AWS region where all infrastructure will be deployed
  region = var.aws_region

  # Default tags automatically applied to every AWS resource created by Terraform
  # These help with cost tracking, ownership, and resource management
  default_tags {
    tags = {
      # Project name for cost allocation and filtering
      Project = "AttendanceMS"
      # Environment label (prod, staging, dev)
      Environment = var.environment
      # Indicates these resources are managed by Terraform (not manually created)
      ManagedBy = "Terraform"
    }
  }
}
