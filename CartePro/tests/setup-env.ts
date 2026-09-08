// JWT_SECRET is read at module load time by lib/services/auth_service.ts, so it
// must exist before any route or service is imported — hence setupFiles rather
// than setupFilesAfterEach. A value supplied by the environment wins, so the
// suite can still be run against a real secret.
process.env['JWT_SECRET'] ||= 'test-jwt-secret';
