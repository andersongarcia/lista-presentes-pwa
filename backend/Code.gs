/** 
 * Lista de Presentes – Backend (GAS)
 * Execução: "Me" | Acesso: "Anyone with link"
 * Planilha: usar o MESMO arquivo do RSVP, criando as abas novas.
 * 
 * ⚙️ CONFIGURAÇÃO
 * - Cole o ID da planilha em SPREADSHEET_ID.
 * - (Opcional) Defina ALLOWED_ORIGIN com o domínio do GitHub Pages (ex.: "https://seuusuario.github.io").
 */

const SPREADSHEET_ID = 'COLE_AQUI_O_ID_DA_SUA_PLANILHA';
const SHEET_PRESENTES = 'presentes';
const SHEET_CONFIRMACOES = 'confirmacoes_presentes';
const ALLOWED_ORIGIN = '*'; // para restringir depois: ex. "https://seuusuario.github.io"

/** Util: hora ISO com timezone local do servidor */
function isoNow() {
  return new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString();
}

/** Util: resposta com CORS */
function buildResponse_(statusCode, obj, contentType) {
  const headers = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
  if (contentType) headers['Content-Type'] = contentType;
  return ContentService
    .createTextOutput(typeof obj === 'string' ? obj : JSON.stringify(obj))
    .setMimeType(contentType ? ContentService.MimeType.JSON : ContentService.MimeType.TEXT)
    .setHeaders(headers);
}

/** Pré-checagem CORS */
function doOptions(e) {
  return buildResponse_(200, '', null);
}

/** GET: ?route=items  -> lista itens (catálogo) */
function doGet(e) {
  try {
    const route = (e && e.parameter && e.parameter.route) || '';
    if (route === 'items') {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const sh = ss.getSheetByName(SHEET_PRESENTES);
      if (!sh) {
        return buildResponse_(404, { error: 'Aba "presentes" não encontrada.' }, 'application/json');
      }
      const values = sh.getDataRange().getValues();
      if (values.length <= 1) {
        return buildResponse_(200, { items: [] }, 'application/json');
      }
      const header = values[0];
      const colIndex = (name) => header.indexOf(name);
      // mapeia somente colunas úteis no front
      const idxId = colIndex('id');
      const idxNome = colIndex('nome');
      const idxDesc = colIndex('descricao');
      const idxImg = colIndex('imagem');
      const idxStatus = colIndex('status');
      const idxPresenteado = colIndex('presenteado_por');

      const list = values.slice(1).map(row => ({
        id: String(row[idxId] || ''),
        nome: String(row[idxNome] || ''),
        descricao: String(row[idxDesc] || ''),
        imagem: String(row[idxImg] || ''),
        status: String(row[idxStatus] || '').toLowerCase(), // disponivel | presenteado
        presenteado_por: String(row[idxPresenteado] || '')
      })).filter(it => it.id);

      return buildResponse_(200, { items: list }, 'application/json');
    }

    // rota não encontrada
    return buildResponse_(404, { error: 'Rota inválida.' }, 'application/json');
  } catch (err) {
    return buildResponse_(500, { error: 'Erro interno', detalhe: String(err) }, 'application/json');
  }
}

