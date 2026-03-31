# ============================================================================
# ECS Module - Outputs
# These values are used for deployment, monitoring, and CI/CD integration
# ============================================================================

# Cluster name - used by CI/CD pipeline to identify where to deploy
output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

# Service name - used by CI/CD pipeline to update the running service
output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.app.name
}

# Task definition family - used to identify and update the task definition
output "task_definition_family" {
  description = "ECS task definition family name"
  value       = aws_ecs_task_definition.app.family
}

# CloudWatch log group name - used to view application logs
output "cloudwatch_log_group" {
  description = "CloudWatch Log Group name for ECS task logs"
  value       = aws_cloudwatch_log_group.ecs.name
}
