// Regras de leitura do PDF do pedido — feitas pelo DADO, não pela posição das colunas.
// Funciona no navegador (GiraParser) e no Node (module.exports), para poder ser testado.
(function (root) {
  'use strict';

  // ---------- Código de barras (GS1) ----------
  function somaGs1(corpo) {
    let soma = 0, peso = 3;
    for (let i = corpo.length - 1; i >= 0; i--) {
      soma += Number(corpo[i]) * peso;
      peso = peso === 3 ? 1 : 3;
    }
    return soma;
  }

  // Dígito verificador válido? (EAN-8, UPC-12, EAN-13, GTIN-14/DUN-14)
  function dvOk(cod) {
    if (!/^(\d{8}|\d{12,14})$/.test(cod)) return false;
    return (10 - (somaGs1(cod.slice(0, -1)) % 10)) % 10 === Number(cod.slice(-1));
  }

  // DUN-14 = 1 dígito indicador + 12 dígitos do EAN-13 + novo dígito verificador.
  function eanDeDun14(dun) {
    const corpo = dun.slice(1, 13);
    return corpo + String((10 - (somaGs1(corpo) % 10)) % 10);
  }

  function classificarCodigo(cod) {
    if (!dvOk(cod)) return { tipo: 'invalido' };
    if (cod.length === 13) {
      if (/^[789]/.test(cod)) return { tipo: 'unidade', ean: cod, origem: 'lido' };
      return { tipo: 'interno', ean: null, origem: 'lido' }; // ex.: começa com 2 = uso interno da loja
    }
    if (cod.length === 14) {
      return { tipo: 'caixa', ean: eanDeDun14(cod), origem: 'derivado do DUN-14', indicador: cod[0] };
    }
    return { tipo: 'outro', ean: null };
  }

  // ---------- Números no formato brasileiro ----------
  const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
  const BR = '(\\d{1,3}(?:\\.\\d{3})*,\\d{2})';
  const RE_TRIPLA = new RegExp('(?:^|\\s)(\\d{1,5})\\s+(?:R\\$\\s*)?' + BR + '\\s+(?:R\\$\\s*)?' + BR + '(?:\\s|$)');
  const RE_TOTAL = new RegExp('Total\\s+(\\d{1,6})\\s+(?:R\\$\\s*)?' + BR, 'i');
  const RUIDO = /VENDEDOR|OR[CÇ]AMENTO|PEDIDO|PRODUTO\s+QTDE|QTDE\.?\s+PRE[CÇ]O|Feito em|www\.|@|\(\d{2}\)\s*\d|^Total\b|^P[aá]gina/i;

  // ---------- Linhas a partir do pdf.js (agrupa pela altura) ----------
  function linhasDePdfJs(itens) {
    const partes = itens
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ t: it.str, x: it.transform[4], y: it.transform[5] }));
    partes.sort((a, b) => (Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x));
    const linhas = [];
    let atual = null;
    for (const p of partes) {
      if (atual && Math.abs(atual.y - p.y) <= 3) atual.p.push(p);
      else { atual = { y: p.y, p: [p] }; linhas.push(atual); }
    }
    return linhas.map((l) => l.p.sort((a, b) => a.x - b.x).map((p) => p.t).join(' ').replace(/\s+/g, ' ').trim());
  }

  // ---------- Leitura do pedido ----------
  function analisar(linhas) {
    const codigos = [];   // { cod, ordem }
    const triplas = [];   // { qtd, un, total }
    const grupos = [];    // possíveis nomes de produto (linhas seguidas de texto)
    let grupo = [];
    let totalPdf = null;

    const fecharGrupo = () => { if (grupo.length) grupos.push(grupo.join(' ')); grupo = []; };

    for (const bruta of linhas) {
      const ln = bruta.trim();
      if (!ln) continue;

      const mt = ln.match(RE_TOTAL);
      if (mt) { totalPdf = { qtd: Number(mt[1]), valor: num(mt[2]) }; fecharGrupo(); continue; }

      const tr = ln.match(RE_TRIPLA);
      if (tr) { triplas.push({ qtd: Number(tr[1]), un: num(tr[2]), total: num(tr[3]) }); fecharGrupo(); }

      let achouCodigo = false;
      for (const m of ln.matchAll(/(?<!\d)(\d{13,14})(?!\d)/g)) { codigos.push(m[1]); achouCodigo = true; }

      if (tr || achouCodigo) { fecharGrupo(); continue; }
      if (/^C[oó]d\./i.test(ln) || RUIDO.test(ln) || (ln.match(/[A-Za-zÀ-ú]/g) || []).length < 6) { fecharGrupo(); continue; }
      grupo.push(ln);
    }
    fecharGrupo();

    const avisosGerais = [];
    if (codigos.length !== triplas.length) {
      avisosGerais.push('Achei ' + codigos.length + ' códigos de barras e ' + triplas.length + ' linhas com quantidade/preço: conferir uma a uma.');
    }
    const nomesOk = grupos.length === triplas.length;
    if (!nomesOk) avisosGerais.push('Não consegui separar os nomes com segurança (' + grupos.length + ' nomes para ' + triplas.length + ' linhas).');

    const itens = triplas.map((t, i) => {
      const cod = codigos[i] || null;
      const cl = cod ? classificarCodigo(cod) : { tipo: 'sem-codigo' };
      const avisos = [];
      const confere = Math.abs(t.total / t.qtd - t.un) < 0.0101;
      if (!confere) avisos.push('Total ÷ quantidade não bate com o preço unitário.');
      if (!cod) avisos.push('Sem código de barras nesta linha.');
      else if (cl.tipo === 'invalido') avisos.push('Código de barras com dígito verificador inválido.');
      else if (cl.tipo === 'interno') avisos.push('Código de uso interno (não é EAN de unidade): conferir.');
      if (cl.tipo === 'caixa') avisos.push('Veio só o código da caixa; o de unidade foi calculado a partir dele — conferir com a base do comprador. Unidades por caixa: não informado no PDF.');
      return {
        nome: nomesOk ? grupos[i] : '(nome não identificado)',
        qtd: t.qtd, precoUn: t.un, total: t.total, confereTotal: confere,
        codigoLido: cod, tipoCodigo: cl.tipo,
        indicadorEmbalagem: cl.indicador || null,
        eanUnidade: cl.ean || null, origemEan: cl.origem || null,
        avisos: avisos
      };
    });

    const somaTotal = Math.round(itens.reduce((s, i) => s + i.total, 0) * 100) / 100;
    const somaQtd = itens.reduce((s, i) => s + i.qtd, 0);
    const confereGeral = totalPdf ? (Math.abs(totalPdf.valor - somaTotal) < 0.02 && totalPdf.qtd === somaQtd) : null;
    if (confereGeral === false) avisosGerais.push('A soma das linhas não bate com o total impresso no PDF.');

    return { itens, totalPdf, somaTotal, somaQtd, confereGeral, avisosGerais };
  }

  const api = { dvOk, eanDeDun14, classificarCodigo, linhasDePdfJs, analisar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GiraParser = api;
})(typeof self !== 'undefined' ? self : this);