/** POST: ?route=confirm  -> body JSON { id, nome, mensagem, token } */
function doPost(e) {
  try {
    const route = (e && e.parameter && e.parameter.route) || '';
    if (route !== 'confirm') {
      return buildResponse_(404, { error: 'Rota inválida.' }, 'application/json');
    }

    // parse body
    let payload = {};
    try {
      payload = JSON.parse(e.postData.contents || '{}');
    } catch (err) {
      return buildResponse_(400, { status: 'erro', detalhe: 'JSON inválido.' }, 'application/json');
    }

    // sanitizações e validações
    const id = (payload.id || '').trim();
    const nome = (payload.nome || '').trim();
    const mensagem = (payload.mensagem || '').trim();
    const token = (payload.token || '').trim();

    if (!id) return buildResponse_(400, { status: 'erro', detalhe: 'id é obrigatório.' }, 'application/json');
    if (!token) return buildResponse_(400, { status: 'erro', detalhe: 'token é obrigatório.' }, 'application/json');
    if (nome.length > 80) return buildResponse_(400, { status: 'erro', detalhe: 'nome excede 80 caracteres.' }, 'application/json');
    if (mensagem.length > 300) return buildResponse_(400, { status: 'erro', detalhe: 'mensagem excede 300 caracteres.' }, 'application/json');

    const nowIso = isoNow();
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const shItems = ss.getSheetByName(SHEET_PRESENTES);
    const shLog = ss.getSheetByName(SHEET_CONFIRMACOES);

    if (!shItems || !shLog) {
      return buildResponse_(500, { status: 'erro', detalhe: 'Abas "presentes" e/ou "confirmacoes_presentes" não encontradas.' }, 'application/json');
    }

    // localizar colunas em "presentes"
    const header = shItems.getRange(1, 1, 1, shItems.getLastColumn()).getValues()[0];
    const colIndex = (name) => header.indexOf(name) + 1; // 1-based
    const cId = colIndex('id');
    const cStatus = colIndex('status');
    const cPresenteadoPor = colIndex('presenteado_por');
    const cPresenteadoMsg = colIndex('presenteado_msg');
    const cPresenteadoToken = colIndex('presenteado_token');
    const cAtualizadoEm = colIndex('atualizado_em');

    if (!(cId && cStatus && cPresenteadoPor && cPresenteadoMsg && cPresenteadoToken && cAtualizadoEm)) {
      return buildResponse_(500, { status: 'erro', detalhe: 'Cabeçalho da aba "presentes" inválido ou incompleto.' }, 'application/json');
    }

    // buscar linha do item
    const lastRow = shItems.getLastRow();
    const idRange = shItems.getRange(2, cId, Math.max(0, lastRow - 1), 1).getValues();
    let foundRow = -1;
    for (let i = 0; i < idRange.length; i++) {
      if (String(idRange[i][0]).trim() === id) {
        foundRow = i + 2;
        break;
      }
    }
    if (foundRow === -1) {
      // logar erro
      shLog.appendRow([id, nome, mensagem, token, nowIso, 'erro', 'Item não encontrado.']);
      return buildResponse_(404, { status: 'erro', detalhe: 'Item não encontrado.' }, 'application/json');
    }

    // checar duplicidade no log (mesmo id + token)
    const logValues = shLog.getDataRange().getValues();
    const logHeader = logValues[0] || [];
    const idxIdItem = logHeader.indexOf('id_item');
    const idxToken = logHeader.indexOf('token');
    if (idxIdItem !== -1 && idxToken !== -1 && logValues.length > 1) {
      const dup = logValues.slice(1).some(r => String(r[idxIdItem]) === id && String(r[idxToken]) === token);
      if (dup) {
        shLog.appendRow([id, nome, mensagem, token, nowIso, 'duplicado_mesmo_token', 'Confirmação duplicada pelo mesmo token.']);
        return buildResponse_(200, { status: 'duplicado_mesmo_token' }, 'application/json');
      }
    }

    // lock para consistência
    const lock = LockService.getScriptLock();
    lock.tryLock(5000);

    // revalidar status atual antes de alterar
    const statusAtual = String(shItems.getRange(foundRow, cStatus).getValue()).toLowerCase();
    if (statusAtual === 'presenteado') {
      shLog.appendRow([id, nome, mensagem, token, nowIso, 'ja_presenteado', 'Item já presenteado.']);
      lock.releaseLock();
      return buildResponse_(200, { status: 'ja_presenteado' }, 'application/json');
    }

    // atualizar linha
    shItems.getRange(foundRow, cStatus).setValue('presenteado');
    shItems.getRange(foundRow, cPresenteadoPor).setValue(nome || '');
    shItems.getRange(foundRow, cPresenteadoMsg).setValue(mensagem || '');
    shItems.getRange(foundRow, cPresenteadoToken).setValue(token);
    shItems.getRange(foundRow, cAtualizadoEm).setValue(nowIso);

    // log ok
    shLog.appendRow([id, nome, mensagem, token, nowIso, 'ok', '']);

    lock.releaseLock();
    return buildResponse_(200, { status: 'ok' }, 'application/json');

  } catch (err) {
    try {
      const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      const shLog = ss.getSheetByName(SHEET_CONFIRMACOES);
      if (shLog) {
        shLog.appendRow(['', '', '', '', isoNow(), 'erro', String(err)]);
      }
    } catch (_) {}
    return buildResponse_(500, { status: 'erro', detalhe: String(err) }, 'application/json');
  }
}
