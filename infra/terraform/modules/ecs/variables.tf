variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g. prod, staging)"
  type        = string
}

variable "aws_region" {
  description = "AWS region for log group placement"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
}

variable "container_cpu" {
  description = "CPU units for the ECS task"
  type        = number
}

variable "container_memory" {
  description = "Memory in MB for the ECS task"
  type        = number
}

variable "desired_count" {
  description = "Desired number of running ECS tasks"
  type        = number
}

variable "ecs_subnets" {
  description = "List of subnet IDs for ECS task placement"
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "ecr_repository_url" {
  description = "URL of the ECR repository containing the Docker image"
  type        = string
}

variable "target_group_arn" {
  description = "ARN of the ALB target group"
  type        = string
}

variable "https_listener_arn" {
  description = "ARN of the ALB HTTPS listener (used for dependency ordering)"
  type        = string
}

variable "db_credentials_secret_arn" {
  description = "ARN of the DB credentials secret in Secrets Manager"
  type        = string
}

variable "database_url_secret_arn" {
  description = "ARN of the database URL secret in Secrets Manager"
  type        = string
}
