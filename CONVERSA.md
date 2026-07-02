# Conversa: Oxímetro PC-60FW + Bluetooth LE + PWA

> Registro da conversa com o Claude (Fable 5) em 02/07/2026.
> Resultado final: o projeto nesta pasta (`index.html`, `Dockerfile`, `docker-compose.yml`, `README.md`).

---

## 1. O problema inicial

**Pergunta:** Pesquise sobre 3 termos — oxímetro (PC-60FW), ViHealth e Bluetooth LE. Consigo conectar o oxímetro pelo app ViHealth, mas fora dele ele não aparece para eu me conectar. O que poderia ser?

**Resposta (resumo):** Não há nada de errado — é o comportamento esperado.

- **Bluetooth LE ≠ Bluetooth clássico.** A lista de Bluetooth nas configurações do celular é para dispositivos com pareamento/bonding no nível do sistema (fones, teclados). Dispositivos de saúde como o PC-60FW usam BLE puro com GATT: apenas "anunciam" (advertising) e é o **app** que escaneia e conecta diretamente. iOS e Android deliberadamente não mostram periféricos BLE genéricos na tela de configurações.
- **PC-60FW:** oxímetro de dedo da Shenzhen Creative Medical (marcas Wellue/Viatom), Bluetooth 4.0 (BLE). O manual diz explicitamente para **não** parear nas configurações do smartphone — a conexão é pelo app, com o oxímetro medindo. Tecnicamente, ele usa o **Nordic UART Service** (UUID `6e400001-b5a3-f393-e0a9-e50e24dcca9e`) com protocolo proprietário (pacotes `AA 55`).
- **ViHealth:** app companheiro oficial da Viatom/Wellue. Faz o scan BLE, reconhece o oxímetro e decodifica o protocolo proprietário — por isso só dentro dele o aparelho "aparece".

Pontos extras:
- O oxímetro só anuncia enquanto está ligado/medindo (desliga sozinho ao tirar o dedo).
- Um periférico BLE para de anunciar enquanto conectado — se o ViHealth estiver conectado, nada mais o enxerga.
- Para "ver" o aparelho fora do app: nRF Connect ou LightBlue (scanners BLE).

