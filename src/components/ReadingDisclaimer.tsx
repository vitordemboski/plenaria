/**
 * Disclaimer de leitura — a moldura editorial do produto: os atributos medem
 * ESFORÇO/ENTREGA, nunca o mérito da posição política (é por isso que
 * Fiscalização e Alinhamento são informativos). Texto estático, exibido na
 * home (antes da Tier List) e no topo de cada carta. Copiar/colar essa frase
 * em dois lugares abriria brecha p/ divergência — por isso vive num só componente.
 * A versão longa da metodologia está em /como-calculamos.
 */
export function ReadingDisclaimer({ className = '' }: { className?: string }) {
  return (
    <aside className={`carta-disclaimer${className ? ` ${className}` : ''}`} role="note">
      <b>⚖️ Estes números medem esforço, não o mérito da causa.</b>{' '}
      Avaliam presença, produção e entrega — o quanto o parlamentar se empenha em cumprir o
      mandato. Não julgamos se aquilo que ele vota ou aprova ajuda o país; mostramos o empenho
      dele em entregar aquilo em que acredita.
    </aside>
  );
}
