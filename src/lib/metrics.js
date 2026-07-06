// Metadados de cada métrica: descrição, exemplo, cor (a mesma do card na home)
// e domínio sugerido do eixo Y (expande se os dados saírem dele).
export const METRICS = {
  spo2: {
    key: 'spo2',
    label: 'SpO₂',
    fullLabel: 'Saturação de oxigênio (SpO₂)',
    unit: '%',
    color: '#34d399',
    decimals: 0,
    yMin: 80,
    yMax: 100,
    cadence: 'O oxímetro envia ~1 leitura por segundo (junto com pulso e PI, no mesmo frame BLE).',
    description:
      'Porcentagem da hemoglobina do sangue que está transportando oxigênio, medida ' +
      'pela diferença de absorção de luz vermelha e infravermelha no dedo. Em pessoas ' +
      'saudáveis, ao nível do mar, fica tipicamente entre 95% e 100%.',
    example:
      'Exemplo: SpO₂ = 97% significa que 97 de cada 100 hemoglobinas estão carregando ' +
      'oxigênio. Valores persistentes abaixo de 90% caracterizam hipoxemia e merecem atenção.',
  },
  pulse: {
    key: 'pulse',
    label: 'Pulso',
    fullLabel: 'Frequência de pulso',
    unit: 'bpm',
    color: '#f472b6',
    decimals: 0,
    yMin: 40,
    yMax: 120,
    cadence: 'O oxímetro envia ~1 leitura por segundo (junto com SpO₂ e PI, no mesmo frame BLE).',
    description:
      'Quantidade de batimentos por minuto detectada pela pulsação do sangue no dedo — ' +
      'cada batida do coração empurra uma onda de sangue que o sensor óptico enxerga. ' +
      'Em adultos em repouso o normal é 60–100 bpm.',
    example:
      'Exemplo: 72 bpm = o coração pulsa 72 vezes por minuto (~1,2 por segundo). Atletas ' +
      'podem ter ~50 em repouso; numa caminhada rápida é comum passar de 100.',
  },
  pi: {
    key: 'pi',
    label: 'Perfusão',
    fullLabel: 'Índice de perfusão (PI)',
    unit: 'PI',
    color: '#60a5fa',
    decimals: 1,
    yMin: 0,
    yMax: 10,
    cadence: 'O oxímetro envia ~1 leitura por segundo (junto com SpO₂ e pulso, no mesmo frame BLE).',
    description:
      'Força do fluxo sanguíneo pulsátil no local da medição: a razão entre o sinal que ' +
      'pulsa (sangue arterial) e o sinal constante (tecidos e sangue venoso). Varia ' +
      'tipicamente de 0,2 (fraco) a 20 (forte) e indica a qualidade da leitura.',
    example:
      'Exemplo: PI = 4,0 indica um dedo bem perfundido e leitura confiável. PI < 0,5 ' +
      '(dedo frio, mão apertada) torna o SpO₂ e o pulso menos confiáveis.',
  },
};

// A curva não fica na grade de vitais (tem painel próprio na home), mas ganha a
// mesma tela de detalhe. Diferenças: ~30 amostras/s (vs ~1/s), valor sem unidade
// física e escala de tempo do gráfico mais esticada para a onda ficar legível.
export const WAVE_METRIC = {
  key: 'wave',
  label: 'Curva',
  fullLabel: 'Curva pletismográfica',
  unit: '',
  unitLabel: 'amplitude (0–100, sem unidade)',
  color: '#34d399',
  decimals: 0,
  yMin: 0,
  yMax: 100,
  pxPerSec: 90,
  showMs: true,
  readingsCount: 30,
  cadence:
    'O oxímetro envia ~30 amostras por segundo (um frame BLE tipo 0x02 por amostra). ' +
    'Elas chegam em rajadas: cada pacote BLE pode trazer vários frames de uma vez.',
  description:
    'Cada amostra é a intensidade instantânea do sinal óptico no dedo — um número de ' +
    '0 a 100, sem unidade física. Plotadas no tempo, as amostras desenham a onda de ' +
    'pulso: o sangue que cada batimento empurra pelos capilares.',
  example:
    'Exemplo: uma sequência como 42, 55, 71, 68, 51, 43… forma um ciclo da onda — ' +
    'subida rápida na sístole, pico, e descida com o "degrau" do nó dicrótico. ' +
    'Uma onda limpa e regular indica boa leitura; rabiscos indicam movimento ou dedo frio.',
};

export function formatValue(metric, v) {
  if (v == null || v === '--') return '--';
  return Number(v).toFixed(metric.decimals).replace('.', ',');
}
