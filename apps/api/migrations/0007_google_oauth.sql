-- Enable Google OAuth by ensuring the account table can uniquely identify a
-- linked provider account. Better Auth uses this composite key for account
-- linking and upserts during the OAuth callback.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'account_provider_account_unique'
      AND conrelid = '"account"'::regclass
  ) THEN
    ALTER TABLE "account"
      ADD CONSTRAINT account_provider_account_unique
      UNIQUE ("accountId", "providerId");
  END IF;
END $$;
