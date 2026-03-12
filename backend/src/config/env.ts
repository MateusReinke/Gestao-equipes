import dotenv from 'dotenv';

dotenv.config();

export const env = {
  appPort: Number(process.env.APP_PORT || 4000),
  appEnv: process.env.APP_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'change_me',
};
