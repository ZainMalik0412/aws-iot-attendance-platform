output "certificate_arn" {
  description = "ARN of the ACM SSL/TLS certificate"
  value       = local.certificate_arn
}

output "zone_id" {
  description = "Route 53 hosted zone ID for the domain"
  value       = data.aws_route53_zone.main.zone_id
}
