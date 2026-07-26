import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

/// Lista separada por vírgula, ignorando entradas vazias.
function parseList(value?: string): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  appPort: Number(process.env.APP_PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: requireEnv('JWT_SECRET'),
  /// Origens liberadas para chamar a API direto do navegador.
  /// Vazio (padrão) = nenhuma: o frontend fala com a API pelo servidor.
  corsOrigins: parseList(process.env.CORS_ORIGINS),
};
