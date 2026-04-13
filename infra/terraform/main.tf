terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  backend "s3" {
    bucket = "attendancems-terraform-state"
    key = "prod/terraform.tfstate"
    region = "eu-west-2"
    encrypt = true
    dynamodb_table = "attendancems-terraform-locks"
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

module "vpc" {
  source = "./modules/vpc"

  app_name       = var.app_name
  aws_region     = var.aws_region
  container_port = var.container_port
}

module "ecr" {
  source = "./modules/ecr"

  app_name = var.app_name
}

module "acm" {
  source = "./modules/acm"

  domain_name = var.domain_name
  subdomain   = var.subdomain
  app_name    = var.app_name
  alb_dns_name = module.alb.dns_name
  alb_zone_id  = module.alb.zone_id
}

module "alb" {
  source = "./modules/alb"

  app_name              = var.app_name
  vpc_id                = module.vpc.vpc_id
  public_subnets        = module.vpc.public_subnets
  alb_security_group_id = module.vpc.alb_security_group_id
  container_port        = var.container_port
  certificate_arn = module.acm.certificate_arn
}

module "rds" {
  source = "./modules/rds"

  app_name             = var.app_name
  db_instance_class    = var.db_instance_class
  db_allocated_storage = var.db_allocated_storage
  db_name              = var.db_name
  db_username          = var.db_username
  private_subnets       = module.vpc.private_subnets
  rds_security_group_id = module.vpc.rds_security_group_id
  db_snapshot_identifier = var.db_snapshot_identifier
}

module "ecs" {
  source = "./modules/ecs"

  app_name    = var.app_name
  environment = var.environment
  aws_region  = var.aws_region
  container_port   = var.container_port
  container_cpu    = var.container_cpu
  container_memory = var.container_memory
  desired_count    = var.desired_count
  ecs_subnets           = module.vpc.public_subnets
  ecs_security_group_id = module.vpc.ecs_security_group_id
  ecr_repository_url = module.ecr.repository_url
  target_group_arn   = module.alb.target_group_arn
  https_listener_arn = module.alb.https_listener_arn
  db_credentials_secret_arn = module.rds.db_credentials_secret_arn
  database_url_secret_arn   = module.rds.database_url_secret_arn
}
