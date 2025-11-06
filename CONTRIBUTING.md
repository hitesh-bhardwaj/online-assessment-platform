# Contributing to Online Assessment Platform

Thank you for considering contributing to our project! This guide will help you get started.

## Quick Start for New Contributors

1. **Read the documentation**:
   - [`README.md`](./README.md) - Project overview and quick start
   - [`DEVELOPMENT.md`](./DEVELOPMENT.md) - Development setup guide
   - [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Deployment instructions

2. **Set up your development environment**:
   ```bash
   # Clone the repository
   git clone https://github.com/YOUR_USERNAME/online-assessment-platform.git
   cd online-assessment-platform

   # Install dependencies
   cd backend && npm install
   cd ../frontend && npm install

   # Set up environment variables
   cd ../backend
   cp ../.env.example .env
   # Edit .env with your MongoDB Atlas connection string

   # Start development servers
   cd backend && npm run dev  # Terminal 1
   cd frontend && npm run dev # Terminal 2
   ```

3. **Get MongoDB Atlas connection string**:
   - Ask the team lead for the shared development database connection string
   - Or create your own free Atlas cluster for testing
   - Add it to `backend/.env`

## Development Workflow

### 1. Pick an Issue

- Browse [open issues](https://github.com/YOUR_USERNAME/online-assessment-platform/issues)
- Look for issues labeled `good first issue` or `help wanted`
- Comment on the issue to claim it

### 2. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Build/tooling changes

### 3. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add comments for complex logic
- Update documentation as needed

### 4. Test Your Changes

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```

### 5. Commit Your Changes

Use conventional commit messages:

```bash
git commit -m "feat: add new proctoring feature"
git commit -m "fix: resolve login authentication bug"
git commit -m "docs: update API documentation"
```

Commit message format:
```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding tests
- `chore` - Build/tooling changes
- `perf` - Performance improvements

### 6. Push and Create Pull Request

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- Clear title describing the change
- Description of what changed and why
- Reference to related issues (e.g., "Closes #123")
- Screenshots for UI changes

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code (`.ts` and `.tsx` files)
- Define proper types/interfaces, avoid `any`
- Use type inference where obvious
- Export types when they're reused

```typescript
// Good
interface User {
  id: string;
  email: string;
  role: 'admin' | 'recruiter';
}

function getUser(id: string): Promise<User> {
  // ...
}

// Bad
function getUser(id: any): any {
  // ...
}
```

### React Components

- Use functional components with hooks
- Keep components small and focused (< 200 lines)
- Use descriptive component names
- Extract complex logic into custom hooks

```typescript
// Good
function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading } = useUser(userId);

  if (isLoading) return <Skeleton />;
  return <div>{data.name}</div>;
}

// Bad
function Component({ id }: any) {
  // 500 lines of code...
}
```

### File Structure

- Frontend: Feature-based structure in `src/features/`
- Backend: MVC pattern with `controllers/`, `models/`, `routes/`
- Shared utilities in `utils/` or `lib/`

### Formatting

- Use Prettier (configured in `.prettierrc`)
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Run `npm run lint:fix` before committing

## Testing Guidelines

### Unit Tests

Test individual functions and components:

```typescript
// backend/src/utils/__tests__/email.test.ts
describe('sendEmail', () => {
  it('should send email successfully', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Hello'
    });
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests

Test API endpoints:

```typescript
// backend/src/routes/__tests__/auth.test.ts
describe('POST /api/auth/login', () => {
  it('should login with valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'password' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### E2E Tests

Test critical user flows (when implemented):

```typescript
// frontend/e2e/assessment-flow.spec.ts
test('candidate can complete assessment', async ({ page }) => {
  await page.goto('/candidate/invitations/token123');
  await page.click('text=Start Assessment');
  // ... complete assessment steps
  await page.click('text=Submit');
  await expect(page).toHaveURL('/candidate/sessions/*/complete');
});
```

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Self-review of code completed
- [ ] Comments added for complex logic
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] No console.logs or debugging code
- [ ] Types are properly defined

### PR Template

Use this template for pull requests:

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Testing
- [ ] Tested locally
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No breaking changes (or documented)
```

### Review Process

1. CI/CD checks must pass
2. At least one approving review required
3. Address all review comments
4. Maintain clean git history (squash if needed)

## Project-Specific Guidelines

### Backend Development

- All routes must have authentication middleware
- Validate input with Zod schemas
- Log important operations to SystemLog model
- Handle errors with proper HTTP status codes
- Use MongoDB transactions for multi-document operations

Example route:
```typescript
router.post(
  '/assessments',
  authenticate,
  authorize(['admin', 'recruiter']),
  validate(createAssessmentSchema),
  assessmentController.create
);
```

### Frontend Development

- Use React Query for data fetching
- Implement optimistic updates where appropriate
- Show loading states for async operations
- Handle errors gracefully with toast notifications
- Use Tailwind CSS for styling (no custom CSS unless necessary)

Example:
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['assessments', filters],
  queryFn: () => fetchAssessments(filters)
});

if (isLoading) return <Skeleton />;
if (error) return <ErrorState error={error} />;
```

### Database

- Use proper indexes for query performance
- Follow multi-tenant data isolation (filter by organizationId)
- Don't modify schema without team discussion
- Test migrations locally before deploying

### Security

- Never commit secrets or API keys
- Sanitize user input
- Use parameterized queries (Mongoose handles this)
- Implement rate limiting for public endpoints
- Validate JWT tokens on protected routes

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue with reproduction steps
- **Security**: Email security@example.com (not public issues)
- **Chat**: Join our Discord/Slack (if available)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Give constructive feedback
- Focus on what's best for the project

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (when available)

Thank you for contributing! 🎉

