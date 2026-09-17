/**
 * local server entry file, for local development
 */
import app from './app.js';
import { connectToDatabase } from './db/mongoose.js';
import { startCleanupJob, stopCleanupJob } from './services/cleanupJob.js';
import { initSocket } from './services/socket.js';
import http from 'http';
import { startMetricsHeartbeat } from './services/metrics.js';

/**
 * start server with port
 */
const PORT = process.env.PORT || 3001;

let server: any;

connectToDatabase().then(() => {
  console.log('Connected to Database');
  
  const httpServer = http.createServer(app);
  initSocket(httpServer);
  
  server = httpServer.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
    startCleanupJob();
    startMetricsHeartbeat();
  });
}).catch(err => {
  console.error('Failed to connect to Database', err);
  process.exit(1);
});

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  if (server) {
    stopCleanupJob();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  if (server) {
    stopCleanupJob();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;
