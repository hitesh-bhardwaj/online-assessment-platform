# Deployment Guide

This guide covers deploying the Online Assessment Platform to production.

## Architecture Overview

- **Frontend**: Next.js application → Deploy to **Vercel**
- **Backend**: Node.js/Express API → Deploy to **Railway** / **Render** / **AWS**
- **Database**: MongoDB Atlas (already configured)
- **Storage**: Cloudflare R2 (for proctoring media)
- **Email**: Resend API (for notifications)

---

## Frontend Deployment (Vercel)

### Prerequisites
- GitHub account
- Vercel account (free tier available)
- Backend API deployed and accessible

### Step 1: Push to GitHub

```bash
# Create a new repository on GitHub (e.g., online-assessment-platform)
# Then push your code:

git remote add origin https://github.com/YOUR_USERNAME/online-assessment-platform.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm install`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-api.com
   ```

6. Click "Deploy"

### Step 3: Configure Custom Domain (Optional)

1. In Vercel dashboard → Project Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed

### Vercel Environment Variables

Add these in Vercel dashboard → Project Settings → Environment Variables:

```env
# Required
NEXT_PUBLIC_API_URL=https://your-backend-api.railway.app

# Optional (if using different values for production)
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

---

## Backend Deployment Options

### Option 1: Railway (Recommended for Beginners)

**Pros**: Simple, generous free tier, automatic deployments, built-in PostgreSQL/MongoDB
**Cons**: Paid plans required for production

#### Steps:

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect Node.js project

5. **Configure Build Settings**:
   - Root Directory: `backend`
   - Build Command: `npm install && npx tsc`
   - Start Command: `node dist/index.js`
   - Watch Paths: `backend/**`

6. **Add Environment Variables** (see section below)

7. Click "Deploy"

8. Copy your Railway app URL (e.g., `https://your-app.up.railway.app`)

9. **Update Frontend**: Update `NEXT_PUBLIC_API_URL` in Vercel with your Railway URL

#### Railway Environment Variables:

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/assessment_platform?retryWrites=true&w=majority
MONGODB_ATLAS_URI=mongodb+srv://user:pass@cluster.mongodb.net/assessment_platform?retryWrites=true&w=majority

# Server
PORT=5000
NODE_ENV=production

# Frontend
FRONTEND_URL=https://your-frontend.vercel.app

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_EXPIRES_IN=24h

# Resend Email
RESEND_API_KEY=re_your_resend_api_key
RESEND_FROM_EMAIL=notifications@yourdomain.com

# Cloudflare R2
R2_ACCOUNT_ID=your_r2_account_id
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_BUCKET=your_bucket_name
R2_PUBLIC_BASE_URL=https://your-bucket.r2.dev

# Proctoring
ENABLE_PROCTORING_CLEANUP=true
PROCTORING_MEDIA_RETENTION_MINUTES=129600
PROCTORING_CLEANUP_INTERVAL_MINUTES=60
PROCTORING_MEDIA_CLEANUP_DRY_RUN=false
```

---

### Option 2: Render

**Pros**: Free tier, automatic deployments, simple configuration
**Cons**: Free tier has cold starts (slow initial response)

#### Steps:

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: online-assessment-backend
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Root Directory**: `backend`
   - **Runtime**: Node
   - **Build Command**: `npm install && npx tsc`
   - **Start Command**: `node dist/index.js`

5. Choose plan (Free tier available)
6. Add Environment Variables (same as Railway above)
7. Click "Create Web Service"

---

### Option 3: AWS Elastic Beanstalk (Production-Ready)

**Pros**: Scalable, full AWS integration, production-grade
**Cons**: More complex, requires AWS knowledge

#### Steps:

1. Install AWS CLI and EB CLI:
   ```bash
   pip install awsebcli
   ```

2. Initialize EB in backend directory:
   ```bash
   cd backend
   eb init -p node.js-18 online-assessment-platform
   ```

3. Create environment:
   ```bash
   eb create production-env
   ```

4. Set environment variables:
   ```bash
   eb setenv MONGODB_URI=xxx FRONTEND_URL=xxx JWT_SECRET=xxx ...
   ```

5. Deploy:
   ```bash
   eb deploy
   ```

6. Open application:
   ```bash
   eb open
   ```

---

### Option 4: DigitalOcean App Platform

**Pros**: Simple, predictable pricing, good performance
**Cons**: Paid service (no free tier)

#### Steps:

1. Go to [cloud.digitalocean.com/apps](https://cloud.digitalocean.com/apps)
2. Create App → GitHub
3. Select repository and branch
4. Configure:
   - **Source Directory**: `backend`
   - **Build Command**: `npm install && npx tsc`
   - **Run Command**: `node dist/index.js`
   - **HTTP Port**: 5000

5. Add environment variables
6. Choose plan (starts at $5/month)
7. Launch App

---

## Database (MongoDB Atlas)

Your MongoDB Atlas is already configured. For production:

1. **Security**:
   - Update IP Whitelist in Atlas dashboard
   - Add your backend server's IP address
   - Or use `0.0.0.0/0` (less secure, but works everywhere)

2. **Backup**:
   - Enable automated backups in Atlas (free tier includes)
   - Schedule: Daily backups with 7-day retention

3. **Monitoring**:
   - Set up Atlas alerts for high CPU, memory, or connection usage
   - Monitor slow queries in Atlas Performance Advisor

---

## Email (Resend)

1. Sign up at [resend.com](https://resend.com)
2. Verify your domain or use `onboarding@resend.dev` for testing
3. Get your API key from dashboard
4. Add to backend environment variables:
   ```env
   RESEND_API_KEY=re_your_api_key
   RESEND_FROM_EMAIL=notifications@yourdomain.com
   ```

---

## Storage (Cloudflare R2)

1. Sign up at [cloudflare.com](https://www.cloudflare.com/products/r2/)
2. Create R2 bucket
3. Get Account ID, Access Key, and Secret Key
4. Configure public access URL
5. Add to backend environment variables

---

## CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend
```

