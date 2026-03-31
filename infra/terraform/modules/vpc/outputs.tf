# ============================================================================
# VPC Module - Outputs
# These values are exported for use by other modules (ALB, ECS, RDS, etc.)
# ============================================================================

# The VPC ID is needed by security groups and other resources
output "vpc_id" {
  description = "ID of the created VPC"
  value       = module.vpc.vpc_id
}

# Private subnet IDs where ECS tasks and RDS instances are placed
output "private_subnets" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

# Public subnet IDs where the ALB is placed
output "public_subnets" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

# Security group ID for the ALB - passed to the ALB module
output "alb_security_group_id" {
  description = "Security group ID for the Application Load Balancer"
  value       = aws_security_group.alb.id
}

# Security group ID for ECS tasks - passed to the ECS module
output "ecs_security_group_id" {
  description = "Security group ID for ECS tasks"
  value       = aws_security_group.ecs.id
}

# Security group ID for RDS - passed to the RDS module
output "rds_security_group_id" {
  description = "Security group ID for the RDS database"
  value       = aws_security_group.rds.id
}
