# Development Setup Guide

## Prerequisites

1. Node.js 18+ and npm
2. MongoDB Atlas account (free tier available)
3. Git
4. Clone the repository

## Quick Start

1. **Set up MongoDB Atlas:**
   - Create account at [mongodb.com/atlas](https://mongodb.com/atlas)
   - Create a free M0 cluster
   - Create database user with read/write permissions
   - Whitelist your IP (0.0.0.0/0 for development)
   - Copy your connection string

2. **Configure environment:**
```bash
cd backend
cp ../.env.example .env
# Edit .env and add your MongoDB Atlas connection string
```

3. **Install dependencies:**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

4. **Test database connection:**
```bash
cd backend
node test-atlas-connection.js
```

5. **Start development servers:**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
```

Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

6. **Access the applications:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Default Test Accounts

Admin User:
- Email: admin@testorg.com
- Password: Admin123!

Recruiter User:
- Email: recruiter@testorg.com
- Password: Recruiter123!

## Development Workflow

1. Both backend and frontend have hot-reload enabled
2. Changes to code will automatically restart the development servers
3. Database changes are immediately reflected across all team members via Atlas

## Database Management

### Connect to MongoDB Atlas
Use MongoDB Compass (GUI) or mongosh (CLI):
```bash
mongosh "mongodb+srv://<username>:<password>@<cluster>.mongodb.net/assessment_platform"
```

### View Database Statistics
```bash
cd backend
node test-atlas-connection.js
```

### Seed Test Data
```bash
cd backend
npm run seed
```

## Troubleshooting

### Database Connection Issues

1. **Cannot connect to Atlas:**
   - Verify your IP is whitelisted in Atlas dashboard
   - Check your connection string in `.env` is correct
   - Ensure your Atlas cluster is running (free tier clusters don't pause)
   - Test connection: `cd backend && node test-atlas-connection.js`

2. **Authentication failed:**
   - Verify database username and password in connection string
   - Check database user permissions in Atlas dashboard
   - Ensure password doesn't contain special characters that need URL encoding

3. **Connection timeout:**
   - Check your internet connection
   - Verify Atlas cluster is in a region close to you
   - Try adding your IP to whitelist again

### Port Conflicts

1. Backend port (5000) already in use:
   - Change `PORT` in `backend/.env`
   - Update references in frontend API calls

2. Frontend port (3000) already in use:
   - Next.js will automatically suggest port 3001
   - Update `FRONTEND_URL` in `backend/.env` if changed

### Hot Reload Not Working

1. Backend not reloading:
   - Check backend terminal for errors
   - Restart development server: `Ctrl+C` then `npm run dev`

2. Frontend not reloading:
   - Clear Next.js cache: `rm -rf frontend/.next`
   - Restart development server

## Adding Test Data

To add seed data to your Atlas database:

1. Edit `backend/src/seedTestData.ts`
2. Run the seed script:
```bash
cd backend
npm run seed
```

## Environment Variables

Key environment variables in `backend/.env`:

```env
# Database
MONGODB_URI=mongodb+srv://...                 # MongoDB Atlas connection string
MONGODB_ATLAS_URI=mongodb+srv://...           # Alternative for production

# Server
PORT=5000                                      # Backend server port
NODE_ENV=development                           # Environment mode

# Frontend
FRONTEND_URL=http://localhost:3000            # Frontend URL for CORS

# Email (Resend)
RESEND_API_KEY=re_...                         # Resend API key for emails
RESEND_FROM_EMAIL=notifications@...           # From email address

# Cloud Storage (Cloudflare R2)
R2_ACCOUNT_ID=...                             # R2 account ID
R2_ACCESS_KEY_ID=...                          # R2 access key
R2_SECRET_ACCESS_KEY=...                      # R2 secret key
R2_BUCKET=...                                 # R2 bucket name
R2_PUBLIC_BASE_URL=https://...                # R2 public URL
```

## Team Collaboration

### Sharing the Database

Since the project uses MongoDB Atlas:
- All team members connect to the same cloud database
- No need to run local MongoDB instances
- Data is automatically synced across all developers
- Share the Atlas connection string securely (not in git)

### Best Practices

1. **Never commit `.env` files** - They contain sensitive credentials
2. **Use separate Atlas clusters** for development, staging, and production
3. **Create individual database users** for each team member if needed
4. **Regularly backup data** using Atlas automated backups
5. **Monitor usage** in Atlas dashboard to stay within free tier limits (512MB)
