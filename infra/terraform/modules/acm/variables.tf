# ============================================================================
# ACM Module - Input Variables
# These variables configure the SSL certificate and DNS records
# ============================================================================

# Base domain name where the hosted zone exists (e.g. "zainecs.com")
variable "domain_name" {
  description = "Base domain name for the Route 53 hosted zone"
  type        = string
}

# Subdomain prefix for the application (e.g. "tm" creates "tm.zainecs.com")
variable "subdomain" {
  description = "Subdomain prefix for the application URL"
  type        = string
}

# Application name used for tagging the ACM certificate
variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

# ALB DNS name needed to create the Route 53 alias record
variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  type        = string
}

# ALB hosted zone ID needed for the Route 53 alias record
variable "alb_zone_id" {
  description = "Route 53 zone ID of the Application Load Balancer"
  type        = string
}
