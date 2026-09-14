export interface ExtractedFile {
  path: string;
  content: string;
  truncated: boolean;
  binary: boolean;
}

interface ExtractResponse {
  isZip: boolean;
  files: ExtractedFile[];
  totalEntries?: number;
  error?: string;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // FileReader.readAsDataURL vem como "data:<mime>;base64,AAAA" — só queremos a parte de dados.
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Envia o arquivo (qualquer tipo, incluindo .zip) pro servidor extrair o conteúdo
 *  legível. .zip é expandido em uma entrada por arquivo interno. */
export async function extractFile(file: File): Promise<ExtractResponse> {
  try {
    const base64 = await readFileAsBase64(file);
    const res = await fetch('/api/files/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: file.name, base64 }),
    });
    // Corpo grande demais (ex.: .zip de projeto real) pode ser rejeitado pelo body-parser
    // do Express ANTES de chegar na rota — nesse caso a resposta não é JSON, e sem esse
    // tratamento a Promise nunca resolvia com um erro visível (ficava "Lendo arquivo…" para sempre).
    let data: any;
    try {
      data = await res.json();
    } catch {
      return {
        isZip: false,
        files: [],
        error: res.status === 413
          ? 'Arquivo grande demais para anexar.'
          : `Falha ao processar o arquivo (status ${res.status}).`,
      };
    }
    if (!res.ok) return { isZip: false, files: [], error: data.error || 'Falha ao processar o arquivo.' };
    return data;
  } catch (err: any) {
    return { isZip: false, files: [], error: err?.message || 'Falha ao ler o arquivo.' };
  }
}

/** Monta o bloco de texto (com marcações claras) que vai ser somado à mensagem do
 *  usuário, pra IA conseguir ler e citar o conteúdo de cada arquivo enviado. */
export function formatFilesForMessage(fileName: string, result: ExtractResponse): string {
  if (result.error) return `[Não foi possível ler o arquivo "${fileName}": ${result.error}]`;

  const parts = result.files.map((f) => {
    if (f.binary) return `### Arquivo: ${f.path}\n(arquivo binário — conteúdo não pôde ser exibido como texto)`;
    const suffix = f.truncated ? '\n[...conteúdo truncado...]' : '';
    return `### Arquivo: ${f.path}\n\`\`\`\n${f.content}${suffix}\n\`\`\``;
  });

  const header = result.isZip
    ? `[Anexo: ${fileName} — arquivo .zip com ${result.files.length} arquivo(s)${
        result.totalEntries && result.totalEntries > result.files.length ? ` de ${result.totalEntries} no total` : ''
      }]`
    : `[Anexo: ${fileName}]`;

  return `${header}\n\n${parts.join('\n\n')}`;
}
