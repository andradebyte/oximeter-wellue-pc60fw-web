# Como o oxímetro PC-60FW envia dados — guia simples

> Tudo o que você precisa saber sobre a comunicação Bluetooth do PC-60FW,
> explicado do zero. Fontes no final.

---

## 1. A ideia geral (em 30 segundos)

O oxímetro **não espera ninguém perguntar nada**. Assim que você coloca o dedo,
ele liga e começa a **transmitir sozinho**, várias vezes por segundo, pequenos
pacotes de bytes via Bluetooth Low Energy (BLE). O trabalho do seu app é só:

1. **Conectar** no aparelho;
2. **Assinar as notificações** (dizer "me avise quando chegar dado novo");
3. **Interpretar os bytes** que chegam.

Você não precisa enviar nenhum comando para receber SpO₂, pulso e curva —
é tudo "de graça", empurrado pelo aparelho.

---

## 2. Por onde os dados passam (o "canal")

BLE organiza tudo em **serviços** e **características** (pense em "pastas" e
"arquivos"). O PC-60FW usa um serviço genérico de porta serial chamado
**Nordic UART Service (NUS)**:

| O quê | UUID | Papel |
|-------|------|-------|
| Serviço | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | A "pasta" onde tudo mora |
| Característica de **notificação** (RX do seu app) | `6e400003-...` | Por aqui o oxímetro **envia** dados pra você |
| Característica de **escrita** (TX do seu app) | `6e400002-...` | Por aqui você **enviaria** comandos (não é necessário para ler os vitais) |

O seu `index.html` usa só a de notificação — e é o suficiente.

---

## 3. O que são esses hexadecimais?

Tudo que trafega no Bluetooth são **bytes** — números de 0 a 255. Hexadecimal
é só um jeito compacto de escrever esses números, usando base 16:

- `0x61` em hexadecimal = **97** em decimal → um SpO₂ de 97%
- `0x48` = **72** → um pulso de 72 bpm
- `0xAA` = 170, `0x55` = 85 → usados como "assinatura" de início de pacote

Ou seja: quando o log da página mostra `aa 55 0f 08 01 61 48 ...`, isso é uma
sequência de números. O "segredo" do protocolo é saber **qual posição significa
o quê** — e é isso que a comunidade descobriu por engenharia reversa.

---

## 4. Anatomia de um pacote (frame)

Todo pacote do PC-60FW segue este molde:

```
AA 55 | TT | LL | FF | dados... | CS
```

| Campo | Significado |
|-------|-------------|
| `AA 55` | **Início de pacote.** Sempre esses 2 bytes — servem para achar onde um frame começa no meio do fluxo. |
| `TT` | **Token/categoria:** `0x0F` = dados de medição · `0xF0` = dados do aparelho (bateria, status) |
| `LL` | **Comprimento:** quantos bytes ainda vêm depois deste campo |
| `FF` | **Função/tipo:** diz qual é o conteúdo (`0x01` vitais, `0x02` curva, etc.) |
| `dados...` | O conteúdo em si |
| `CS` | **Checksum** (CRC-8 Maxim): byte de verificação para detectar dados corrompidos |

---

## 5. Os pacotes que chegam, um por um

### 5.1 Vitais — SpO₂, pulso e perfusão 🩸

**Chega ~1 vez por segundo** enquanto o dedo está no aparelho.

```
AA 55 0F 08 01 [SpO2] [Pulso] ?? [PI] 00 C0 [CS]
posição:  0  1  2  3  4    5       6    7   8   9 10   11
```

| Byte | O quê | Como interpretar |
|------|-------|-------------------|
| 5 | SpO₂ | Valor direto em % (ex.: `0x61` = 97%) |
| 6 | Pulso | Valor direto em bpm (ex.: `0x48` = 72) |
| 8 | Índice de perfusão (PI) | Dividir por 10 (ex.: `0x2D` = 45 → PI 4,5) |

> Enquanto o aparelho ainda está "procurando" o sinal, ele pode mandar 0 ou
> valores inválidos — por isso o app ignora SpO₂ fora de 1–100.

### 5.2 Curva pletismográfica (a "onda" do pulso) 📈

**Chega ~12 vezes por segundo, com 5 amostras cada** → **~60 amostras/segundo**
no total. É o pacote mais frequente de todos.

```
AA 55 0F 07 02 [a1] [a2] [a3] [a4] [a5] [CS]
posição:  0  1  2  3  4   5    6    7    8    9   10
```

Cada amostra (`a1`…`a5`) é um byte onde:

