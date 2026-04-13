# IoT Smart Attendance System

A cloud-native IoT-driven attendance management system deployed on AWS using Infrastructure as Code, containerised with Docker, and fully automated through CI/CD pipelines.

## CI/CD Pipeline

Fully automated deployment pipeline using **GitHub Actions** with **OIDC authentication** (no long-lived AWS credentials).

```
Push to main
     │
     ▼
┌─────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐    ┌────────────┐    ┌──────────────┐
│  Test    │───▶│  Check Infra  │───▶│  Terraform   │───▶│  Build   │───▶│  Deploy    │───▶│  Health      │
│  Suite   │    │  (Drift/Diff) │    │  Apply       │    │  & Push  │    │  to ECS    │    │  Checks      │
└─────────┘    └──────────────┘    └─────────────┘    └──────────┘    └────────────┘    └──────────────┘
```

| Stage | Description |
|-------|-------------|
| **Test** | Runs pytest against a PostgreSQL service container |
| **Check Infrastructure** | Detects Terraform drift and `.tf` file changes |
| **Terraform Apply** | Provisions or updates AWS infrastructure |
| **Build & Push** | Multi-stage Docker build → push to ECR |
| **Deploy to ECS** | Rolling update with zero-downtime deployment |
| **Post-Deploy Checks** | Health endpoint verification and API smoke tests |

### Destroy Pipeline

A separate manually-triggered workflow safely tears down all infrastructure:
1. Creates an RDS snapshot and stores the ID in SSM Parameter Store
2. Waits for the snapshot to complete before deleting resources
3. Runs `terraform destroy` with parallel resource deletion
4. Cleans up orphaned Route 53 records, ECR images, and task definitions
5. Preserves only the latest snapshot for cost-efficient data recovery

---

## Infrastructure as Code

All infrastructure is defined in **Terraform** with a modular structure:

```
infra/terraform/
├── main.tf                    # Root module — orchestrates all child modules
├── variables.tf               # Input variables (region, instance sizes, etc.)
├── outputs.tf                 # Exported values for CI/CD consumption
├── provider.tf                # AWS provider config with default tags
├── bootstrap/                 # One-time setup: S3 state bucket, DynamoDB locks, OIDC
│   └── main.tf
└── modules/
    ├── vpc/                   # VPC, subnets, security groups (no NAT Gateway)
    ├── ecr/                   # Container registry with lifecycle policies
    ├── acm/                   # SSL certificate, DNS validation, Route 53 records
    ├── alb/                   # Application Load Balancer, listeners, target groups
    ├── rds/                   # PostgreSQL database, Secrets Manager credentials
    └── ecs/                   # Fargate cluster, service, task definition, IAM roles
```

## Docker

Multi-stage Dockerfile producing a minimal production image:

```
Stage 1: frontend-builder    →  Node 20 Alpine — builds React/Vite SPA
Stage 2: backend-builder     →  Python 3.10 Slim — compiles wheel files
Stage 3: runtime             →  Python 3.10 Slim — final image (~200MB)
```

- Non-root user (`appuser`) for security
- Layer caching optimised for fast CI rebuilds
- Health check via `curl` on `/health`

---

## Application Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | FastAPI · Python 3.10 · SQLAlchemy · JWT Auth |
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui |
| **Database** | PostgreSQL 16 (RDS) |
| **IoT Hardware** | ESP32-CAM · Servo tracking · Real-time frame processing |

---

## Quick Start

### Local Development

```bash
git clone https://github.com/ZainMalik0412/ecsv1.git
cd ecsv1
docker-compose up --build
```

| Endpoint | URL |
|----------|-----|
| Application | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Health Check | http://localhost:8000/health |

### Demo Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin |
| Lecturer | lecturer | lecturer |
| Student | student | student |

### Running Tests

```bash
cd app/backend
pytest -v
pytest --cov=app --cov-report=html
```

---

## Deployment

### Prerequisites

1. AWS account with Route 53 hosted zone
2. Terraform >= 1.5.0
3. GitHub repository with Actions enabled

### Bootstrap (One-Time)

```bash
cd infra/terraform/bootstrap
terraform init && terraform apply
```

This creates the S3 state bucket, DynamoDB lock table, GitHub OIDC provider, and IAM role.

### Deploy

Add the output `github_actions_role_arn` as `AWS_ROLE_ARN` secret in GitHub repo settings, then push to `main`:

```bash
git push origin main
```

The CI/CD pipeline handles everything from there — Terraform apply, Docker build, ECS deployment, and health checks.

### Tear Down

Trigger the **Destroy Infrastructure** workflow from GitHub Actions. Database is automatically snapshotted before deletion and restored on the next deploy.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET_KEY` | Secret for JWT token signing | Required |
| `SEED_DEMO_DATA` | Seed demo users on startup | `false` |
| `APP_ENV` | Environment label | `prod` |

---

## Repository Structure

```
├── .github/workflows/
│   ├── deploy.yml             # CI/CD pipeline (test → build → deploy)
│   └── destroy.yml            # Infrastructure teardown with snapshot
├── app/
│   ├── backend/               # FastAPI application
│   │   ├── app/
│   │   │   ├── routers/       # API route handlers
│   │   │   ├── services/      # Business logic
│   │   │   ├── models.py      # SQLAlchemy ORM models
│   │   │   ├── schemas.py     # Pydantic request/response schemas
│   │   │   └── main.py        # Application entrypoint
│   │   └── tests/             # pytest test suite
│   └── frontend/              # React SPA
│       └── src/
│           ├── components/    # Reusable UI components
│           ├── pages/         # Route-level page components
│           └── lib/           # API client and utilities
├── infra/terraform/           # Infrastructure as Code
├── bridge.py                  # ESP32 IoT hardware bridge script
├── Dockerfile                 # Multi-stage production build
├── docker-compose.yml         # Local development environment
└── README.md
```

---
