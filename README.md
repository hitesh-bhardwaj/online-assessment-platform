# Online Assessment Platform

A secure and scalable multi-tenant SaaS platform for conducting online assessments with proctoring capabilities. Built with Node.js, Express, Next.js, and MongoDB Atlas.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- MongoDB Atlas account (free tier available at [mongodb.com/atlas](https://mongodb.com/atlas))
- Git

### Setup Instructions

1. **Clone the repository:**
```bash
git clone https://github.com/your-org/online-assessment-platform.git
cd online-assessment-platform
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Set up MongoDB Atlas:**
   - Create a free MongoDB Atlas account at [mongodb.com/atlas](https://mongodb.com/atlas)
   - Create a new cluster (M0 free tier is sufficient for development)
   - Create a database user with read/write permissions
   - Get your connection string from the Atlas dashboard
   - Whitelist your IP address (or use 0.0.0.0/0 for development)

5. **Configure environment variables:**
```bash
cd ../backend
cp ../.env.example .env
# Edit .env and add your MongoDB Atlas connection string
```

Update the following in `backend/.env`:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/assessment_platform?retryWrites=true&w=majority&appName=<your-app-name>
```

6. **Test database connection:**
```bash
cd backend
node test-atlas-connection.js
```

7. **Start the development servers:**

Backend (from `backend/` directory):
```bash
npm run dev
```

Frontend (from `frontend/` directory):
```bash
npm run dev
```

The backend will run on `http://localhost:5000` and frontend on `http://localhost:3000`.

## 📁 Project Structure

