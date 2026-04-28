import { useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { 
  Bus, 
  Clock, 
  MapPin, 
  Search, 
  Filter, 
  ArrowLeft, 
  CheckCircle2, 
  Building2,
  Users,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { BusDeparture, FilterType } from './types';
import { initialDepartures } from './data';

// Google Sheets Config
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '1Q5r4ZiOpWCPbLlzL2PHhKOcgDV07EA4olNGUX8NwzEk';
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const RANGE = 'Resumo!A:Z';

export default function App() {
  const [departures, setDepartures] = useState<BusDeparture[]>([]);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterType>({
    empresa: '',
    destino: '',
    status: 'todos'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Load data from localStorage or initial data
  useEffect(() => {
    const saved = localStorage.getItem('bus_departures');
    if (saved) {
      setDepartures(JSON.parse(saved));
    } else {
      setDepartures(initialDepartures);
    }
  }, []);

  const fetchFromSheets = useCallback(async () => {
    if (!SHEET_ID || !API_KEY) return;
    
    setIsSyncing(true);
    setError(null);
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${RANGE}?key=${API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Falha ao acessar a planilha (Status ${response.status}). Verifique o ID e a Chave de API externa configurada.`);
      }
      
      const data = await response.json();
      if (!data.values || data.values.length < 2) return;

      const mergedDepartures = mergeTrips(data.values);
      setDepartures(mergedDepartures);
      setLastSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Automatic Polling
  useEffect(() => {
    if (SHEET_ID && API_KEY) {
      fetchFromSheets();
      const interval = setInterval(fetchFromSheets, 2500); // Poll every 2.5 seconds
      return () => clearInterval(interval);
    } else {
       setError("Configure VITE_GOOGLE_SHEET_ID e GOOGLE_API_KEY (ou VITE_GOOGLE_API_KEY) nos Secrets para habilitar sincronização.");
    }
  }, [fetchFromSheets]);


  const mergeTrips = (rowsWithHeader: any[]): BusDeparture[] => {
    const results: BusDeparture[] = [];
    if (rowsWithHeader.length < 2) return results;

    const headers = rowsWithHeader[0].map((h: string) => String(h).toLowerCase().trim());
    const findIdx = (keywords: string[]) => headers.findIndex((h: string) => keywords.some(k => h.includes(k)));

    const idxData = findIdx(['data']);
    const idxLinha = findIdx(['linha']);
    const idxServ = findIdx(['serviço', 'servico']);
    const idxEmpresa = findIdx(['empresa']);
    const idxHorario = headers.findIndex(h => h === 'horário' || h === 'horario');
    const idxDestino = findIdx(['destino']);
    const idxClasse = findIdx(['classe']);
    const idxCapacidade = findIdx(['capacidade']);
    const idxTipo = findIdx(['tipo']);
    
    const idxBoardingPlat = headers.findIndex((h, i) => i < 11 && (h === 'plat' || h === 'plat.' || h === 'plataforma embarque' || h === 'plataforma'));
    const idxCarro = findIdx(['carro', 'frota']);
    const idxOcupacao = findIdx(['ocupação', 'ocupacao', 'saida']);

    const idxLimPlat = headers.findIndex(h => h.includes('limite de entrada na plataforma') || h.includes('limite entrada plat'));
    
    // Status timestamps are typically located in columns marked "Data e Hora" directly to the right of the status label
    let idxRegRod = 14;
    let idxRegPlat = 16;
    let idxRegSaida = 18;

    headers.forEach((h, i) => {
      // Find the explicit "Data e hora" column and look at the preceding column to understand what it relates to
      if (h.includes('data') && h.includes('hora')) {
        const prevHeader = headers[i - 1] || '';
        if (prevHeader.includes('rodoviaria') || prevHeader.includes('rodoviária')) {
          if (prevHeader.includes('entrada')) {
            idxRegRod = i;
          } else if (prevHeader.includes('saída') || prevHeader.includes('saida')) {
             idxRegSaida = i;
          }
        } else if (prevHeader.includes('plataforma') || prevHeader.includes('plat')) {
          idxRegPlat = i;
        }
      }
    });

    const rows = rowsWithHeader.slice(1);

    rows.forEach(row => {
      const dataVal = String(row[idxData >= 0 ? idxData : 0] || '').trim();
      const linha = String(row[idxLinha >= 0 ? idxLinha : 1] || '').trim();
      const servico = String(row[idxServ >= 0 ? idxServ : 2] || '').trim();
      const empresa = String(row[idxEmpresa >= 0 ? idxEmpresa : 3] || '').trim();
      const horario = String(row[idxHorario >= 0 ? idxHorario : 4] || '').trim();
      const destino = String(row[idxDestino >= 0 ? idxDestino : 5] || '').trim();
      const classe = String(row[idxClasse >= 0 ? idxClasse : 6] || '').trim();
      const capacidade = Number(row[idxCapacidade >= 0 ? idxCapacidade : 7] || 0);
      const tipo = String(row[idxTipo >= 0 ? idxTipo : 8] || 'NORMAL').trim();
      const plataforma = String(row[idxBoardingPlat >= 0 ? idxBoardingPlat : 9] || '').trim();
      const carro = String(row[idxCarro >= 0 ? idxCarro : 10] || '').trim();
      const ocupacao = Number(row[idxOcupacao >= 0 ? idxOcupacao : 11] || 0);
      const limEntradaPlat = String(row[idxLimPlat >= 0 ? idxLimPlat : 12] || '').trim();
      const regEntradaRod = String(row[idxRegRod >= 0 ? idxRegRod : 14] || '').trim();
      const regEntradaPlat = String(row[idxRegPlat >= 0 ? idxRegPlat : 16] || '').trim();
      const regSaidaViagem = String(row[idxRegSaida >= 0 ? idxRegSaida : 18] || '').trim();

      if (!servico || !horario || servico.toLowerCase() === 'serviço') return;

      // Procura por um ônibus que possa ser o mesmo
      const existing = results.find(d => 
        d.destino === destino && 
        d.horario === horario && 
        d.empresa === empresa &&
        (
          (carro && d.carro && carro === d.carro) || // Mesmo carro
          (!carro || !d.carro) // Um ou ambos sem carro, verifica proximidade de serviço
        )
      );

      if (existing) {
        // Verifica se o serviço ou linha são "próximos" (diff 1, 100, ou ~100)
        const isCloseService = existing.servicos.some(s => {
          const sNum = Number(s.replace(/\D/g, ''));
          const servNum = Number(servico.replace(/\D/g, ''));
          const diff = Math.abs(sNum - servNum);
          return diff === 1 || diff === 100 || (diff >= 99 && diff <= 101);
        }) || existing.linhas.some(l => {
          const lNum = Number(l.replace(/\D/g, ''));
          const linNum = Number(linha.replace(/\D/g, ''));
          const diff = Math.abs(lNum - linNum);
          return diff === 1 || diff === 100 || (diff >= 99 && diff <= 101);
        });

        // Se tiver o mesmo carro OU for serviço próximo, faz o merge
        if ((carro && existing.carro && carro === existing.carro) || isCloseService) {
          if (servico && !existing.servicos.includes(servico)) existing.servicos.push(servico);
          if (linha && !existing.linhas.includes(linha)) existing.linhas.push(linha);
          if (classe && !existing.classes.includes(classe)) {
            existing.classes.push(classe);
            existing.detalheCapacidade += ` + ${capacidade} ${classe}`;
          }
          existing.capacidadeTotal += capacidade;
          existing.ocupacaoTotal += ocupacao;
          existing.isMerged = true;
          if (regEntradaRod) existing.registroEntradaRodoviaria = regEntradaRod;
          if (regEntradaPlat) existing.registroEntradaPlataforma = regEntradaPlat;
          if (regSaidaViagem) existing.registroSaidaViagem = regSaidaViagem;
          if (carro) existing.carro = carro;
          return;
        }
      }

      results.push({
        id: servico,
        servicos: [servico],
        linhas: [linha],
        classes: [classe],
        empresa,
        data: dataVal,
        horario,
        destino,
        plataforma,
        carro,
        tipo,
        capacidadeTotal: capacidade,
        ocupacaoTotal: ocupacao,
        detalheCapacidade: `${capacidade} ${classe}`,
        registroEntradaRodoviaria: regEntradaRod,
        registroEntradaPlataforma: regEntradaPlat,
        registroSaidaViagem: regSaidaViagem,
        limiteEntradaPlataforma: limEntradaPlat || calculateLimit(horario, -15)
      });
    });

    return results;
  };

  // Save to localStorage whenever departures change
  useEffect(() => {
    if (departures.length > 0) {
      localStorage.setItem('bus_departures', JSON.stringify(departures));
    }
  }, [departures]);

  const filteredDepartures = useMemo(() => {
    return departures.filter(d => {
      const matchesSearch = 
        d.destino.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.servicos?.some(s => s.includes(searchTerm)) ||
        (d.carro && d.carro.includes(searchTerm));
      
      const matchesEmpresa = !filters.empresa || d.empresa === filters.empresa;
      const matchesDestino = !filters.destino || d.destino === filters.destino;
      
      let matchesStatus = true;
      if (filters.status === 'pendente') {
        matchesStatus = !d.registroEntradaRodoviaria;
      } else if (filters.status === 'em_andamento') {
        matchesStatus = !!d.registroEntradaRodoviaria && !d.registroSaidaViagem;
      } else if (filters.status === 'concluido') {
        matchesStatus = !!d.registroSaidaViagem;
      }

      return matchesSearch && matchesEmpresa && matchesDestino && matchesStatus;
    });
  }, [departures, searchTerm, filters]);

  const dragControls = useDragControls();

  const selectedBus = useMemo(() => 
    departures.find(d => d.id === selectedBusId),
  [departures, selectedBusId]);

  const calculateLimit = (timeStr: string, minutes: number) => {
    if (!timeStr) return "";
    const [h, m] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minutes, 0);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const createDateTime = (dateStr: string | undefined, timeStr: string) => {
    if (!timeStr) return null;
    
    if (timeStr.includes(' ')) {
      const parts = timeStr.split(' ');
      const dateParts = parts[0].split('/');
      const timeParts = parts[1].split(':');
      if (dateParts.length === 3 && timeParts.length >= 2) {
        return new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), Number(timeParts[0]), Number(timeParts[1])).getTime();
      }
    }
    
    const dateParts = (dateStr || '').split('/');
    const timeParts = timeStr.split(':');
    
    if (dateParts.length === 3 && timeParts.length >= 2) {
      return new Date(Number(dateParts[2]), Number(dateParts[1]) - 1, Number(dateParts[0]), Number(timeParts[0]), Number(timeParts[1])).getTime();
    }
    
    if (timeParts.length >= 2) {
      return Number(timeParts[0]) * 60 + Number(timeParts[1]); // Fallback minutes
    }

    return null;
  };

  const isDelayed = (planned: string, actual: string, baseDate: string | undefined) => {
    const pTime = createDateTime(baseDate, planned);
    const aTime = createDateTime(baseDate, actual);
    
    if (pTime !== null && aTime !== null) {
      return aTime > pTime;
    }
    return false;
  };

  const isCurrentStatusDelayed = (bus: BusDeparture) => {
    if (bus.registroSaidaViagem) return isDelayed(bus.horario, bus.registroSaidaViagem, bus.data);
    if (bus.registroEntradaPlataforma) return isDelayed(bus.limiteEntradaPlataforma || bus.horario, bus.registroEntradaPlataforma, bus.data);
    if (bus.registroEntradaRodoviaria) return isDelayed(bus.limiteEntradaPlataforma || bus.horario, bus.registroEntradaRodoviaria, bus.data);
    return false;
  };

  const getStatusColor = (bus: BusDeparture) => {
    if (bus.registroSaidaViagem) return 'bg-green-100 text-green-700 border-green-200';
    if (bus.registroEntradaPlataforma) return 'bg-blue-100 text-blue-700 border-blue-200';
    if (bus.registroEntradaRodoviaria) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const getStatusText = (bus: BusDeparture) => {
    if (bus.registroSaidaViagem) return 'Viagem Iniciada';
    if (bus.registroEntradaPlataforma) return 'Na Plataforma';
    if (bus.registroEntradaRodoviaria) return 'Na Rodoviária';
    return 'Pendente';
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-slate-900 leading-none">Partidas</h1>
            {lastSync && (
              <span className="text-[10px] text-slate-400 mt-1">Sincronizado às {lastSync}</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Total Trips Card */}
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-1 flex flex-col items-center shadow-sm">
              <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Total</span>
              <span className="text-sm font-bold text-blue-600 leading-tight">{departures.length}</span>
            </div>

            <button 
              onClick={fetchFromSheets}
              disabled={isSyncing || !SHEET_ID}
              className={`p-2 rounded-full transition-colors ${
                isSyncing || !SHEET_ID ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              <RefreshCw className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
            >
              <Filter className={`w-5 h-5 ${showFilters ? 'text-white' : 'text-slate-600'}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por destino, empresa ou carro..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Quick Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 mt-4 overflow-x-auto pb-2 no-scrollbar">
                {(['todos', 'pendente', 'em_andamento', 'concluido'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setFilters(f => ({ ...f, status: s }))}
                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                      filters.status === s 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                        : 'bg-white text-slate-600 border border-slate-200'
                    }`}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1).replace('_', ' ')}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* List */}
      <main className="px-4 py-4 space-y-3">
        {filteredDepartures.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-slate-400">
            <Bus className="w-12 h-12 opacity-20 mb-4" />
            <p className="text-sm">Nenhuma viagem encontrada</p>
          </div>
        ) : (
          filteredDepartures.map((bus) => (
            <motion.div
              layoutId={bus.id}
              key={bus.id}
              onClick={() => setSelectedBusId(bus.id)}
              className="glass-card p-4 cursor-pointer active:scale-[0.98] transition-transform"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Bus className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2 min-w-0">
                      <span className="line-clamp-2">{bus.empresa}</span>
                      <span className={`px-1.5 rounded text-[9px] font-bold flex-shrink-0 ${bus.tipo === 'EXTRA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {bus.tipo}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 leading-tight truncate">
                      {bus.destino.split('(')[0]}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {bus.classes?.join(' + ')}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 ml-2">
                  <div className={`status-badge border flex-shrink-0 whitespace-nowrap ${getStatusColor(bus)}`}>
                    {getStatusText(bus)}
                  </div>
                  {isCurrentStatusDelayed(bus) && (
                    <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[8px] font-bold animate-pulse">
                      ATRASADO
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                    <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">{bus.horario}</span>
                  <span className="text-[10px] text-slate-400 font-medium ml-1">({(bus.data || '').slice(0,5)})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-bold text-slate-700">Plat. {bus.plataforma}</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-500">{bus.capacidadeTotal} Lugares</span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </main>

      {/* Detail Overlay */}
      <AnimatePresence>
        {selectedBusId && selectedBus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-end"
            onClick={() => setSelectedBusId(null)}
          >
            <motion.div
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 1000 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) {
                  setSelectedBusId(null);
                }
              }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full bg-white rounded-t-[32px] flex flex-col max-h-[92vh] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle & Header Area */}
              <div 
                className="p-6 pb-2 cursor-grab active:cursor-grabbing touch-none"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setSelectedBusId(null)}
                    className="p-2 rounded-full bg-slate-100"
                  >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <h2 className="text-xl font-bold text-slate-900">Detalhes da Partida</h2>
                </div>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 pb-10">
                <div className="space-y-6">
                  {/* Info Card */}
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Empresa / Tipo</label>
                        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2 mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {selectedBus.empresa}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${selectedBus.tipo === 'EXTRA' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {selectedBus.tipo}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Carro</label>
                        <div className="text-sm font-bold text-blue-600 mt-0.5">
                          {selectedBus.carro || "Não informado"}
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plataforma</label>
                        <div className="text-lg font-bold text-slate-900 mt-0.5">{selectedBus.plataforma}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Serviços</label>
                        <div className="text-xs font-semibold text-slate-700 mt-0.5">#{selectedBus.servicos?.join(', #')}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Linhas</label>
                        <div className="text-xs font-semibold text-slate-700 mt-0.5">{selectedBus.linhas?.join(' / ')}</div>
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Capacidade / Classes</label>
                        <div className="text-sm font-bold text-slate-900 mt-0.5">{selectedBus.capacidadeTotal} Lugares</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{selectedBus.detalheCapacidade}</div>
                      </div>
                    </div>
                  </div>

                  {/* Limits */}
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Limite Entrada Plat.</div>
                        <div className="text-xl font-bold text-blue-800">{selectedBus.limiteEntradaPlataforma}</div>
                      </div>
                    </div>
                  </div>

                  {/* Status Indicators (Read Only) */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 px-1">Status da Planilha</h3>
                    
                    <StatusIndicator 
                      label="Entrada na Rodoviária"
                      planned={selectedBus.limiteEntradaPlataforma || ''}
                      time={selectedBus.registroEntradaRodoviaria}
                      icon={<MapPin className="w-5 h-5" />}
                      active={!!selectedBus.registroEntradaRodoviaria}
                      baseDate={selectedBus.data}
                      isDelayedFn={isDelayed}
                    />

                    <StatusIndicator 
                      label="Entrada na Plataforma"
                      planned={selectedBus.limiteEntradaPlataforma || ''}
                      time={selectedBus.registroEntradaPlataforma}
                      icon={<CheckCircle2 className="w-5 h-5" />}
                      active={!!selectedBus.registroEntradaPlataforma}
                      baseDate={selectedBus.data}
                      isDelayedFn={isDelayed}
                    />

                    <StatusIndicator 
                      label="Saída para Viagem"
                      planned={selectedBus.horario}
                      time={selectedBus.registroSaidaViagem}
                      icon={<Bus className="w-5 h-5" />}
                      active={!!selectedBus.registroSaidaViagem}
                      baseDate={selectedBus.data}
                      isDelayedFn={isDelayed}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatusIndicator({ label, planned, time, icon, active, baseDate, isDelayedFn }: { 
  label: string, 
  planned: string,
  time?: string, 
  icon: ReactNode,
  active: boolean,
  baseDate?: string,
  isDelayedFn: (p: string, a: string, d: string | undefined) => boolean
}) {
  const delayed = active && time ? isDelayedFn(planned, time, baseDate) : false;

  return (
    <div
      className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
        active 
          ? delayed ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700' 
          : 'bg-slate-50 border-slate-100 text-slate-400 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
          active 
            ? delayed ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600' 
            : 'bg-slate-200 text-slate-400'
        }`}>
          {icon}
        </div>
        <div className="text-left">
          <div className="text-sm font-bold">{label}</div>
          {active ? (
            <div className="flex flex-col">
              <div className="text-sm font-bold text-slate-900">Registrado: {time?.includes(' ') ? time.split(' ')[1] : time}</div>
              {delayed && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="bg-red-600 text-white px-1.5 rounded text-[9px] font-bold">ATRASO</span>
                  <span className="text-[9px] font-bold text-red-500 uppercase">vs Planejado {planned}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] font-bold uppercase tracking-wider">Aguardando...</div>
          )}
        </div>
      </div>
      {active && (
        delayed ? <AlertTriangle className="w-6 h-6 text-red-500" /> : <CheckCircle2 className="w-6 h-6 text-green-500" />
      )}
    </div>
  );
}
