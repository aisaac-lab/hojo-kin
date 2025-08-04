# Render Deployment Guide

This guide explains how to deploy the Subsidy Search MVP to Render with Turso database.

## Prerequisites

1. A Render account
2. A Turso account with database created (see [TURSO_SETUP.md](./TURSO_SETUP.md))
3. An OpenAI API key and Assistant ID
4. This repository connected to your GitHub account

## Step 1: Create a New Web Service on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `subsidy-search-mvp` (or your preferred name)
   - **Region**: Choose the closest to your users
   - **Branch**: `main` or `develop`
   - **Runtime**: Node
   - **Build Command**: `pnpm install && pnpm run build`
   - **Start Command**: `pnpm start`

## Step 2: Configure Environment Variables

In the Render service settings, add the following environment variables:

### Required Variables

```bash
# Turso Database (from turso db show and turso db tokens create)
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
OPENAI_ASSISTANT_ID=your-assistant-id
OPENAI_VECTOR_STORE_ID=your-vector-store-id

# Node Environment
NODE_ENV=production
```

### Optional Variables (with defaults)

```bash
# Review Agent Configuration
OPENAI_REVIEW_MODEL=gpt-4-turbo-preview
REVIEW_SCORE_THRESHOLD=70

# Validation Agent Configuration
MAX_VALIDATION_LOOPS=3
SCORE_IMPROVEMENT_THRESHOLD=10
ENABLE_PROGRESSIVE_HINTS=true
ENABLE_FAILURE_ANALYSIS=true
ENABLE_VALIDATION_LOGGING=true
```

## Step 3: Deploy

1. Click "Create Web Service" or "Deploy" if updating
2. Render will automatically:
   - Clone your repository
   - Install dependencies with `pnpm install`
   - Build the project with `pnpm run build`
   - Start the server with `pnpm start`

## Step 4: Initialize Database

After the first deployment:

1. Open the Render shell (in service settings)
2. Run the database setup:
   ```bash
   pnpm run turso:setup
   ```
3. Sync subsidies data:
   ```bash
   pnpm run sync:subsidies
   ```

## Step 5: Verify Deployment

1. Visit your Render service URL
2. Test the chat interface
3. Check logs for any errors

## Troubleshooting

### Build Failures

If the build fails:
- Check that all dependencies are in `package.json`
- Verify Node version compatibility (requires Node 18+)
- Check build logs for specific errors

### Runtime Errors

If the app crashes after deployment:
- Check environment variables are set correctly
- Verify Turso database connection
- Check application logs in Render dashboard

### Database Connection Issues

If you see database errors:
- Verify Turso credentials
- Run `pnpm run turso:setup` in Render shell
- Check that tables were created successfully

### Performance Issues

For better performance:
- Turso embedded replicas are enabled by default
- Consider upgrading your Render instance type
- Monitor response times in logs

## Monitoring

Render provides:
- Real-time logs
- Metrics dashboard
- Automatic HTTPS
- Health checks

Configure health checks by adding to render.yaml:
```yaml
healthCheckPath: /api/health
```

## Updates and Rollbacks

### Automatic Deployments
- Render auto-deploys on push to your configured branch
- Use pull requests for staging deployments

### Manual Rollbacks
1. Go to your service dashboard
2. Click "Events" tab
3. Find a previous successful deploy
4. Click "Rollback to this deploy"

## Cost Optimization

To minimize costs:
- Use Turso's free tier (up to 500 databases)
- Start with Render's free tier
- Enable auto-sleep for development instances
- Monitor usage in both Turso and Render dashboards

## Security Best Practices

1. Never commit `.env` files
2. Use Render's secret management for sensitive data
3. Enable 2FA on both Render and Turso accounts
4. Regularly rotate API keys and tokens
5. Monitor logs for suspicious activity

## Next Steps

After successful deployment:
1. Set up custom domain (optional)
2. Configure monitoring alerts
3. Set up backup procedures
4. Plan for scaling if needed