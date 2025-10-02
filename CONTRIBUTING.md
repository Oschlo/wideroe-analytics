# Contributing to Widerøe Analytics

## Development Workflow

### 1. Setup Development Environment

```bash
# Clone repository
git clone https://github.com/oschlo/wideroe-analytics.git
cd wideroe-analytics

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### 2. Making Changes

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# Test locally

# Commit changes
git add .
git commit -m "feat: your feature description"

# Push to GitHub
git push origin feature/your-feature-name
```

### 3. Pull Request

1. Open PR on GitHub
2. Ensure all checks pass
3. Request review
4. Address feedback
5. Merge when approved

## Code Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Add proper type annotations
- Use interfaces for data structures

### React Components

- Use functional components with hooks
- Prefer server components when possible
- Extract reusable logic into custom hooks
- Keep components small and focused

### Naming Conventions

- **Files**: kebab-case (`monitoring-page.tsx`)
- **Components**: PascalCase (`MonitoringDashboard`)
- **Functions**: camelCase (`fetchMonitoring`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Git Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Adding tests
- `chore:` Maintenance tasks

Example:
```
feat: add real-time monitoring dashboard

- Create /admin/monitoring page
- Add API route for data source status
- Implement auto-refresh every 60 seconds
- Display health indicators for all sources
```

## Testing

### Manual Testing

```bash
# Test Edge Functions locally
supabase start
supabase functions serve ingest-met-weather

# Test specific endpoint
curl -X POST http://localhost:54321/functions/v1/ingest-met-weather
```

### Production Testing

```bash
# Test production endpoints
curl https://epokqlkkiknvhromsufb.supabase.co/functions/v1/ingest-met-weather
```

## Documentation

- Update README.md for major changes
- Document new features in docs/
- Add inline comments for complex logic
- Update IMPLEMENTATION_STATUS.md

## Deployment

### Automatic Deployments

- **main branch**: Auto-deploys to production (Vercel)
- **Pull requests**: Preview deployments

### Manual Deployments

```bash
# Vercel (Frontend)
vercel --prod

# Supabase Edge Functions
supabase functions deploy function-name
```

## API Keys & Secrets

**NEVER commit API keys or secrets!**

- Use `.env.local` for local development
- Set production secrets in:
  - Vercel Dashboard (frontend)
  - Supabase Dashboard (edge functions)
  - GitHub Secrets (automation)

## Questions?

Contact: fredrik@oschlo.co
