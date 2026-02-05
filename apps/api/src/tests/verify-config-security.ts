
try {
  // We need to bypass the cache if we were running in the same process,
  // but since we'll run this as a child process, a simple import is enough.
  const { config } = require('../config/environment');
  console.log('Config loaded successfully');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
