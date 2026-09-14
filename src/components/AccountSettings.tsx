import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, User, Check, Loader2, Camera, BrainCircuit, Trash2 } from 'lucide-react';
import { Session } from '@supabase/supabase-js';
import {
  ACCOUNT_SEGMENTS,
  MyProfile,
  getMyProfile,
  updateMyProfile,
  updateMyPassword,
  uploadAvatar,
} from '@/lib/account';
import { MemoryNote, listMemory, deleteMemoryNote } from '@/lib/memory';

interface AccountSettingsProps {
  session: Session;
  onNavigate: (page: 'home' | 'chat' | 'cowork' | 'projects' | 'artifacts' | 'account') => void;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function AccountSettings({ session, onNavigate }: AccountSettingsProps) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [fullName, setFullName] = useState('');
  const [segment, setSegment] = useState<string>('');
  const [profileSave, setProfileSave] = useState<SaveState>('idle');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSave, setPasswordSave] = useState<SaveState>('idle');

  const [memory, setMemory] = useState<MemoryNote[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(true);

  useEffect(() => {
    getMyProfile(session.user.id).then((p) => {
      setProfile(p);
      setFullName(p?.full_name ?? '');
      setSegment(p?.segment ?? '');
      setLoading(false);
    });
  }, [session.user.id]);

  useEffect(() => {
    if (!session.access_token) return;
    listMemory(session.access_token).then((notes) => {
      setMemory(notes);
      setMemoryLoading(false);
    });
  }, [session.access_token]);

  const handleForgetNote = async (id: string) => {
    setMemory((prev) => prev.filter((n) => n.id !== id));
    await deleteMemoryNote(session.access_token, id);
  };

  const handleSaveProfile = async () => {
    setProfileSave('saving');
    const ok = await updateMyProfile(session.user.id, { full_name: fullName.trim(), segment: segment || null });
    if (ok) {
      setProfile((prev) => (prev ? { ...prev, full_name: fullName.trim(), segment: segment || null } : prev));
      setProfileSave('saved');
      setTimeout(() => setProfileSave('idle'), 1800);
    } else {
      setProfileSave('error');
    }
  };

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadAvatar(session.user.id, file);
    if (url) setProfile((prev) => (prev ? { ...prev, avatar_url: url } : prev));
    setUploadingAvatar(false);
    e.target.value = '';
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }
    setPasswordSave('saving');
    const error = await updateMyPassword(newPassword);
    if (error) {
      setPasswordError(error);
      setPasswordSave('error');
    } else {
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSave('saved');
      setTimeout(() => setPasswordSave('idle'), 1800);
    }
  };

  const initial = (profile?.full_name || session.user.email || '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-bg text-text-main">
      <div className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button
            onClick={() => onNavigate('chat')}
            className="flex items-center gap-1.5 text-sm text-text-dim hover:text-text-main transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            Voltar
          </button>
          <span className="text-text-faint">/</span>
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <User className="w-4 h-4" strokeWidth={1.5} />
            Conta
          </span>
        </div>
      </div>

      {loading ? (
        <p className="max-w-3xl mx-auto px-6 py-10 text-sm text-text-faint">Carregando…</p>
      ) : (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          {/* Avatar + nome */}
          <section className="rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-medium mb-4">Perfil</h2>
            <div className="flex items-center gap-4 mb-5">
              <button
                onClick={handlePickAvatar}
                className="relative w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center text-xl font-medium overflow-hidden flex-shrink-0 group"
                title="Trocar foto de perfil"
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5 text-white" strokeWidth={1.5} />
                  )}
                </span>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              <div>
                <p className="text-sm text-text-main">{session.user.email}</p>
                <button onClick={handlePickAvatar} className="text-xs text-accent hover:underline">
                  Trocar foto
                </button>
              </div>
            </div>

            <div className="space-y-4 max-w-sm">
              <div>
                <label className="block text-xs text-text-faint mb-1">Nome</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border-strong"
                />
              </div>

              <div>
                <label className="block text-xs text-text-faint mb-1">Área de uso</label>
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border-strong"
                >
                  <option value="">Prefiro não dizer</option>
                  {ACCOUNT_SEGMENTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-text-faint mt-1">Usado só pra ajustar sugestões e exemplos à sua área.</p>
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={profileSave === 'saving'}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-text-main text-bg text-sm font-medium disabled:opacity-60 hover:opacity-90 transition-opacity"
              >
                {profileSave === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {profileSave === 'saved' && <Check className="w-3.5 h-3.5" />}
                {profileSave === 'saving' ? 'Salvando…' : profileSave === 'saved' ? 'Salvo' : 'Salvar alterações'}
              </button>
              {profileSave === 'error' && <p className="text-xs text-red-400">Não foi possível salvar. Tente de novo.</p>}
            </div>
          </section>

          {/* Senha */}
          <section className="rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-medium mb-4">Trocar senha</h2>
            <div className="space-y-4 max-w-sm">
              <div>
                <label className="block text-xs text-text-faint mb-1">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border-strong"
                />
              </div>
              <div>
                <label className="block text-xs text-text-faint mb-1">Confirmar nova senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:border-border-strong"
                />
              </div>
              {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
              <button
                onClick={handleChangePassword}
                disabled={passwordSave === 'saving' || !newPassword}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border text-sm text-text-main disabled:opacity-50 hover:bg-surface-2 transition-colors"
              >
                {passwordSave === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {passwordSave === 'saved' && <Check className="w-3.5 h-3.5" />}
                {passwordSave === 'saving' ? 'Trocando…' : passwordSave === 'saved' ? 'Senha alterada' : 'Trocar senha'}
              </button>
            </div>
          </section>

          {/* Memória — item 9 do backlog */}
          <section className="rounded-xl border border-border bg-surface/40 p-5">
            <h2 className="text-sm font-medium mb-1 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" strokeWidth={1.5} />
              Memória
            </h2>
            <p className="text-xs text-text-faint mb-4">
              Fatos e preferências que a IA aprendeu em conversas anteriores e usa para
              personalizar as próximas respostas. Você pode apagar qualquer um deles.
            </p>

            {memoryLoading ? (
              <p className="text-xs text-text-faint">Carregando…</p>
            ) : memory.length === 0 ? (
              <p className="text-xs text-text-faint">Nada guardado ainda — vai se formando conforme você conversa.</p>
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {memory.map((note) => (
                  <li
                    key={note.id}
                    className="group flex items-start justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-bg text-xs text-text-dim"
                  >
                    <span className="flex-1">{note.content}</span>
                    <button
                      onClick={() => handleForgetNote(note.id)}
                      className="p-1 text-text-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      title="Esquecer este fato"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
