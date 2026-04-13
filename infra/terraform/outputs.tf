output "ecr_repository_url" {
  description = "ECR repository URL for Docker image push/pull"
  value       = module.ecr.repository_url
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = module.alb.dns_name
}

output "app_url" {
  description = "Public HTTPS URL of the application"
  value       = "https://${var.subdomain}.${var.domain_name}"
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "ecs_task_definition" {
  description = "ECS task definition family name"
  value       = module.ecs.task_definition_family
}

output "rds_endpoint" {
  description = "RDS instance endpoint (host:port)"
  value       = module.rds.endpoint
  sensitive   = true
}

output "rds_database_name" {
  description = "Name of the RDS database"
  value       = module.rds.db_name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnets" {
  description = "List of private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of public subnet IDs"
  value       = module.vpc.public_subnets
}

output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name for ECS task logs"
  value       = module.ecs.cloudwatch_log_group
}

output "acm_certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  value       = module.acm.certificate_arn
}
