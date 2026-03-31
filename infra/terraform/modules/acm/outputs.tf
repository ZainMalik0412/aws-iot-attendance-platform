# ============================================================================
# ACM Module - Outputs
# These values are used by the ALB module for HTTPS listener configuration
# ============================================================================

# The ARN of the SSL certificate - attached to the ALB HTTPS listener
output "certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  value       = local.certificate_arn
}

# The Route 53 hosted zone ID - used for DNS record management
output "zone_id" {
  description = "Route 53 hosted zone ID for the domain"
  value       = data.aws_route53_zone.main.zone_id
}
