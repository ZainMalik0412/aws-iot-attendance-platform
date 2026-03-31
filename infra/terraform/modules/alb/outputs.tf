# ============================================================================
# ALB Module - Outputs
# These values are used by the ECS and ACM modules
# ============================================================================

# Target group ARN - ECS service registers its tasks here
output "target_group_arn" {
  description = "ARN of the ALB target group"
  value       = aws_lb_target_group.app.arn
}

# ALB DNS name - used by Route 53 alias record to point the domain here
output "dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

# ALB zone ID - required by Route 53 for alias record creation
output "zone_id" {
  description = "Route 53 zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

# HTTPS listener ARN - ECS service depends on this to ensure
# the listener exists before registering targets
output "https_listener_arn" {
  description = "ARN of the HTTPS listener"
  value       = aws_lb_listener.https.arn
}
