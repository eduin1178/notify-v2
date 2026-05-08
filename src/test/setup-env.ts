const env = process.env as Record<string, string | undefined>;

env.DATABASE_URL ??= "postgres://test:test@localhost:5432/notify_test";
env.ENCRYPTION_KEY_V1 ??= "LPwAfCwXOEO4XcipVDFoerE8Ew5vyDbcrWhL/WW7OEg=";
env.NODE_ENV ??= "test";
