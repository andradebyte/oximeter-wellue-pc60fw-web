# Oxímetro PC-60FW via Web Bluetooth

PWA (Vite + React + [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)) que conecta no oxímetro
Wellue/Viatom **PC-60FW** usando a Web Bluetooth API — sem precisar do app ViHealth.
Instalável na tela inicial e com service worker para funcionar offline (a conexão BLE
continua exigindo o navegador aberto).

## Estrutura

```
index.html                            casca da SPA (#root)
src/main.jsx                          bootstrap do React
src/App.jsx                           composição da tela (home ↔ detalhe)
src/components/Toolbar.jsx            botões conectar/desconectar + status
src/components/Vitals.jsx             cards de vitais (clicáveis → tela de detalhe)
src/components/MetricDetail.jsx       tela de detalhe: descrição, números e gráfico
src/components/TimeSeriesChart.jsx    gráfico de linha (canvas) com pan e tooltip
src/components/Wave.jsx               painel da curva (canvas via ref)
src/components/DeviceMeta.jsx         nome do dispositivo + bateria
src/components/ConnectionStats.jsx    resumo do histórico de conexão (home)
src/components/ConnectionHistory.jsx  tela de detalhe: linha do tempo de conexões/quedas
src/components/Log.jsx                log com auto-scroll
src/components/UnsupportedWarning.jsx aviso de navegador sem Web Bluetooth
src/hooks/useOximeter.js              hook que expõe o oxímetro como estado React
src/lib/oximeter.js                   conexão BLE + parsing do protocolo (sem React)
src/lib/connectionStats.js            registro/derivação das estatísticas de conexão (sem React)
src/lib/wave.js                       desenho da curva pletismográfica (sem React)
src/lib/metrics.js                    metadados das métricas (descrição, cor, eixo Y)
src/style.css                         estilos
public/                               ícones do PWA
vite.config.js                        config do Vite (React + PWA/manifest)
```

O código BLE (`lib/oximeter.js`) e o desenho da curva (`lib/wave.js`) não dependem de
React — a integração acontece no `hooks/useOximeter.js`. As amostras da curva (~30 Hz)
não passam pelo estado do React: vão do BLE direto para o canvas via ref.

## Telas de detalhe

Clicar em um card da home (SpO₂, Pulso, Perfusão) ou no painel da curva
pletismográfica abre a tela da métrica, com:

- descrição do que o dado significa, com exemplo;
- valor atual + histórico das leituras cruas (número, unidade e horário de chegada);
- cadência medida (a cada quantos segundos as leituras estão chegando);
- gráfico de linha ao vivo: o eixo X cresce a cada leitura e, quando o histórico passa
  da janela visível, dá para **arrastar** o gráfico para navegar pelo passado
  ("Voltar ao vivo" retorna ao acompanhamento). Passar o mouse mostra o valor exato.

O histórico guarda até 1 h de leituras (~3600 pontos por métrica) e existe só em
memória — recarregar a página zera.

## Histórico de conexão

Um painel próprio na home ("Histórico de conexão") acompanha o link BLE de verdade
(não a UI de "aguardando reconexão"): mostra se está conectado ou desconectado agora
e há quanto tempo, o tempo total acumulado conectado e desconectado, e o número de
quedas. Clicar nele abre a linha do tempo completa, com cada sessão (conectou às
X, desconectou às Y, durou Z) e cada lacuna de desconexão, mais recente primeiro —
com um botão para limpar o histórico.

Diferente do histórico de leituras, esses dados ficam salvos no `localStorage` do
navegador (`src/lib/connectionStats.js`), então sobrevivem a recarregar a página.

A curva é um caso especial: chegam ~30 amostras/s, então o histórico dela (últimos
~5 min) fica fora do estado do React (ref mutável) e a tela re-renderiza no máximo
~3x/s; o gráfico usa uma escala de tempo mais esticada (90 px/s) e os horários
aparecem com milissegundos.

## Modo demo

