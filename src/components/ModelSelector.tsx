import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Cpu } from 'lucide-react';
import { fetchModels, ModelInfo } from '@/lib/api';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchModels().then((list) => {
      setModels(list);
      if (!value && list.length > 0) onChange(list[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fecha o menu ao clicar fora dele — antes só fechava escolhendo um modelo.
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const current = models.find((m) => m.id === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs text-text-dim hover:text-text-main hover:border-border-strong transition-colors"
      >
        <Cpu className="w-3.5 h-3.5" strokeWidth={1.5} />
        {current ? current.label : models.length === 0 ? 'Nenhum modelo configurado' : 'Selecionar modelo'}
        <ChevronDown className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-bg shadow-lg overflow-hidden">
          {models.length === 0 ? (
            <p className="px-3 py-3 text-xs text-text-faint">
              Adicione uma chave de API (ANTHROPIC_API_KEY, OPENAI_API_KEY, etc.) no arquivo .env do servidor.
            </p>
          ) : (
            // max-height + rolagem própria: com muitos modelos configurados a lista não
            // ultrapassa mais a tela (nem para baixo, nem pros lados) — antes crescia livre
            // e podia ficar cortada ou sair da viewport em telas menores.
            <div className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-surface transition-colors ${
                    m.id === value ? 'text-accent' : 'text-text-dim'
                  }`}
                >
                  <div className="font-medium">{m.label}</div>
                  <div className="text-text-faint">{m.goodFor}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
