/**
 * Textos do resultado de 2026, num lugar só: a ficha, os cards, o filtro, a imagem do
 * ShareButton e o card OG dizem a MESMA frase. O site importa daqui (src/lib/eleicao.ts)
 * e o make-og.mjs também — duas cópias divergiriam calado.
 *
 * Duas regras de redação:
 * - `fim-de-mandato` NUNCA vira "não se candidatou": o que se sabe é que o nome não está
 *   entre os eleitos, e o cruzamento pode ter falhado em achar a candidatura.
 * - Suplente é "ficou como suplente", não "perdeu": pode assumir se um titular sair.
 */

const PLEITO = '04/10/2026';
const SEGUNDO_TURNO = '25/10/2026';

export function dataBR(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso ?? '');
}

/** "eleito"/"eleita"/"eleito(a)" — `sexo` ausente não chuta. */
const flex = (base, sexo) => (sexo === 'F' ? `${base}a` : sexo === 'M' ? `${base}o` : `${base}o(a)`);

/** Artigo do cargo do vocabulário fechado de lib/candidatura.mjs. */
const FEMININOS = /^(Câmara|Assembleia|Presidência|Vice-presidência)/;
const comArtigo = (cargo) => `${FEMININOS.test(cargo) ? 'a' : 'o'} ${cargo}`;
const casaComArtigo = (casa) => (casa === 'camara' ? 'a Câmara' : 'o Senado');
const outraCasa = (casa) => (casa === 'camara' ? 'o Senado' : 'a Câmara');
const ehSuplenteSen = (e) => e.curto === 'Suplente';

/**
 * Chip curto dos cards de lista (~390px). Só para quem MUDA de lugar: quem fica ou
 * segue não ganha chip — a lista seria um mar de rótulos iguais.
 * @returns {string|null}
 */
export function chipCurto(e, casa) {
  if (!e) return null;
  if (e.destino === 'sai') return '🚪 Sai em 2027';
  if (e.destino === 'muda') return casa === 'camara' ? '↪ Vai ao Senado' : '↪ Vai à Câmara';
  if (e.destino === 'pendente') return '⏳ 2º turno';
  return null;
}

/** Por que sai, sem o prefixo — o que as listas da aba Eleições mostram (o título do
 *  painel já diz que todos saem). */
export function motivoSaida(e, sexo) {
  const eleito = flex('eleit', sexo);
  if (e.motivo === 'nao-reeleito') return e.situacao === 'suplente' ? 'ficou como suplente' : `não ${flex('reeleit', sexo)}`;
  if (e.motivo === 'outro-cargo' && e.cargo) {
    if (e.situacao === 'eleito') return ehSuplenteSen(e) ? `${eleito} suplente de senador` : `${eleito} para ${comArtigo(e.cargo)}`;
    if (e.situacao === 'segundo-turno') return `2º turno para ${comArtigo(e.cargo)}`;
    return `disputou ${comArtigo(e.cargo)}`;
  }
  return 'mandato termina em 2027';
}

/** Resumo de uma linha — o chip da ficha e a linha da imagem compartilhável. */
export function resumo(e, casa, sexo) {
  const eleito = flex('eleit', sexo);
  switch (e.destino) {
    case 'fica': return `${flex('Reeleit', sexo)} para ${casaComArtigo(casa)}`;
    case 'muda': return `${eleito[0].toUpperCase()}${eleito.slice(1)} para ${outraCasa(casa)}`;
    case 'segue': return `Mandato segue até ${dataBR(e.fimMandato).slice(-4) || '2031'}`;
    case 'pendente': return `2º turno para ${comArtigo(e.cargo)}`;
    default: return `Fora da próxima legislatura · ${motivoSaida(e, sexo)}`;
  }
}

