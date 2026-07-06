// Protocolo do PC-60FW (engenharia reversa da comunidade):
// Serviço Nordic UART; frames começam com 0xAA 0x55.
//   AA 55 0F .. [tipo=0x01] -> vitais: SpO2 = byte 5, pulso = byte 6, PI = byte 8 (x0.1)
//   AA 55 0F .. [tipo=0x02] -> amostra da curva pletismográfica no byte 5
//   AA 55 F0 03 03          -> bateria: nível 0–3 no byte 5
const SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const NOTIFY_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

const RECONNECT_INTERVAL_MS = 3000;

export const BATTERY_LEVELS = ['0–25%', '25–50%', '50–75%', '75–100%'];

/**
 * Gerencia a conexão BLE com o PC-60FW e o parsing dos frames.
 * Os handlers recebem os eventos já interpretados:
 *   onVitals({ spo2, pulse, pi }), onWaveSample(v), onBattery(nivel 0–3),
 *   onDevice(nome), onStatus(texto, estado), onConnectionChange(conectado|aguardando),
 *   onLink(conectado de fato — true só quando o GATT está ligado e recebendo dados,
 *   false a cada queda real), onLog(mensagem)
 */
export function createOximeter(handlers) {
  const {
    onVitals,
    onWaveSample,
    onBattery,
    onDevice,
    onStatus,
    onConnectionChange,
    onLink,
    onLog,
  } = handlers;

  let device = null;
  let rxBuffer = [];
  let wantConnection = false; // usuário quer ficar conectado (liga o auto-reconnect)
  let reconnectTimer = null;
  let advertisementWatcher = null;

  // ---------- Parsing dos frames ----------
  function handleNotification(event) {
    const chunk = new Uint8Array(event.target.value.buffer);
    rxBuffer.push(...chunk);

    // Consome frames completos; um chunk BLE pode conter frame parcial ou múltiplos
    while (rxBuffer.length >= 4) {
      const start = rxBuffer.findIndex((b, i) => b === 0xAA && rxBuffer[i + 1] === 0x55);
      if (start < 0) { rxBuffer = []; break; }
      if (start > 0) rxBuffer = rxBuffer.slice(start);
      if (rxBuffer.length < 4) break;

      const len = rxBuffer[3]; // bytes após o campo de comprimento
      const frameEnd = 4 + len;
      if (rxBuffer.length < frameEnd) break;

      parseFrame(rxBuffer.slice(0, frameEnd));
      rxBuffer = rxBuffer.slice(frameEnd);
    }
  }

  function parseFrame(f) {
    const token = f[2];
    const type = f[4];

    if (token === 0x0F && type === 0x01 && f.length >= 9) {
      // Vitais: AA 55 0F 08 01 SpO2 PR PR? PI
      onVitals({ spo2: f[5], pulse: f[6], pi: f[8] / 10 });
    } else if (token === 0x0F && type === 0x02 && f.length >= 6) {
      // Curva pletismográfica: uma amostra por frame
      onWaveSample(f[5]);
    } else if (token === 0xF0 && f[3] === 0x03 && f.length >= 6) {
      // Bateria em níveis 0–3
      onBattery(f[5]);
    } else {
      // Frame desconhecido — registra para depuração do protocolo
      onLog(`frame? ${[...f].map((b) => b.toString(16).padStart(2, '0')).join(' ')}`);
    }
  }

  // ---------- Conexão ----------
  async function connect() {
    try {
      onStatus('Procurando…');
      const selected = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'PC-60F' }],
        optionalServices: [SERVICE_UUID],
      });
      adoptDevice(selected);
      wantConnection = true;
      await establish();
    } catch (err) {
      if (err.name === 'NotFoundError') {
        onLog('Nenhum dispositivo selecionado. O oxímetro precisa estar LIGADO e MEDINDO para aparecer.');
        onStatus('Desconectado');
      } else {
        onLog(`Erro: ${err.message}`);
        onStatus('Erro na conexão', 'err');
      }
    }
  }

  function adoptDevice(d) {
    device = d;
    device.addEventListener('gattserverdisconnected', onDisconnected);
    onLog(`Dispositivo: ${device.name}`);
    onDevice(device.name);
  }

  // Conecta (ou reconecta) no dispositivo já autorizado — não precisa de popup nem clique
  async function establish() {
    try {
      onStatus('Conectando…');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(NOTIFY_UUID);

      characteristic.addEventListener('characteristicvaluechanged', handleNotification);
      await characteristic.startNotifications();

      onStatus(`Conectado a ${device.name}`, 'on');
      onLog('Notificações ativas — coloque o dedo no oxímetro.');
      onConnectionChange(true);
      onLink?.(true);
    } catch (err) {
      onLog(`Falha ao conectar: ${err.message}`);
      scheduleReconnect();
    }
  }

  function scheduleReconnect() {
    if (!wantConnection || !device) return;
    onStatus('Aguardando o oxímetro ligar… (coloque o dedo)');
    onConnectionChange(true);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(establish, RECONNECT_INTERVAL_MS);
  }

  // Espera o oxímetro voltar a anunciar antes de conectar. Necessário após
  // recarregar a página (dispositivos vindos de getDevices() só conectam de
  // forma confiável depois de um advertisement); se watchAdvertisements não
  // existir, cai no loop de tentativas do scheduleReconnect.
  function waitForAdvertisement() {
    if (!wantConnection || !device) return;
    if (typeof device.watchAdvertisements !== 'function') {
      scheduleReconnect();
      return;
    }
    onStatus('Aguardando o oxímetro ligar… (coloque o dedo)');
    onConnectionChange(true);

    advertisementWatcher?.abort();
    advertisementWatcher = new AbortController();

    device.addEventListener('advertisementreceived', () => {
      onLog('Oxímetro detectado — conectando…');
      advertisementWatcher?.abort();
      advertisementWatcher = null;
      establish();
    }, { once: true });

    device.watchAdvertisements({ signal: advertisementWatcher.signal }).catch((err) => {
      if (err.name === 'AbortError') return;
      onLog(`watchAdvertisements indisponível (${err.message}) — usando tentativas periódicas.`);
      scheduleReconnect();
    });
  }

  function onDisconnected() {
    // O PC-60FW desliga sozinho ao tirar o dedo, então quedas são normais
    rxBuffer = [];
    onLink?.(false);
    if (wantConnection) {
      onLog('Oxímetro desligou — vou reconectar quando ele voltar.');
      waitForAdvertisement();
    } else {
      onStatus('Desconectado');
      onLog('Conexão encerrada.');
      onConnectionChange(false);
    }
  }

  function disconnect() {
    wantConnection = false;
    clearTimeout(reconnectTimer);
    advertisementWatcher?.abort();
    advertisementWatcher = null;
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    } else {
      onStatus('Desconectado');
      onConnectionChange(false);
    }
  }

  // Reconexão entre sessões: recupera dispositivos já autorizados sem abrir popup.
  // getDevices() existe no Chrome/Edge; em versões antigas fica atrás de
  // chrome://flags/#enable-web-bluetooth-new-permissions-backend
  async function resumePreviousDevice() {
    if (location.protocol === 'file:') {
      onLog('DIAGNÓSTICO: página aberta via file:// — o Chrome NÃO persiste permissões Bluetooth assim. Sirva via http://localhost (npm run dev) para a reconexão pós-F5 funcionar.');
    }
    if (!navigator.bluetooth?.getDevices) {
      onLog('DIAGNÓSTICO: getDevices() não existe neste Chrome. Ative chrome://flags/#enable-web-bluetooth-new-permissions-backend e reinicie o navegador.');
      return;
    }
    try {
      const devices = await navigator.bluetooth.getDevices();
      onLog(`DIAGNÓSTICO: getDevices() retornou ${devices.length} dispositivo(s) lembrado(s): ${devices.map((d) => d.name).join(', ') || 'nenhum'}`);
      const previous = devices.find((d) => d.name?.startsWith('PC-60F'));
      if (!previous) {
        onLog('Nenhum PC-60F lembrado. Confira chrome://settings/content/bluetoothDevices após autorizar.');
        return;
      }
      adoptDevice(previous);
      wantConnection = true;
      onLog('Oxímetro já autorizado anteriormente — reconexão automática ativa.');
      waitForAdvertisement();
    } catch (err) {
      onLog(`Não foi possível retomar dispositivo anterior: ${err.message}`);
    }
  }

  return { connect, disconnect, resumePreviousDevice };
}
