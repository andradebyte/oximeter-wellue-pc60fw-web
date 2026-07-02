# Oxímetro PC-60FW via Web Bluetooth

Exemplo de PWA/página web que conecta no oxímetro Wellue/Viatom **PC-60FW** usando a
Web Bluetooth API — sem precisar do app ViHealth.

## Como testar

### No PC (Windows/Mac/Linux)

1. Abra o `index.html` no **Chrome** ou **Edge** (duplo clique funciona).
2. Coloque o dedo no oxímetro — ele liga e começa a anunciar via BLE.
3. Clique em **Conectar oxímetro** e selecione o `PC-60F_SN...` no popup.

> O computador precisa ter Bluetooth 4.0+ (BLE).

### Com Docker

```bash
docker compose up -d --build
```

Depois acesse **http://localhost:8080** no Chrome/Edge do próprio PC.

> Web Bluetooth só funciona em contexto seguro: `localhost` vale, mas o IP da rede
> (ex.: `http://192.168.0.10:8080`) **não** — para acessar de outro aparelho veja a
> seção do celular abaixo.

### No celular Android

Web Bluetooth exige HTTPS ou `localhost`, então para testar no celular sirva a página:

```bash
# na pasta do projeto
npx serve .
```

Depois acesse pelo Chrome do celular usando o IP do PC (ex.: `http://192.168.0.10:3000`) —
como não é localhost, habilite a flag `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
com essa URL **apenas para teste**, ou publique em qualquer host HTTPS
(GitHub Pages, Vercel, Netlify) e teste direto.

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
- O oxímetro desliga sozinho ao tirar o dedo — a queda de conexão é normal; basta
  colocar o dedo e conectar de novo.

## Créditos / referências

- Protocolo mapeado pela comunidade: [anaesthetics.app/blog](https://anaesthetics.app/blog/posts/2020/bluetooth/)
  e [ESPHome + PC-60FW (Home Assistant Community)](https://community.home-assistant.io/t/esphome-config-to-read-from-pc-60fw-bluetooth-pulse-oximeter-and-display-locally/884140)

> ⚠️ Uso educacional/pessoal. Não é um dispositivo validado para uso clínico via terceiros.
