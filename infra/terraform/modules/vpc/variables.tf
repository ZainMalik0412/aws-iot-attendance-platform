# ============================================================================
# VPC Module - Input Variables
# These variables are passed in from the root module to configure networking
# ============================================================================

# Application name used as a prefix for all resource names
variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

# AWS region determines which AZs are available for subnet placement
variable "aws_region" {
  description = "AWS region for availability zone selection"
  type        = string
}

# The port the application container listens on
# Used to configure the ECS security group ingress rule
variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
}
