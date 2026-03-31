# ============================================================================
# ALB Module - Input Variables
# These variables configure the load balancer and its listeners
# ============================================================================

# Application name used as prefix for ALB resource names
variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

# VPC ID where the target group is created
variable "vpc_id" {
  description = "VPC ID for the target group"
  type        = string
}

# Public subnet IDs where the ALB is deployed (needs internet access)
variable "public_subnets" {
  description = "List of public subnet IDs for ALB placement"
  type        = list(string)
}

# Security group ID controlling traffic to/from the ALB
variable "alb_security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
}

# Port that the application container listens on
variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
}

# ACM certificate ARN for HTTPS/TLS termination on the ALB
variable "certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  type        = string
}
