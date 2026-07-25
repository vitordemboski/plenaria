/**
 * Retrato do político: a foto oficial da casa quando existe. Sem foto, cai numa
 * silhueta com coloração determinística derivada do slug — assim cada político
 * tem "sua cara" estável entre builds, em vez de um buraco cinza.
 */
export function Portrait({ slug, tag, height = 180, fotoUrl }: {
  slug: string;
  tag?: string;
  height?: number;
  /** foto oficial da casa — quando presente, substitui a silhueta */
  fotoUrl?: string;
}) {
  if (fotoUrl) {
    return (
      <div className="portrait" style={{ height }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* altura em px explícita: height:100% em item de grid resolve para o
            tamanho natural da imagem e estoura o box (aprendido na prática) */}
        <img src={fotoUrl} alt="" loading="lazy"
          style={{ height: height - 2, width: 'auto', display: 'block' }} />
        {tag && <span className="frame-tag">{tag}</span>}
      </div>
    );
  }
  // hash simples e estável → matiz da silhueta e do fundo
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  const skin = `hsl(${hue}, 26%, 42%)`;
  const bgA = `hsl(${hue}, 30%, 22%)`;
  const bgB = `hsl(${(hue + 40) % 360}, 24%, 12%)`;

  return (
    <div
      className="portrait"
      style={{ height, background: `radial-gradient(90% 70% at 50% 20%, ${bgA}, ${bgB} 70%)` }}
    >
      <svg width={height * 0.6} height={height * 0.78} viewBox="0 0 120 150" fill="none" aria-hidden>
        <circle cx="60" cy="46" r="30" fill={skin} />
        <path d="M12 150c0-33 22-52 48-52s48 19 48 52z" fill={skin} />
      </svg>
      {tag && <span className="frame-tag">{tag}</span>}
    </div>
  );
}
