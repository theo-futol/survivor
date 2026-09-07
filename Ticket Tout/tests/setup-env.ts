// Jest loads no .env file, and `lib/services/auth_service` reads JWT_SECRET at
// import time — an empty secret makes every jose signature throw "Zero-length
// key is not supported" before a single assertion runs. The values below are
// fixed fakes: the unit tests sign and verify their own tokens, they never talk
// to a deployment. `??=` keeps CI's real secret (ci.yml passes it in the env).
process.env['JWT_SECRET'] ??= 'unit-tests-jwt-secret-not-a-real-one';
process.env['JWT_TTL_SECONDS'] ??= '1800';
