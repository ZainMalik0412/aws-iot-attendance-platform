variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID for the target group"
  type        = string
}

variable "public_subnets" {
  description = "List of public subnet IDs for ALB placement"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security group ID for the ALB"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
}

variable "certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  type        = string
}
