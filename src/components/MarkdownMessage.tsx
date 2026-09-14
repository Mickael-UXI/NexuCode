import { useState, memo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Copy, Check, FileCode } from 'lucide-react';

/**
 * Renderização de markdown "de verdade" para as mensagens do chat.
 *
 * Substitui o antigo parser baseado em regex + dangerouslySetInnerHTML
 * (Chat.tsx e Cowork.tsx tinham cada um a sua cópia, vulnerável a XSS
 * porque qualquer HTML vindo do modelo era injetado direto no DOM).
 *
 * react-markdown nunca usa dangerouslySetInnerHTML por padrão — ele
 * converte o markdown em elementos React normais, então texto como
 * "<img src=x onerror=...>" é exibido como texto, não executado.
 *
 * Suporta: tabelas, listas (inclusive aninhadas e tarefas `- [ ]`),
 * blocos de código com highlight de sintaxe real, links seguros
 * (rel=noopener, abrem em nova aba), negrito/itálico, citações, etc.
 *
 * O formato especial usado no modo Cowork para gerar arquivos
 * (```linguagem:caminho/arquivo.ext```) continua funcionando: o
 * componente de código detecta o ":" na linguagem informada e mostra
 * o caminho do arquivo no cabeçalho do bloco, exatamente como antes.
 */

type CodeBlockProps = ComponentPropsWithoutRef<'code'>;

function CodeBlock({ className, children, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const raw = String(children).replace(/\n$/, '');

  // react-markdown (v8+) não passa mais uma prop "inline": a forma
  // confiável de diferenciar é que apenas blocos ```cercados``` ganham
  // uma className "language-*" (via rehype-highlight); código inline
  // (`assim`) nunca tem className.
  const isInline = !className;

  if (isInline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded bg-surface-2 text-accent font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  }

  // className vem como "language-ts:src/foo.ts" quando o modelo usa
  // o formato ```ts:caminho para o modo Cowork; separamos aqui.
  const langMatch = /language-([\w-]*)(?::(.+))?/.exec(className || '');
  const lang = langMatch?.[1] || '';
  const filePath = langMatch?.[2]?.trim();

  const handleCopy = () => {
    navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lines = raw.split('\n');

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-border not-prose">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2 border-b border-border">
        <span className="text-xs text-text-faint font-mono flex items-center gap-1.5">
          {filePath ? <FileCode className="w-3 h-3" /> : null}
          {filePath || lang || 'código'}
        </span>
        <button
          onClick={handleCopy}
          className="text-text-faint hover:text-accent transition-colors"
          title="Copiar código"
        >
          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <pre className="p-3.5 bg-surface overflow-x-auto max-h-96">
        <code className={`text-sm font-mono leading-relaxed hljs ${className || ''}`}>
          {lines.map((line, j) => (
            <div key={j} className="flex">
              <span className="text-text-faint mr-3 select-none shrink-0">
                {String(j + 1).padStart(2, '0')}
              </span>
              <span>{line || '\u00A0'}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}

function MarkdownMessageImpl({ content }: { content: string }) {
  return (
    <div className="text-text-dim leading-relaxed text-[0.95rem] space-y-2 [&_p]:my-1.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-text-main [&_h1]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-text-main [&_h2]:mt-3 [&_h3]:font-semibold [&_h3]:text-text-main [&_strong]:text-text-main [&_strong]:font-semibold [&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-text-faint [&_table]:w-full [&_table]:text-sm [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-surface-2 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_hr]:border-border">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }] as any]}
        components={{
          code: CodeBlock as any,
          a: ({ href, children, ...props }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" {...props}>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// memo evita re-renderizar (e re-parsear markdown) mensagens antigas
// a cada token novo recebido via streaming na mensagem atual.
export default memo(MarkdownMessageImpl, (prev, next) => prev.content === next.content);
