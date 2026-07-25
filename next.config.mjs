/** @type {import('next').NextConfig} */
const nextConfig = {
  // Export 100% estático: os dados quase não mudam, então TODAS as páginas
  // (inclusive as ~600 de políticos) são pré-renderizadas no build.
  // O resultado em `out/` pode ser servido por qualquer CDN com cache imutável.
  output: 'export',
  images: { unoptimized: true }, // sem servidor de otimização em runtime
  trailingSlash: true,           // URLs estáveis p/ hospedagem estática
};

export default nextConfig;