**Fontes:** [manual do PC-60FW](https://manuals.plus/wellue/pc-60fw-bluetooth-pulse-oximeter-fingertip-manual), [thread ESPHome/Home Assistant](https://community.home-assistant.io/t/esphome-config-to-read-from-pc-60fw-bluetooth-pulse-oximeter-and-display-locally/884140).

---

## 2. "Será que tem como conectar ele com o meu PWA?"

**Resposta (resumo):** Sim, via **Web Bluetooth API** — alguém já fez com esse exato aparelho ([anaesthetics.app](https://anaesthetics.app/blog/posts/2020/bluetooth/), [repo](https://github.com/anaestheticsapp/bluetooth/)).

**Ressalva importante — suporte por plataforma:**

| Plataforma | Web Bluetooth |
|-----------|---------------|
| Android (Chrome, Edge, Samsung Internet) | ✅ |
| Desktop (Chrome, Edge) | ✅ |
| iPhone/iPad (qualquer navegador) | ❌ |
| Firefox | ❌ |

No iOS não funciona (todo navegador é WebKit, sem Web Bluetooth). Para iPhone: app nativo/híbrido (Capacitor + plugin BLE).

Requisitos: página em **HTTPS ou localhost** e conexão iniciada por **gesto do usuário** (clique).

---

## 3. "Monta um exemplo pra mim" (nesta pasta)

Criados:
- **`index.html`** — página autocontida (HTML+CSS+JS), tema escuro estilo monitor médico. Conecta via `navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'PC-60F' }] })`, assina notificações em `6e400003-...` e parseia os frames `AA 55`:
  - `AA 55 0F 08 01 …` → SpO₂ (byte 5), pulso (byte 6), PI×10 (byte 8)
  - `AA 55 0F .. 02 …` → amostra da curva pletismográfica (byte 5)
  - `AA 55 F0 03 03 …` → bateria 0–3 (byte 5)
  - Frames desconhecidos aparecem em hex no log (para mapear o resto do protocolo)
- **`README.md`** — instruções de teste (PC, Android, iOS) e referência do protocolo.

---

## 4. "Tem como colocar um Dockerfile aqui?"

Criados **`Dockerfile`** (nginx:alpine servindo o `index.html`) e **`docker-compose.yml`** (porta 8080):

```bash
docker compose up -d --build
# http://localhost:8080
```

Observações:
- O build não pôde ser testado na máquina (comando `docker` não encontrado — verificar Docker Desktop/PATH).
- Web Bluetooth só funciona em contexto seguro: `http://localhost:8080` vale; IP da rede (`http://192.168.x.x`) não. Para celular: publicar em HTTPS (GitHub Pages/Vercel) ou flag de teste do Chrome.

---

## 5. "Como você fez isso? Pegou o BLE no caso?"

Nada foi capturado do dispositivo — foi **pesquisa**: engenharia reversa já publicada pela comunidade (blog do anaesthetics.app + thread do Home Assistant/ESPHome), com as duas fontes batendo entre si.

Como a comunidade descobriu (roteiro clássico de engenharia reversa BLE):
1. Scan com **nRF Connect** → listar serviços/características GATT (o UUID Nordic UART já entrega que é serial proprietário).
2. Assinar notificações e observar os bytes crus (o cabeçalho `AA 55` salta aos olhos).
3. Correlacionar com o app oficial (ver "SpO₂ 97" no ViHealth e procurar `0x61` nos bytes).
4. Alternativas: btsnoop log do Android + Wireshark, ou descompilar o APK.

---

## 6. "Tá mockado isso?"

Não. Não há dado falso: os valores começam em `--` e só mudam com notificações BLE reais. Sem o oxímetro, nada aparece.

Distinção honesta: a **conexão** (UUIDs) é bem confirmada; o **parser** foi escrito a partir da documentação da comunidade sem validar com o aparelho físico — SpO₂/pulso são bem estabelecidos, curva pletismográfica e escala do PI podem precisar de ajuste (por isso o log em hex).

---

## 7. "Posso deixar conectado? Ele reconecta quando eu colocar o oxímetro de novo?"

Implementada a **reconexão automática**:
- **Na mesma sessão:** após autorizar uma vez, quando o oxímetro desliga a página entra em modo "aguardando" e reconecta sozinha quando ele volta — sem popup, sem clique. O botão **Desconectar** encerra o modo.
- **Entre sessões:** ao carregar, a página usa `navigator.bluetooth.getDevices()` para retomar o aparelho já autorizado.

---

## 8. "Quando o dispositivo desligar ou a página recarregar, quero que reconecte automaticamente"

Reforço técnico: para dispositivos vindos de `getDevices()` (pós-reload), o jeito confiável no Chrome é esperar um *advertisement* com `device.watchAdvertisements()` antes de chamar `gatt.connect()`. Implementado esse padrão nos dois cenários, com fallback para loop de tentativas a cada 3 s se `watchAdvertisements` não existir.

---

## 9. "Quando eu reinicio a página ele não conecta automático. Ele esquece? Não armazena no localStorage?"

- O código não esquece — **quem gerencia a permissão é o Chrome**, por segurança. `localStorage` não resolve: só guarda strings, e o objeto `BluetoothDevice`/a permissão não são serializáveis. O mecanismo correto é o `getDevices()` (já em uso).
- Causa mais provável do sintoma: **abrir o arquivo via `file://` (duplo clique)** — o Chrome não persiste permissões Bluetooth assim. Solução: servir via `http://localhost` (Docker ou `npx serve`).
- Outras causas: flag `chrome://flags/#enable-web-bluetooth-new-permissions-backend` desativada; conferir dispositivos lembrados em `chrome://settings/content/bluetoothDevices`.
- Adicionadas mensagens de **DIAGNÓSTICO** no log da página que apontam a causa exata ao recarregar.

---

## Estado final do projeto

```
ble/
├── index.html          # app Web Bluetooth completo (conexão, parser, curva, auto-reconnect, diagnóstico)
├── README.md           # instruções de uso e protocolo
├── Dockerfile          # nginx:alpine
├── docker-compose.yml  # porta 8080
└── CONVERSA.md         # este arquivo
```

**Pendências / próximos passos possíveis:**
- Testar com o oxímetro físico e ajustar o parser da curva pletismográfica/PI se necessário (usar o log em hex).
- Testar a reconexão pós-F5 via `http://localhost:8080` e verificar as linhas de DIAGNÓSTICO.
- Se quiser rodar no celular: publicar em HTTPS (GitHub Pages/Vercel).
- Para iPhone: migrar para app híbrido (Capacitor + `@capacitor-community/bluetooth-le`).
- Opcional: modo demo com dados sintéticos para desenvolver UI sem o aparelho.
