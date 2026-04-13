variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

variable "aws_region" {
  description = "AWS region for availability zone selection"
  type        = string
}

variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
}
