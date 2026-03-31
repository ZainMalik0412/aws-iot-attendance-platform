# ============================================================================
# Root Module - Input Variables
# These variables are set in terraform.tfvars and passed to child modules
# ============================================================================

# ---- General Settings ----

# AWS region where all infrastructure will be deployed
variable "aws_region" {
  description = "AWS region for resource deployment"
  type        = string
  default     = "eu-west-2"
}

# Environment label used in tags and configuration (prod, staging, dev)
variable "environment" {
  description = "Environment name for tagging and configuration"
  type        = string
  default     = "prod"
}

# Application name used as prefix for all AWS resource names
variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
  default     = "attendancems"
}

# ---- Domain / DNS Settings ----

# Base domain name - must have an existing Route 53 hosted zone
variable "domain_name" {
  description = "Base domain name with an existing Route 53 hosted zone"
  type        = string
  default     = "zainecs.com"
}

# Subdomain prefix (e.g. "tm" creates "tm.zainecs.com")
variable "subdomain" {
  description = "Subdomain prefix for the application URL"
  type        = string
  default     = "tm"
}

# ---- Container Settings ----

# Port the application container listens on inside the Docker container
variable "container_port" {
  description = "Port exposed by the application container"
  type        = number
  default     = 8080
}

# CPU units for the Fargate task (256 = 0.25 vCPU)
variable "container_cpu" {
  description = "CPU units for the ECS Fargate task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

# Memory in MB for the Fargate task
variable "container_memory" {
  description = "Memory in MB for the ECS Fargate task"
  type        = number
  default     = 512
}

# Number of ECS task instances to run (1 = cost savings, 2+ = high availability)
variable "desired_count" {
  description = "Desired number of running ECS task instances"
  type        = number
  default     = 1
}

# ---- Database Settings ----

# RDS instance class determines compute and memory capacity
variable "db_instance_class" {
  description = "RDS instance class (e.g. db.t3.micro = 2 vCPU, 1GB RAM)"
  type        = string
  default     = "db.t3.micro"
}

# Storage size in gigabytes for the RDS instance
variable "db_allocated_storage" {
  description = "Allocated storage for the RDS instance in GB"
  type        = number
  default     = 20
}

# PostgreSQL database name created on instance launch
variable "db_name" {
  description = "Name of the PostgreSQL database to create"
  type        = string
  default     = "attendancems"
}

# Master username for PostgreSQL authentication
# Marked sensitive to prevent it from appearing in CLI output
variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "attendancems"
  sensitive   = true
}

# Optional RDS snapshot ID to restore from after a destroy/rebuild cycle
# Set to null for a fresh database with no data
variable "db_snapshot_identifier" {
  description = "RDS snapshot identifier to restore from (null for fresh database)"
  type        = string
  default     = null
}

# ---- GitHub Settings (used in bootstrap, kept here for reference) ----

# GitHub organisation or username that owns the repository
variable "github_org" {
  description = "GitHub organisation or username"
  type        = string
  default     = "ZainMalik0412"
}

# GitHub repository name for CI/CD OIDC integration
variable "github_repo" {
  description = "GitHub repository name"
  type        = string
  default     = "ecsv1"
}
