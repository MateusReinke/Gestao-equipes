process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-unit-tests';

/// Chave de teste do módulo de diretório. Precisa existir antes de
/// `config/env` ser importado, porque o objeto `env` é montado na importação.
process.env.DIRECTORY_ENCRYPTION_KEY =
  process.env.DIRECTORY_ENCRYPTION_KEY || 't6mv4evs/ocQxzm7hHq2gEW2GvRnX5zv44KDEY0rfms=';
process.env.ENABLE_ENTRA_SYNC = process.env.ENABLE_ENTRA_SYNC || 'true';
