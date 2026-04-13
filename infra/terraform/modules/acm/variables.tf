variable "domain_name" {
  description = "Base domain name for the Route 53 hosted zone"
  type        = string
}

variable "subdomain" {
  description = "Subdomain prefix for the application URL"
  type        = string
}

variable "app_name" {
  description = "Application name used for resource naming"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  type        = string
}

variable "alb_zone_id" {
  description = "Route 53 zone ID of the Application Load Balancer"
  type        = string
}
