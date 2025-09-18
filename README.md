# Lista de Presentes – PWA + GAS

PWA (HTML/CSS/JS + Manifest + Service Worker) para a Lista de Presentes do casamento de **Giselle & Anderson**, com backend mínimo em **Google Apps Script** lendo/escrevendo **no MESMO Google Sheets** do RSVP (em *abas novas*).

## Estrutura das Abas (na mesma planilha do RSVP)

Crie DUAS abas **novas**:

### 1) `presentes`
**Cabeçalho (linha 1) EXATA:**
A: `id`  
B: `nome`  
C: `descricao`  
D: `imagem`  
E: `status` (`disponivel` | `presenteado`)  
F: `presenteado_por`  
G: `presenteado_msg`  
H: `presenteado_token`  
I: `atualizado_em`

**Exemplos de linhas (2~6):**
P001 | Jogo de Toalhas | Conjunto macio para banho | (deixe vazio ou URL) | disponivel | | | |
P002 | Conjunto de Pratos | 6 pratos rasos | | disponivel | | | |
P003 | Panela de Pressão | Cozinha do dia-a-dia | | disponivel | | | |
P004 | Liquidificador | Útil para sucos e vitaminas | | disponivel | | | |
P005 | Jogo de Taças | Para brindar | | disponivel | | | |


### 2) `confirmacoes_presentes`
**Cabeçalho (linha 1):**
A: `id_item`  
B: `nome_convidado`  
C: `mensagem`  
D: `token`  
E: `horario`  
F: `resultado` (`ok`, `ja_presenteado`, `duplicado_mesmo_token`, `erro`, etc.)  
G: `detalhe`

> O **front-end não escreve diretamente** nas células. Todas as operações passam pelo Web App (GAS).

---

## Backend (Google Apps Script)

1. Crie um projeto Apps Script (standalone) e **cole o conteúdo de `backend/Code.gs`**.
2. Substitua:
   - `SPREADSHEET_ID` pelo **ID da planilha** do RSVP (o mesmo arquivo).
   - (Opcional) `ALLOWED_ORIGIN` para o domínio do seu GitHub Pages (ex.: `https://seuusuario.github.io`).
3. **Implantar**: `Deploy > New deployment > Web app`
   - **Execute as**: *Me*
   - **Who has access**: *Anyone with the link*
   - Copie a URL do Web App (termina com `/exec`).

---

## Front-end (PWA)

1. Em um repositório **GitHub** (pages), crie a pasta `frontend/` e coloque os arquivos:
   - `index.html`, `styles.css`, `app.js`, `service-worker.js`, `manifest.webmanifest`
   - `icons/icon-192.png`, `icons/icon-512.png`, `icons/gift-placeholder.svg`
2. Abra `app.js` e **cole a URL do Web App** do GAS em `BASE_API`.
3. Faça commit/push e ative o **GitHub Pages** (Branch: `main`/`docs`, pasta raiz onde estão os arquivos).
4. Acesse a URL do Pages pelo navegador (celular/desktop).

---

## Segurança & Ética

- Sem dados sensíveis: nome/mensagem são opcionais e curtos.
- **Token anônimo**: gerado em `localStorage` (`giftlist_token`) para impedir confirmações repetidas do MESMO item pelo mesmo visitante.
- **CORS**: por padrão `*`. Para produção, restrinja em `ALLOWED_ORIGIN`.
- **Validações** no backend:
  - `nome` <= 80 chars
  - `mensagem` <= 300 chars

---

## Como funciona

- **Lista**: `GET ${BASE_API}?route=items`
  - Retorna: `[{ id, nome, descricao, imagem, status, presenteado_por }, ...]`
- **Confirmar**: `POST ${BASE_API}?route=confirm`
  - Body: `{ id, nome, mensagem, token }`
  - Regras:
    - Se item já `presenteado` → `{status:"ja_presenteado"}`
    - Se já houver log com **mesmo `id` e `token`** → `{status:"duplicado_mesmo_token"}`
    - Caso válido:
      - Atualiza `presentes` (status/por/msg/token/atualizado_em)
      - Registra em `confirmacoes_presentes` com `ok`
      - Retorna `{status:"ok"}`

---

## PWA

- Cache básico via `service-worker.js` para shell estático.
- `network-first` para `/items`, com fallback offline simples.
- `manifest.webmanifest` com tema e ícones (substitua os placeholders por ícones reais 192×192 e 512×512).

---

## Acessibilidade

- Labels, foco nos inputs, botões com texto claro.
- Status (toasts) em região `aria-live`.
- Layout responsivo e contrastes adequados (Material-like).

---

## Dicas

- Para imagens por item, cole uma **URL pública** na coluna `imagem`. Se vazia, usamos `icons/gift-placeholder.svg`.
- Para “limpar” uma confirmação (ex.: ajuste manual), basta voltar o `status` para `disponivel` e limpar as colunas `presenteado_*` na aba `presentes`.

Bom deploy! 🎉
