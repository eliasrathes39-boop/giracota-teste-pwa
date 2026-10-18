# GiraCota — protótipo "Compartilhar PDF" (Android)

Projeto separado. Não mexe no `agente-cotacao`.

## Publicar (5 min)
1. GitHub → **New repository** → `giracota-teste-pwa`.
2. **Add file → Upload files**: envie `index.html`, `sw.js`, `parser.js`, `manifest.webmanifest`, `vercel.json` e a pasta `icons/`.
3. Vercel → **Add New → Project** → importe `giracota-teste-pwa` → Framework **Other** → **Deploy**.
4. Abra o endereço `https://…vercel.app` no **Chrome do Android**.

## Testar
1. Chrome → ⋮ → **Instalar app** (não vale "Adicionar atalho").
2. Abra o Will Força de Vendas → gere o PDF do pedido → **Compartilhar** → **GiraCota**.
3. O app abre sozinho já com o PDF lido.

## O que conferir
- GiraCota aparece na lista do Compartilhar?
- PDF abre sem copiar link nem escolher arquivo?
- Linhas, quantidades e total batem com o PDF?
- Caixa × unidade aparecem certos?

## Regra de código de barras
- 13 dígitos, começa com 7/8/9 → **unidade**.
- 14 dígitos (DUN-14) → **caixa**; o 1º dígito indica o tipo de embalagem.
- O código de unidade é calculado a partir do da caixa (confere no machado: 27891117059367 → 7891117059363) e fica marcado "calculado — conferir".
- Dígito verificador inválido ou sem código → aviso, nunca passa em silêncio.

## Depois, no site de verdade
Copiar `manifest.webmanifest`, `sw.js` e `icons/` para `public/` do `agente-cotacao`, e trocar o `/receber` pela tela de upload do link do fornecedor.
