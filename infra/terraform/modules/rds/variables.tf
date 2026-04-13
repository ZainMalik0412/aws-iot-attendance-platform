variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

variable "db_instance_class" {
  description = "RDS instance class (e.g. db.t3.micro)"
  type        = string
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
}

variable "db_name" {
  description = "Name of the database to create"
  type        = string
}

variable "db_username" {
  description = "Database master username"
  type        = string
  sensitive = true
}

variable "private_subnets" {
  description = "List of private subnet IDs for the DB subnet group"
  type        = list(string)
}

variable "rds_security_group_id" {
  description = "Security group ID for the RDS instance"
  type        = string
}

variable "db_snapshot_identifier" {
  description = "RDS snapshot identifier to restore from (null for fresh DB)"
  type        = string
  default     = null
}
