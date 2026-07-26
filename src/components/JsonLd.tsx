/**
 * Emite um bloco JSON-LD. Server Component puro — o objeto é serializado no
 * build, sem JS no cliente.
 *
 * `</` escapado porque um "</script>" dentro de uma string do JSON fecharia a
 * tag mais cedo e quebraria a página.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
