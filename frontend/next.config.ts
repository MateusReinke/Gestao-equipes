import type { NextConfig } from 'next';

/**
 * Cabeçalhos de segurança aplicados a toda resposta.
 *
 * Não há CSP aqui: o Next injeta scripts com nonce próprio, e uma CSP escrita à
 * mão quebraria a hidratação. Fica como item explícito do hardening para quando
 * o nonce for propagado pelo middleware.
 */
const securityHeaders = [
  // Impede o navegador de "adivinhar" o tipo do conteúdo e executar um arquivo
  // de dados como script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // O app não deve ser embutido em iframe: fecha a porta para clickjacking.
  { key: 'X-Frame-Options', value: 'DENY' },
  // A URL do painel carrega identificadores; não vazam para terceiros.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nada aqui usa câmera, microfone, localização ou pagamento.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // Não anuncia a versão do Next para quem estiver mapeando o alvo.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