/** Frase completa: tooltip dos chips e linha do relatório da ficha. */
export function explica(e, casa, sexo) {
  const eleito = flex('eleit', sexo);
  const fonte = ` Fonte: resultado do TSE, arquivo de ${dataBR(e.resultadoEm)}. Informativo: não pontua no Poder nem gera título.`;
  const senadoAte2031 = casa === 'senado' && String(e.fimMandato ?? '') > '2027-02-01';
  let f;
  switch (e.destino) {
    case 'fica':
      f = `${flex('Reeleit', sexo)} para ${casa === 'camara' ? 'a Câmara dos Deputados' : 'o Senado'} em ${PLEITO}.`;
      break;
    case 'muda':
      f = `${eleito[0].toUpperCase()}${eleito.slice(1)} para ${outraCasa(casa)} em ${PLEITO}: deixa ${casaComArtigo(casa)} em 31/01/2027, mas continua no Congresso.`;
      break;
    case 'segue':
      f = `O mandato no Senado vai até ${dataBR(e.fimMandato)} — esta cadeira não estava em disputa em 2026.`
        + (e.cargo && e.situacao && e.situacao !== 'eleito' ? ` Disputou ${comArtigo(e.cargo)} e não foi ${eleito}; mantém a cadeira.` : '');
      break;
    case 'pendente':
      f = `Disputa o 2º turno para ${comArtigo(e.cargo)} em ${SEGUNDO_TURNO}. Se ${eleito}, deixa o Senado; senão, o mandato segue até ${dataBR(e.fimMandato)}.`;
      break;
    default:
      if (e.motivo === 'nao-reeleito') {
        f = e.situacao === 'suplente'
          ? `Disputou a reeleição e ficou como suplente — pode assumir uma cadeira se um titular se afastar. O mandato atual termina em 31/01/2027.`
          : `Disputou a reeleição e não foi ${eleito}. O mandato atual termina em 31/01/2027.`;
      } else if (e.motivo === 'outro-cargo' && e.cargo) {
        if (e.situacao === 'eleito') {
          f = ehSuplenteSen(e)
            ? `${eleito[0].toUpperCase()}${eleito.slice(1)} suplente de senador em ${PLEITO} — não assume cadeira em fevereiro; não disputou a reeleição.`
            : senadoAte2031
              ? `${eleito[0].toUpperCase()}${eleito.slice(1)} para ${comArtigo(e.cargo)} em ${PLEITO}: deixa a cadeira do Senado para assumir o cargo.`
              : `${eleito[0].toUpperCase()}${eleito.slice(1)} para ${comArtigo(e.cargo)} em ${PLEITO} — não disputou cadeira no Congresso.`;
        } else if (e.situacao === 'segundo-turno') {
          f = `Disputa o 2º turno para ${comArtigo(e.cargo)} em ${SEGUNDO_TURNO} — em qualquer resultado, não disputou cadeira no Congresso. O mandato atual termina em 31/01/2027.`;
        } else if (e.situacao === 'nao-eleito' || e.situacao === 'suplente') {
          f = `Disputou ${comArtigo(e.cargo)} ${e.situacao === 'suplente' ? 'e ficou como suplente' : `e não foi ${eleito}`} — não disputou a reeleição. O mandato atual termina em 31/01/2027.`;
        } else {
          f = `Registrou candidatura a ${e.cargo}, não ao Congresso; o TSE não publicou resultado para ela. O mandato atual termina em 31/01/2027.`;
        }
      } else {
        // não é "não se candidatou": é o que a lista de eleitos permite afirmar
        f = `O mandato termina em 31/01/2027 e o nome não está entre os 513 deputados nem entre os 54 senadores eleitos em ${PLEITO}. Não encontramos candidatura correspondente no TSE.`;
      }
  }
  return f + fonte;
}

/** Linha da imagem compartilhável, que circula sem o site — por isso leva a data. */
export const linhaShare = (e, casa, sexo) => `Eleições 2026: ${resumo(e, casa, sexo)} · TSE, ${dataBR(e.resultadoEm)}`;