- **bits 0–6** (valor 0–127): a **amplitude** da onda naquele instante;
- **bit 7** (quando o byte é ≥ 128, ou seja ≥ `0x80`): marcador de
  **batimento detectado** — o próprio aparelho "carimba" a amostra logo após
  o pico de cada pulso.

Para ler a amplitude ignorando o marcador: `valor & 0x7F`.

> ⚠️ O `index.html` atual lê **só a primeira amostra** de cada pacote — a curva
> exibida tem 1/5 da resolução real. Corrigir isso é o upgrade mais valioso.

### 5.3 Bateria 🔋

**Chega de vez em quando** (não tem período fixo garantido).

```
AA 55 F0 03 03 [nível] [CS]
```

O byte de nível vai de **0 a 3**: 0 ≈ vazia, 3 ≈ cheia. É a mesma escala das
barrinhas no visor do aparelho — não existe porcentagem exata.

### 5.4 Pacotes ainda misteriosos ❓

- Tipo `0x21` (dentro de `0x0F`): estrutura conhecida, significado não —
  suspeita-se de status do dedo/da medição.
- Um pacote curto de "heartbeat" com token `0xF0`: o aparelho dizendo "estou
  vivo"; pode ser ignorado.

O log em hex da sua página existe justamente para capturar esses — se aparecer
algo estranho lá, é um desses pacotes esperando ser decodificado.

---

## 6. Detalhe importante: os pacotes chegam "picados"

O BLE entrega os dados em **pedaços (chunks)** que **não respeitam** as
fronteiras dos pacotes. Uma notificação pode trazer:

- meio pacote (o resto vem na próxima);
- um pacote e meio;
- vários pacotes grudados.

Por isso o código mantém um **buffer**: junta tudo que chega, procura o `AA 55`,
lê o campo de comprimento e só processa quando o pacote está completo. Nunca
assuma que "1 notificação = 1 pacote".

---

## 7. Linha do tempo de uma sessão típica

```
Você coloca o dedo
   └─ oxímetro liga e começa a anunciar (advertising)
        └─ app conecta e assina notificações
             ├─ curva: ~12 pacotes/s (5 amostras cada, ~60 Hz)
             ├─ vitais: ~1 pacote/s (SpO₂, pulso, PI)
             └─ bateria/status: esporádico
Você tira o dedo
   └─ após alguns segundos o oxímetro DESLIGA sozinho
        └─ a conexão cai (isso é NORMAL, não é bug)
             └─ o app fica aguardando e reconecta quando o dedo voltar
```

---

## 8. Regras do jogo (limitações que valem saber)

- **1 conexão por vez.** Se o app ViHealth estiver conectado, sua página não
  enxerga o aparelho (e vice-versa). Enquanto conectado, ele também some de
  qualquer scanner BLE.
- **Só transmite medindo.** Sem dedo = desligado = invisível no Bluetooth.
- **Não tem memória.** O aparelho não guarda histórico acessível por BLE —
  o que seu app não gravar na hora, perdeu.
- **Não envia dado bruto dos sensores.** Os valores de SpO₂/pulso/PI já vêm
  calculados pelo chip do aparelho; não há acesso aos sinais dos LEDs
  vermelho/infravermelho.
- **Valores de "aquecimento".** Nos primeiros segundos os números podem vir
  zerados ou instáveis até o aparelho travar o sinal.

---

## 9. O que dá pra construir com esses dados

| Dado disponível | O que permite |
|-----------------|---------------|
| SpO₂ + pulso a 1 Hz | Histórico, gráficos de tendência, exportar CSV, alertas (ex.: SpO₂ < 90%) |
| Curva a ~60 Hz | Onda bonita e fiel, estimativa de frequência respiratória (experimental) |
| Marcador de batimento (bit 7) | Intervalos entre batimentos → variabilidade de pulso, detecção de ritmo irregular |
| Estatísticas derivadas | Mín/média/máx da sessão, tempo abaixo de 90%, contagem de dessaturações |

---

## Fontes

- [afibTuner](https://github.com/johnreine/afibTuner) — detalhou os pacotes de curva (5 amostras + bit de batimento)
- [sza2/viatom_pc60fw](https://github.com/sza2/viatom_pc60fw) — estrutura dos frames e checksum CRC-8
- [anaesthetics.app](https://anaesthetics.app/blog/posts/2020/bluetooth/) — primeira engenharia reversa publicada com Web Bluetooth
- [Thread ESPHome / Home Assistant](https://community.home-assistant.io/t/esphome-config-to-read-from-pc-60fw-bluetooth-pulse-oximeter-and-display-locally/884140) — confirmação independente de vitais e bateria

> ⚠️ Protocolo mapeado pela comunidade, sem documentação oficial do fabricante.
> Uso educacional/pessoal — não é validado para uso clínico.
