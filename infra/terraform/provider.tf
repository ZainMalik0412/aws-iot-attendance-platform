provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project = "IoT Smart Attendance System"
      Environment = var.environment
      ManagedBy = "Terraform"
    }
  }
}
