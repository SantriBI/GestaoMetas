import { VendedorProcessado } from './types'

export function gerarResumoDiario(vendedores: VendedorProcessado[]) {
  return vendedores.reduce(
    (acc, v) => {
      if (v.statusDia === 'OK') {
        acc.bateram += 1
      } else if (v.statusDia === 'DEVENDO') {
        acc.devendo += 1
        acc.valorFaltante += v.saldoDia ?? 0
      }
      return acc
    },
    {
      bateram: 0,
      devendo: 0,
      valorFaltante: 0
    }
  )
}
