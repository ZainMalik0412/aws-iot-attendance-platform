# ============================================================================
# RDS Module
# Creates the PostgreSQL database, credentials, and related secrets
# The database stores all application data and is placed in private subnets
# ============================================================================

# Generate a random 32-character password for the database master user
# Using random_password ensures the password is never stored in plain text
resource "random_password" "db_password" {
  # 32 characters provides strong entropy for database authentication
  length = 32
  # Disable special characters to avoid connection string encoding issues
  special = false
}

# Secrets Manager secret to store structured database credentials (JSON)
# ECS tasks retrieve these at runtime to connect to the database
resource "aws_secretsmanager_secret" "db_credentials" {
  # Secret name following a namespaced pattern for organisation
  name = "${var.app_name}/db-credentials"
  # Set to 0 to allow immediate deletion (no recovery window)
  # This prevents "already exists" errors when re-creating after destroy
  recovery_window_in_days = 0
}

# Store the actual credential values as a JSON object in the secret
resource "aws_secretsmanager_secret_version" "db_credentials" {
  # Reference the secret created above
  secret_id = aws_secretsmanager_secret.db_credentials.id
  # JSON object containing all database connection details
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    database = var.db_name
  })
}

# Secrets Manager secret for the full DATABASE_URL connection string
# This is the format expected by SQLAlchemy / most Python ORMs
resource "aws_secretsmanager_secret" "database_url" {
  # Secret name following the namespaced pattern
  name = "${var.app_name}/database-url"
  # Immediate deletion allowed for clean re-creation
  recovery_window_in_days = 0
}

# Store the full PostgreSQL connection string as the secret value
resource "aws_secretsmanager_secret_version" "database_url" {
  # Reference the secret created above
  secret_id = aws_secretsmanager_secret.database_url.id
  # Full connection string in SQLAlchemy format: driver://user:pass@host:port/dbname
  secret_string = "postgresql+psycopg2://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.main.address}:${aws_db_instance.main.port}/${var.db_name}"
}

# DB subnet group defines which subnets RDS can place database instances in
# Using private subnets ensures the database is not directly internet-accessible
resource "aws_db_subnet_group" "main" {
  # Name of the subnet group
  name = "${var.app_name}-db-subnet-group"
  # Place the database in private subnets (across multiple AZs for failover)
  subnet_ids = var.private_subnets

  # Tags for resource identification
  tags = {
    Name = "${var.app_name}-db-subnet-group"
  }
}

# The RDS PostgreSQL database instance
# This is the primary data store for the application
resource "aws_db_instance" "main" {
  # Unique identifier for the DB instance within the AWS account
  identifier = "${var.app_name}-db"

  # Database engine and version - pin to exact minor version to prevent
  # upgrade during snapshot restore (snapshot is 16.10, so restore as 16.10)
  engine         = "postgres"
  engine_version = "16.10"
  # Instance class determines CPU and memory (t3.micro = 2 vCPU, 1GB RAM)
  instance_class = var.db_instance_class
  # Storage allocation in gigabytes
  allocated_storage = var.db_allocated_storage
  # gp3 provides baseline 3,000 IOPS at lower cost than gp2
  storage_type = "gp3"
  # Enable encryption at rest using AWS-managed keys
  storage_encrypted = true

  # Database name created on instance launch
  db_name = var.db_name
  # Master username for database authentication
  username = var.db_username
  # Master password from the random_password resource
  password = random_password.db_password.result

  # Place the instance in our private subnet group
  db_subnet_group_name = aws_db_subnet_group.main.name
  # Attach the RDS security group (only allows traffic from ECS)
  vpc_security_group_ids = [var.rds_security_group_id]

  # Single-AZ deployment to reduce costs (set to true for production HA)
  multi_az = false
  # Do not assign a public IP - database should only be reachable from VPC
  publicly_accessible = false
  # Create a final snapshot before deletion to preserve data
  skip_final_snapshot = false
  # Name for the final snapshot (includes timestamp for uniqueness)
  final_snapshot_identifier = "${var.app_name}-db-final-${formatdate("YYYY-MM-DD-hh-mm", timestamp())}"
  # Allow Terraform to delete the instance without manual intervention
  deletion_protection = false

  # Ignore changes to the final snapshot name (timestamp changes every apply)
  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }

  # Optionally restore from a snapshot (used when rebuilding after destroy)
  # If null, creates a fresh database; if set, restores data from snapshot
  snapshot_identifier = var.db_snapshot_identifier

  # Disable automated backups to speed up fresh instance creation (~2-3 min saved)
  # Note: For snapshot restores, AWS overrides this with the snapshot's original value
  # Manual snapshots are taken by the destroy pipeline before teardown, so automated
  # backups are redundant for this project's use case
  backup_retention_period = 0

  # Disable auto minor version upgrade to prevent unexpected upgrade
  # delays during snapshot restore or maintenance windows
  auto_minor_version_upgrade = false

  # Disable Performance Insights to reduce costs (enable for debugging)
  performance_insights_enabled = false

  # Tags for resource identification
  tags = {
    Name = "${var.app_name}-db"
  }
}
