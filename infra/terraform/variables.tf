variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "eu-west-2"
}

variable "environment" {
  description = "Environment name for tagging and configuration"
  type        = string
  default     = "prod"
}

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "attendancems"
}

variable "domain_name" {
  description = "Base domain name with an existing Route 53 hosted zone"
  type        = string
  default     = "zainecs.com"
}

variable "subdomain" {
  description = "Subdomain prefix for the application URL"
  type        = string
  default     = "tm"
}

variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
  default     = 8080
}

variable "container_cpu" {
  description = "CPU units for the ECS Fargate task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "container_memory" {
  description = "Memory in MB for the ECS Fargate task"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of running ECS task instances"
  type        = number
  default     = 1
}

variable "db_instance_class" {
  description = "RDS instance class (e.g. db.t3.micro = 2 vCPU, 1GB RAM)"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for the RDS instance in GB"
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Name of the PostgreSQL database to create"
  type        = string
  default     = "attendancems"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "attendancems"
  sensitive   = true
}

variable "db_snapshot_identifier" {
  description = "RDS snapshot identifier to restore from (null for fresh database)"
  type        = string
  default     = null
}

variable "github_org" {
  description = "GitHub organisation or username"
  type        = string
  default     = "ZainMalik0412"
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "aws-iot-attendance-project"
}
