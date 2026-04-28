import { BusDeparture } from './types';

export const initialDepartures: BusDeparture[] = [
  {
    id: '75990',
    servicos: ['75990', '75991'],
    linhas: ['7159', '7259'],
    classes: ['SEMILEITO PREMIUM', 'CAMA'],
    empresa: 'VIACAO COMETA S A',
    data: '16/04/2026',
    horario: '20:00',
    destino: 'BELO HORIZONTE (RODOVIARIA) - MG',
    plataforma: '6',
    carro: '12345',
    tipo: 'NORMAL',
    capacidadeTotal: 54,
    ocupacaoTotal: 54,
    detalheCapacidade: '46 SEMILEITO PREMIUM + 8 CAMA',
    limiteEntradaPlataforma: '19:45'
  }
];