Sem o oxímetro em mãos, abra com `?demo` na URL (ex.: `http://localhost:3000/?demo`)
para ver números, curva e gráficos com dados simulados. `?view=spo2|pulse|pi|wave`
abre direto na tela de uma métrica (combinável: `/?demo&view=wave`).

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000
```

O modo dev já registra o service worker (`devOptions.enabled`), então dá para testar
o comportamento de PWA sem build.

Build de produção:

```bash
npm run build      # gera dist/ com sw.js + manifest
npm run preview    # serve o build em http://localhost:4173
```

### Com Docker

```bash
docker compose up -d --build
```

O Dockerfile faz o build do Vite e serve o `dist/` com nginx em **http://localhost:8080**.

> Web Bluetooth só funciona em contexto seguro: `localhost` vale, mas o IP da rede
> (ex.: `http://192.168.0.10:8080`) **não** — para acessar de outro aparelho veja a
> seção do celular abaixo.

## Como testar

1. Sirva a página (`npm run dev`) e abra no **Chrome** ou **Edge**.
2. Coloque o dedo no oxímetro — ele liga e começa a anunciar via BLE.
3. Clique em **Conectar oxímetro** e selecione o `PC-60F_SN...` no popup.

> O computador precisa ter Bluetooth 4.0+ (BLE). Abrir via `file://` não funciona mais
> (o app agora usa módulos ES) — e o Chrome também não persiste permissões Bluetooth
> nesse modo.

### No celular Android

Web Bluetooth exige HTTPS ou `localhost`. O `npm run dev` já escuta na rede
(`server.host: true`); acesse pelo Chrome do celular usando o IP do PC
(ex.: `http://192.168.0.10:3000`) — como não é localhost, habilite a flag
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` com essa URL **apenas para
teste**, ou publique em qualquer host HTTPS (GitHub Pages, Vercel, Netlify) e teste
direto. Em HTTPS também aparece a opção de **instalar** o PWA na tela inicial.

### iOS

❌ Não funciona — nenhum navegador iOS suporta Web Bluetooth. Para iPhone é preciso
app nativo/híbrido (ex.: Capacitor + `@capacitor-community/bluetooth-le`).

## Detalhes do protocolo

- Serviço BLE: Nordic UART (`6e400001-b5a3-f393-e0a9-e50e24dcca9e`)
- Notificações em `6e400003-...`
- Frames começam com `AA 55`:
  - `AA 55 0F 08 01 …` → SpO₂ (byte 5), pulso (byte 6), PI×10 (byte 8)
  - `AA 55 0F .. 02 …` → amostra da curva pletismográfica (byte 5)
  - `AA 55 F0 03 03 …` → nível de bateria 0–3 (byte 5)
- Frames não reconhecidos aparecem em hex no log da página — útil para mapear o resto
  do protocolo.

## Dicas

- O ViHealth **não pode** estar conectado ao mesmo tempo (BLE aceita 1 conexão por vez).
- O oxímetro desliga sozinho ao tirar o dedo — a queda de conexão é normal.

## Reconexão automática

- **Na mesma sessão:** depois de autorizar o oxímetro uma vez, a página fica em modo
  "aguardando" quando ele desliga e reconecta sozinha (tentativas a cada 3 s) assim
  que você coloca o dedo de novo. O botão **Desconectar** encerra esse modo.
- **Entre sessões:** ao reabrir a página, ela usa `navigator.bluetooth.getDevices()`
  para recuperar o dispositivo já autorizado e reconectar **sem popup**. Se isso não
  acontecer no seu Chrome, habilite a flag
  `chrome://flags/#enable-web-bluetooth-new-permissions-backend` (em versões antigas
  ela vem desligada).

## Créditos / referências

- Protocolo mapeado pela comunidade: [anaesthetics.app/blog](https://anaesthetics.app/blog/posts/2020/bluetooth/)
  e [ESPHome + PC-60FW (Home Assistant Community)](https://community.home-assistant.io/t/esphome-config-to-read-from-pc-60fw-bluetooth-pulse-oximeter-and-display-locally/884140)

> ⚠️ Uso educacional/pessoal. Não é um dispositivo validado para uso clínico via terceiros.
