export interface BusDeparture {
  id: string; // ID único (pode ser o primeiro serviço)
  servicos: string[]; // Lista de serviços (ex: ["75990", "75991"])
  linhas: string[]; // Lista de linhas
  classes: string[]; // Lista de classes (ex: ["LEITO", "SEMI-LEITO"])
  empresa: string;
  data: string; // The date of the departure
  horario: string;
  destino: string;
  plataforma: string;
  carro?: string;
  tipo: string; // NORMAL ou EXTRA
  
  // Capacidades
  capacidadeTotal: number;
  ocupacaoTotal: number;
  detalheCapacidade: string; // Ex: "20 Leito + 26 Semi-Leito"
  
  // Registros de horários (vindos da planilha)
  registroEntradaRodoviaria?: string;
  registroEntradaPlataforma?: string;
  registroSaidaViagem?: string;
  
  // Limites calculados
  limiteEntradaPlataforma?: string;
  
  // Metadados para merge
  isMerged?: boolean;
}

export type FilterType = {
  empresa: string;
  destino: string;
  status: 'todos' | 'pendente' | 'em_andamento' | 'concluido';
};
