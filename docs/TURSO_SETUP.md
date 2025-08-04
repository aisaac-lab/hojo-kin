# Turso Database Setup for Render Deployment

This guide explains how to set up Turso database for deploying the Subsidy Search MVP on Render.

## Why Turso?

Turso provides:
- Embedded replicas for fast local reads
- Automatic synchronization with the remote database
- Better performance than remote SQLite connections
- Built-in support for edge deployments

## Setup Steps

### 1. Create a Turso Account

1. Sign up at [turso.tech](https://turso.tech)
2. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

### 2. Create a Database

```bash
# Login to Turso
turso auth login

# Create a new database
turso db create subsidy-search-mvp

# Get the database URL
turso db show subsidy-search-mvp

# Create an auth token
turso db tokens create subsidy-search-mvp
```

### 3. Set Environment Variables

Copy the database URL and auth token from the previous steps:

```bash
# In your .env file (local development)
TURSO_DATABASE_URL="libsql://subsidy-search-mvp-[your-org].turso.io"
TURSO_AUTH_TOKEN="your-auth-token"
```

### 4. Initialize the Database

Run the setup script to create tables in your Turso database:

```bash
pnpm run turso:setup
```

### 5. Configure Render

In your Render dashboard:

1. Go to your web service settings
2. Add the following environment variables:
   - `TURSO_DATABASE_URL`: Your Turso database URL
   - `TURSO_AUTH_TOKEN`: Your Turso auth token
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `OPENAI_ASSISTANT_ID`: Your OpenAI Assistant ID
   - Other required environment variables from `.env.example`

3. Update the build command (if needed):
   ```bash
   pnpm install && pnpm run build
   ```

4. Deploy!

## Local Development

For local development, you can either:

1. **Use Turso** (recommended for testing production-like setup):
   - Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your `.env`
   - The app will automatically use Turso with embedded replicas

2. **Use local SQLite** (default):
   - Don't set Turso environment variables
   - The app will use `DATABASE_URL` for a local SQLite file

## Troubleshooting

### "Table not found" errors
Run `pnpm run turso:setup` to create the required tables.

### Connection errors
- Verify your Turso credentials are correct
- Check that your database is active in the Turso dashboard
- Ensure your auth token has the correct permissions

### Performance issues
- Turso uses embedded replicas by default
- Adjust `syncInterval` in `app/db/index.ts` if needed (default: 60 seconds)

## Migration from Local SQLite

If you have existing data in a local SQLite database:

1. Export your data (create a backup script if needed)
2. Run `pnpm run turso:setup` to create tables
3. Import your data to Turso using the Turso CLI or a custom script

## Additional Resources

- [Turso Documentation](https://docs.turso.tech)
- [Turso with Render Guide](https://docs.turso.tech/features/embedded-replicas/with-render)
- [Drizzle ORM with Turso](https://orm.drizzle.team/docs/get-started-sqlite#turso)