# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an online assessment platform for hiring and recruitment, designed as a multi-tenant SaaS solution. The platform supports multiple question types (MCQ, MSQ, coding challenges), proctoring capabilities, and organization-specific branding.

## Architecture

The project follows a microservices architecture with detailed designs available in the `diagrams/` directory:

- **Backend**: Node.js with Express and TypeScript (currently minimal setup)
- **Frontend**: Next.js with user-responsive design for Admin/Recruiter/Candidate interfaces
- **Database**: MongoDB Atlas (cloud-hosted) with comprehensive ERD showing 7 main collections
- **Real-time**: Socket.io for proctoring and live monitoring
- **Infrastructure**: Full AWS stack with VPC, ECS Fargate, Lambda, S3, CloudFront, ElastiCache Redis
- **Security**: Multi-layer security with WAF, security groups, and encrypted storage

### User Roles & Access
- **Admin**: Full system management and organization settings
- **Recruiter**: Assessment creation, candidate management, results analysis
- **Candidate**: Assessment taking interface with proctoring capabilities

## Development Commands

### Backend Development
```bash
cd backend
npm run dev          # Start development server with tsx watch
npm test             # Currently returns error - tests not implemented yet
```

### Database Setup
The project uses MongoDB Atlas for cloud-hosted database. No local database setup required.

To test the Atlas connection:
```bash
cd backend
node test-atlas-connection.js
```

## Project Structure

```
backend/
├── src/
│   ├── config/         # Database and app configuration
│   │   └── db.ts      # MongoDB connection setup
│   ├── controllers/    # Request handlers (empty)
│   ├── middleware/     # Express middleware (empty)
│   ├── models/         # Mongoose models (empty)
│   ├── routes/         # API routes (empty)
│   ├── utils/          # Utility functions (empty)
│   └── index.ts       # Express app entry point
├── package.json       # Dependencies and scripts
└── tsconfig.json      # TypeScript configuration

frontend/              # Next.js application with user interfaces
infrastructure/        # Empty directory - AWS infrastructure planned
scripts/               # Utility scripts and tools
```

## Key Implementation Notes

### Database Design
Based on the Complete Entity Relationship Diagram, the MongoDB collections include:

**Core Collections:**
- **Organizations**: Multi-tenant organization data with branding and settings
- **Users**: Admin/recruiter accounts with organization FK relationships
- **Assessments**: Assessment templates with question references and configuration
- **Questions**: Question bank with various types (MCQ, MSQ, coding)
- **Invitations**: Candidate invitation tokens and session management
- **AssessmentResults**: Candidate responses, scores, and completion status
- **CodeExecutions**: Secure code execution logs and outputs
- **SystemLogs**: Comprehensive audit trails and system events

**Key Relationships:**
- Organizations → Users (1:N)
- Assessments → Questions (M:N with ordering/points)
- Invitations → AssessmentResults (1:1)
- AssessmentResults → CodeExecutions (1:N)

### API Structure
Based on the API Architecture diagram, the middleware pipeline includes authentication, authorization, validation, and logging layers. The API endpoints follow RESTful patterns:

- `/api/auth/*` - Authentication and authorization with JWT tokens
- `/api/organizations/*` - Organization management and multi-tenant settings
- `/api/users/*` - User management with RBAC
- `/api/assessments/*` - Assessment CRUD operations and templates
- `/api/questions/*` - Question bank management with different types
- `/api/invitations/*` - Candidate invitation system with session tracking
- `/api/results/*` - Assessment results, analytics, and scoring
- `/api/code/*` - Secure code execution in isolated Lambda environments
- `/api/proctoring/*` - Real-time proctoring event logging via Socket.io

**Middleware Pipeline:**
1. Authentication validation
2. Authorization and role checks
3. Input validation and sanitization
4. Request logging and audit trails

### Security Considerations
- JWT-based authentication with short token lifespans
- Role-Based Access Control (RBAC) implementation required
- Input validation and sanitization needed
- Rate limiting for API protection
- Secure code execution environment for coding challenges

### Environment Configuration
The backend requires these environment variables in `backend/.env`:
- `MONGODB_URI` - MongoDB Atlas connection string (required)
- `MONGODB_ATLAS_URI` - Alternative Atlas connection string for production
- `PORT` - Server port (defaults to 5000)
- See `.env.example` for full list of required environment variables

## Development Guidelines

### Code Style
- TypeScript with strict mode enabled
- ESLint configuration present (basic recommended rules)
- Prettier formatting configured (single quotes, semicolons, 2-space tabs)
- Target ES2020 with CommonJS modules

### Testing
- Test framework not yet implemented
- Unit tests planned for backend and frontend components (Jest mentioned in design)
- Integration tests for API flows
- End-to-end tests with Cypress

### Git Workflow
- Main branch: `master`
- No CI/CD pipeline currently configured
- AWS CodePipeline planned for deployment

## Available Documentation

### Architecture Diagrams
The `diagrams/` directory contains 17 comprehensive architectural diagrams:
- **System Architecture.png** - High-level system overview
- **Complete Entity Relationship Diagram.png** - Database schema relationships
- **API Architecture.png** - Middleware pipeline and endpoint structure
- **AWS Infrastructure.png** - Full cloud infrastructure design
- **Frontend navigation and page structure diagram.png** - UI/UX flow
- **Security Architecture.png** - Multi-layer security implementation
- **Code Execution System.png** - Isolated code execution environment
- **Proctoring System.png** - Real-time monitoring architecture
- **CI/CD deployment pipeline.png** - Automated deployment workflow
- Additional workflow and ERD diagrams for specific components

### Design Documents
- **Complete-System-Design.md** - Comprehensive technical specifications
- **Finalized-Requirement-Analysis-and-Features.md** - Feature requirements and analysis

## Current State

The project has a functional backend with MongoDB Atlas integration and a Next.js frontend. The database includes:
- 9 collections (Organizations, Users, Questions, Assessments, Invitations, AssessmentResults, CodeExecutions, SystemLogs, RefreshTokens)
- Complete Mongoose models with proper indexes
- Multi-tenant architecture with organization-based data separation
- Authentication and authorization system
- Assessment and question management
- Proctoring capabilities with event tracking

The comprehensive system design and architectural diagrams provide detailed blueprints for continued development.