---

## Environment Variables Checklist

### Frontend (.env.local for development)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### Backend (.env for development, Cloud provider dashboard for production)
```env
# Database
MONGODB_URI=mongodb+srv://...
MONGODB_ATLAS_URI=mongodb+srv://...

# Server
PORT=5000
NODE_ENV=production

# Frontend URL
FRONTEND_URL=https://your-frontend.vercel.app

# Security
JWT_SECRET=your-secret-min-32-chars
JWT_EXPIRES_IN=24h

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=notifications@yourdomain.com

# Storage
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_PUBLIC_BASE_URL=https://...

# Proctoring
ENABLE_PROCTORING_CLEANUP=true
PROCTORING_MEDIA_RETENTION_MINUTES=129600
PROCTORING_CLEANUP_INTERVAL_MINUTES=60
PROCTORING_MEDIA_CLEANUP_DRY_RUN=false
```

---

## Post-Deployment Checklist

- [ ] Frontend is accessible at your Vercel URL
- [ ] Backend API responds to health check: `https://your-backend.com/health`
- [ ] Database connection is working (check backend logs)
- [ ] Email notifications are being sent
- [ ] File uploads to R2 are working
- [ ] CORS is configured correctly (Frontend can access Backend)
- [ ] Environment variables are all set correctly
- [ ] MongoDB Atlas IP whitelist includes backend server
- [ ] Custom domains are configured (if applicable)
- [ ] SSL/HTTPS is working on both frontend and backend
- [ ] Monitoring and logging is set up
- [ ] Backup strategy is in place

---

## Monitoring & Logging

### Backend Logs
- **Railway**: Built-in logs in dashboard
- **Render**: View logs in service dashboard
- **AWS**: CloudWatch logs

### Frontend
- **Vercel**: Built-in analytics and logs
- **Sentry**: Add for error tracking (optional)

### Database
- **MongoDB Atlas**: Performance advisor and slow query logs

---

## Scaling Considerations

### When to Scale

Scale when you experience:
- Slow API response times (>1s)
- High database CPU usage (>80%)
- Frequent cold starts
- Memory limits reached

### How to Scale

1. **Backend**:
   - Railway: Upgrade plan for more resources
   - Render: Upgrade to paid tier for no cold starts
   - AWS: Enable auto-scaling in Elastic Beanstalk

2. **Database**:
   - MongoDB Atlas: Upgrade from M0 (free) to M10+ for more storage/RAM
   - Enable sharding for very large datasets

3. **Frontend**:
   - Vercel automatically scales
   - Add Vercel Analytics for monitoring

---

## Cost Estimates

### Free Tier (Development/Testing)
- Frontend (Vercel): Free
- Backend (Railway): $5/month (with $5 free credit)
- Backend (Render): Free (with cold starts)
- Database (MongoDB Atlas): Free (512MB)
- Storage (Cloudflare R2): 10GB free
- Email (Resend): 100 emails/day free

**Total**: $0-5/month

### Production (Small Scale)
- Frontend (Vercel Pro): $20/month
- Backend (Railway): $10-20/month
- Database (Atlas M10): $0.08/hour (~$57/month)
- Storage (R2): ~$0.015/GB stored + egress
- Email (Resend): $20/month for 50K emails

**Total**: ~$107-120/month

---

## Troubleshooting

### Frontend can't connect to backend
- Check CORS configuration in backend
- Verify NEXT_PUBLIC_API_URL is correct
- Ensure backend is deployed and running

### Database connection errors
- Check MongoDB Atlas IP whitelist
- Verify connection string is correct
- Ensure database user has proper permissions

### Email not sending
- Verify Resend API key
- Check domain verification in Resend dashboard
- Look at backend logs for error messages

### File uploads failing
- Verify R2 credentials
- Check R2 bucket permissions
- Ensure R2_PUBLIC_BASE_URL is correct

---

## Security Best Practices

1. **Never commit `.env` files** - Use environment variables in hosting platforms
2. **Use strong JWT secrets** - Minimum 32 random characters
3. **Enable MongoDB Atlas IP whitelist** - Don't use 0.0.0.0/0 in production
4. **Use HTTPS everywhere** - Vercel and Railway provide this automatically
5. **Rate limiting** - Add rate limiting middleware to protect APIs
6. **Regular updates** - Keep dependencies updated (`npm audit fix`)
7. **Monitoring** - Set up alerts for errors and performance issues

---

## Support

For deployment issues:
- **Vercel**: https://vercel.com/docs
- **Railway**: https://docs.railway.app
- **Render**: https://render.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com

For application issues:
- Check application logs in hosting platform
- Review DEVELOPMENT.md for local debugging
- Check GitHub issues for known problems
