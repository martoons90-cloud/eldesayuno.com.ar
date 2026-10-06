import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  Users,
  Plus,
  Check,
  X,
  Palette,
  Shield,
  KeyRound,
  Info,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingUser: User | null;
  allUsers: User[];
  onSaveUser: (userData: {
    id?: string;
    name: string;
    email: string;
    phone: string;
    partName: string;
    cabezaNumber?: number;
    annualQuotaDays: number;
    color: string;
    password?: string;
    role?: 'owner' | 'admin';
  }) => void;
}

// Preset color options for new Cabezas
const PRESET_COLORS = [
  { name: 'Rojo Carmesí', hex: '#DC2626' },
  { name: 'Verde Bosque', hex: '#16A34A' },
  { name: 'Azul Real', hex: '#2563EB' },
  { name: 'Ámbar Cálido', hex: '#D97706' },
  { name: 'Púrpura Imperial', hex: '#7C3AED' },
  { name: 'Verde Azulado', hex: '#0D9488' },
  { name: 'Índigo Profundo', hex: '#4F46E5' },
  { name: 'Rosa Salmón', hex: '#DB2777' },
  { name: 'Naranja Fuego', hex: '#EA580C' },
  { name: 'Gris Grafito', hex: '#475569' },
];

export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  editingUser,
  allUsers,
  onSaveUser,
}) => {
  if (!isOpen) return null;

  // Extract unique existing Cabezas from users list
  const existingCabezasMap = new Map<
    string,
    {
      key: string;
      partName: string;
      cabezaNumber?: number;
      color: string;
      members: User[];
    }
  >();

  allUsers.forEach((u) => {
    const key = u.partName || (u.cabezaNumber ? `Cabeza ${u.cabezaNumber}` : 'Sin Cabeza');
    if (!existingCabezasMap.has(key)) {
      existingCabezasMap.set(key, {
        key,
        partName: u.partName || key,
        cabezaNumber: u.cabezaNumber,
        color: u.color || '#DC2626',
        members: [],
      });
    }
    existingCabezasMap.get(key)!.members.push(u);
  });

  const existingCabezasList = Array.from(existingCabezasMap.values());

  // Form State
  const [cabezaMode, setCabezaSelectionMode] = useState<'existing' | 'new'>('existing');
  const [selectedCabezaKey, setSelectedCabezaKey] = useState<string>(
    existingCabezasList.length > 0 ? existingCabezasList[0].key : ''
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [annualQuotaDays, setAnnualQuotaDays] = useState<number>(30);
  const [role, setRole] = useState<'owner' | 'admin'>('owner');

  // New Cabeza Form State
  const [newPartName, setNewPartName] = useState('');
  const [newCabezaColor, setNewCabezaColor] = useState('#7C3AED');

  // Helper to generate random 6-character password
  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Populate data when editing or opening modal
  useEffect(() => {
    if (editingUser) {
      setName(editingUser.name);
      setEmail(editingUser.email);
      setPhone(editingUser.phone || '');
      setPassword(editingUser.password || '');
      setAnnualQuotaDays(editingUser.annualQuotaDays || 30);
      setRole(editingUser.role || 'owner');

      // Check if editingUser's partName matches an existing Cabeza
      const matched = existingCabezasList.find(
        (c) => c.partName === editingUser.partName || c.key === editingUser.partName
      );
      if (matched) {
        setCabezaSelectionMode('existing');
        setSelectedCabezaKey(matched.key);
      } else {
        setCabezaSelectionMode('new');
        setNewPartName(editingUser.partName);
        setNewCabezaColor(editingUser.color || '#7C3AED');
      }
    } else {
      // New user default
      setName('');
      setEmail('');
      setPhone('');
      setPassword(generateRandomPassword());
      setAnnualQuotaDays(30);
      setRole('owner');

      if (existingCabezasList.length > 0) {
        setCabezaSelectionMode('existing');
        setSelectedCabezaKey(existingCabezasList[0].key);
      } else {
        setCabezaSelectionMode('new');
        setNewPartName('Cabeza 1');
        setNewCabezaColor('#DC2626');
      }
    }
  }, [editingUser]);

  // Selected Cabeza Details
  const activeSelectedCabeza = existingCabezasList.find((c) => c.key === selectedCabezaKey);

  // Compute final Cabeza parameters based on current mode
  const effectivePartName =
    cabezaMode === 'existing'
      ? activeSelectedCabeza?.partName || selectedCabezaKey || 'Cabeza 1'
      : newPartName.trim() || 'Nueva Cabeza';

  const effectiveColor =
    cabezaMode === 'existing'
      ? activeSelectedCabeza?.color || '#DC2626'
      : newCabezaColor;

  const effectiveCabezaNumber =
    cabezaMode === 'existing'
      ? activeSelectedCabeza?.cabezaNumber
      : existingCabezasList.length + 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Por favor ingrese el nombre del copropietario.');
      return;
    }
    if (!email.trim()) {
      alert('Por favor ingrese el email de acceso.');
      return;
    }

    onSaveUser({
      id: editingUser?.id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      partName: effectivePartName,
      cabezaNumber: effectiveCabezaNumber,
      annualQuotaDays: Number(annualQuotaDays) || 30,
      color: effectiveColor,
      password: password.trim().toUpperCase() || generateRandomPassword(),
      role,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-[#FFFFFF] w-full max-w-xl border border-[#DED7C2] shadow-2xl overflow-hidden flex flex-col my-8 max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#17341B] text-[#FAF8F5] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#BFA270]" />
            <div>
              <h3
                className="text-base font-bold tracking-wide"
                style={{ fontFamily: "'Cinzel', 'Playfair Display', serif" }}
              >
                {editingUser ? 'Modificar Ficha de Copropietario' : 'Alta de Nuevo Copropietario'}
              </h3>
              <p className="text-[11px] text-[#C9D6CC]">
                {editingUser
                  ? `Editando registro de ${editingUser.name}`
                  : 'Asigne a una Cabeza existente o cree una nueva parte indivisa'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#C9D6CC] hover:text-white p-1 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Section 1: Datos Personales */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] pb-1.5 border-b border-[#EFEAE0] flex items-center gap-1.5">
              <span>1. Identificación del Copropietario</span>
            </h4>

            <div>
              <label className="block font-semibold uppercase text-[#35483A] mb-1">
                Nombre Completo *
              </label>
              <input
                type="text"
                placeholder="ej. Carlos Alberto Gómez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-semibold text-sm focus:outline-none focus:border-[#163323]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Email de Acceso *
                </label>
                <input
                  type="email"
                  placeholder="ej. carlos.gomez@eldesayuno.com.ar"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none focus:border-[#163323]"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Teléfono Móvil
                </label>
                <input
                  type="text"
                  placeholder="ej. +54 9 11 4589-3210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] focus:outline-none focus:border-[#163323]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Cabeza / Grupo Assignment */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-[#EFEAE0]">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[#BFA270]" />
                <span>2. Asignación de Cabeza / Grupo</span>
              </h4>
            </div>

            {/* Selector Mode Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F4EFE6] border border-[#DDD5BF]">
              <button
                type="button"
                onClick={() => setCabezaSelectionMode('existing')}
                className={`py-2 px-3 text-center font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  cabezaMode === 'existing'
                    ? 'bg-[#1B3B2B] text-white shadow-2xs'
                    : 'text-[#56685B] hover:text-[#163323]'
                }`}
              >
                ● Cabeza Existente
              </button>
              <button
                type="button"
                onClick={() => setCabezaSelectionMode('new')}
                className={`py-2 px-3 text-center font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                  cabezaMode === 'new'
                    ? 'bg-[#1B3B2B] text-white shadow-2xs'
                    : 'text-[#56685B] hover:text-[#163323]'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-[#BFA270]" />
                <span>+ Crear Nueva Cabeza</span>
              </button>
            </div>

            {/* Mode A: Select Existing Cabeza */}
            {cabezaMode === 'existing' && (
              <div className="space-y-3">
                <label className="block font-semibold text-[#35483A]">
                  Seleccione la Cabeza a la que pertenecera este socio:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {existingCabezasList.map((cabeza) => {
                    const isSelected = selectedCabezaKey === cabeza.key;
                    return (
                      <div
                        key={cabeza.key}
                        onClick={() => setSelectedCabezaKey(cabeza.key)}
                        className={`p-3 border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#F4F8F5] border-[#1B3B2B] ring-1 ring-[#1B3B2B] shadow-2xs'
                            : 'bg-[#FAF8F5] border-[#DCD4C0] hover:border-[#1B3B2B]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                              style={{ backgroundColor: cabeza.color }}
                            />
                            <span className="font-bold text-xs text-[#163323]">
                              {cabeza.partName}
                            </span>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                          )}
                        </div>

                        <div className="text-[10px] text-[#637568]">
                          <span>
                            {cabeza.members.length}{' '}
                            {cabeza.members.length === 1 ? 'socio' : 'socios'}:
                          </span>
                          <span className="block font-medium text-[#163323] truncate mt-0.5">
                            {cabeza.members.map((m) => m.name.split(' ')[0]).join(', ')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Status Callout for Existing Cabeza */}
                {activeSelectedCabeza && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
                    <span
                      className="w-4 h-4 rounded-full border border-black/20 shrink-0 shadow-xs"
                      style={{ backgroundColor: activeSelectedCabeza.color }}
                    />
                    <div>
                      <span className="font-bold block">
                        Adopta el color oficial de {activeSelectedCabeza.partName}
                      </span>
                      <span className="text-[10px] text-emerald-700">
                        El socio compartirá las reservas, cupos y color identificador en el calendario.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Mode B: Create New Cabeza */}
            {cabezaMode === 'new' && (
              <div className="p-4 bg-[#FAF8F5] border border-[#DDD5BF] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">
                      Nombre de la Nueva Cabeza *
                    </label>
                    <input
                      type="text"
                      placeholder="ej. Cabeza 5 / Familia Gómez"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      required
                      className="w-full p-2.5 bg-white border border-[#DCD4C0] font-bold text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold uppercase text-[#35483A] mb-1">
                      Color Asignado a la Cabeza
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={newCabezaColor}
                        onChange={(e) => setNewCabezaColor(e.target.value)}
                        className="w-10 h-9 border cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={newCabezaColor}
                        onChange={(e) => setNewCabezaColor(e.target.value)}
                        className="w-full p-2 bg-white border border-[#DCD4C0] font-mono font-bold text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Color Palette Presets */}
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#637568] mb-1.5">
                    Paleta de Colores Recomendada:
                  </label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_COLORS.map((p) => (
                      <button
                        key={p.hex}
                        type="button"
                        onClick={() => setNewCabezaColor(p.hex)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center ${
                          newCabezaColor.toLowerCase() === p.hex.toLowerCase()
                            ? 'scale-125 border-[#163323] shadow-xs'
                            : 'border-white hover:scale-110'
                        }`}
                        style={{ backgroundColor: p.hex }}
                        title={p.name}
                      >
                        {newCabezaColor.toLowerCase() === p.hex.toLowerCase() && (
                          <Check className="w-3 h-3 text-white drop-shadow-xs" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-700 shrink-0" />
                  <span>
                    Se registrará una nueva Cabeza en el Fideicomiso con este color de calendario.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Quota & Credentials */}
          <div className="space-y-3 pt-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#163323] pb-1.5 border-b border-[#EFEAE0] flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-[#BFA270]" />
              <span>3. Cupo de Estadía y Contraseña de Acceso</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Cupo Anual Asignado (Días)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={annualQuotaDays}
                  onChange={(e) => setAnnualQuotaDays(Number(e.target.value))}
                  required
                  className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase text-[#35483A] mb-1">
                  Contraseña de Acceso (6 Caracteres)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.toUpperCase())}
                    maxLength={6}
                    required
                    className="w-full p-2.5 bg-[#FAF8F5] border border-[#DCD4C0] font-mono font-bold text-xs uppercase tracking-widest text-[#163323]"
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(generateRandomPassword())}
                    className="px-2.5 py-2 bg-[#F4EFE6] border border-[#DDD5BF] hover:bg-[#EDE6D7] text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-[#163323]"
                    title="Generar nueva clave aleatoria"
                  >
                    Generar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-4 border-t border-[#EFEAE0] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-[#637568] hover:text-[#163323] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B3B2B] hover:bg-[#132A1F] text-white text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <Check className="w-4 h-4 text-[#BFA270]" />
              <span>{editingUser ? 'Guardar Cambios' : 'Registrar Copropietario'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
