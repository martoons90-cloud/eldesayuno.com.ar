import React from 'react';
import { User, isUserAdmin, isUserIntendente, isUserFiduciante, isUserCabezaDeEquipo } from '../types';
import { ShieldCheck, Landmark, Award, Star, Shield, Wrench } from 'lucide-react';

interface UserRoleBadgeProps {
  user: User;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showAll?: boolean;
  className?: string;
}

export const UserRoleBadge: React.FC<UserRoleBadgeProps> = ({
  user,
  size = 'sm',
  showAll = true,
  className = '',
}) => {
  const isAdmin = isUserAdmin(user);
  const isIntendente = isUserIntendente(user);
  const isFid = isUserFiduciante(user);
  const isLeader = isUserCabezaDeEquipo(user);

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  const textSizes = {
    xs: 'text-[9px] px-1 py-0.2',
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[11px] px-2 py-0.5',
    lg: 'text-xs px-2.5 py-1',
  };

  const badges = [];

  // 1. Administrador (Ícono Especial: Escudo de Oro / Corona)
  if (isAdmin) {
    badges.push(
      <span
        key="admin"
        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-2xs bg-[#163323] text-[#FAF8F5] border border-[#BFA270] shadow-2xs ${textSizes[size]}`}
        title="Administrador General: Acceso y control total de la gestión fiduciaria"
      >
        <ShieldCheck className={`${iconSizes[size]} text-[#E5C378] shrink-0`} />
        <span>Admin</span>
      </span>
    );
  }

  // 1.5. Intendente (Operación 100%)
  if (isIntendente) {
    badges.push(
      <span
        key="intendente"
        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-2xs bg-[#0F766E] text-[#ECFDF5] border border-[#5EEAD4] shadow-2xs ${textSizes[size]}`}
        title="Intendente General: Operación 100% y gestión de estancias"
      >
        <Wrench className={`${iconSizes[size]} text-[#99F6E4] shrink-0`} />
        <span>Intendente</span>
      </span>
    );
  }

  // 2. Fiduciante (Ícono Especial: Templo / Balanza Fiduciaria)
  if (isFid) {
    badges.push(
      <span
        key="fiduciante"
        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-2xs bg-[#2E285F] text-[#EEF2FF] border border-[#818CF8] shadow-2xs ${textSizes[size]}`}
        title="Fiduciante del Fideicomiso: Órgano Fiduciario con acceso a balances, gastos y actas notariales"
      >
        <Landmark className={`${iconSizes[size]} text-[#C7D2FE] shrink-0`} />
        <span>Fiduciante</span>
      </span>
    );
  }

  // 3. Cabeza de Equipo (Ícono Especial: Estrella / Medalla de Oro)
  if (isLeader) {
    badges.push(
      <span
        key="leader"
        className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-2xs bg-[#FEF3C7] text-[#92400E] border border-[#F59E0B] shadow-2xs ${textSizes[size]}`}
        title={`Cabeza de Equipo: Líder designado de ${user.partName}. Acceso habilitado a Actas y Gastos.`}
      >
        <Award className={`${iconSizes[size]} text-[#D97706] shrink-0`} />
        <span>★ Cabeza de Equipo</span>
      </span>
    );
  }

  // If no privileged roles, standard socio
  if (badges.length === 0) {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium text-[#637568] ${textSizes[size]} ${className}`}
      >
        <span>Socio</span>
      </span>
    );
  }

  if (!showAll && badges.length > 1) {
    // Show highest priority (Admin > Fiduciante > Cabeza de Equipo)
    return <span className={`inline-flex items-center gap-1 ${className}`}>{badges[0]}</span>;
  }

  return <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>{badges}</span>;
};

// Avatar Badge Adornment (Small pin overlay for avatars)
export const AvatarRolePin: React.FC<{ user: User; size?: 'sm' | 'md' }> = ({ user, size = 'sm' }) => {
  const isAdmin = isUserAdmin(user);
  const isIntendente = isUserIntendente(user);
  const isFid = isUserFiduciante(user);
  const isLeader = isUserCabezaDeEquipo(user);

  if (!isAdmin && !isIntendente && !isFid && !isLeader) return null;

  const pinSize = size === 'sm' ? 'w-3.5 h-3.5 -bottom-0.5 -right-0.5 text-[8px]' : 'w-4 h-4 -bottom-1 -right-1 text-[9px]';

  if (isAdmin) {
    return (
      <span
        className={`absolute ${pinSize} rounded-full bg-[#163323] border border-[#E5C378] text-[#E5C378] flex items-center justify-center shadow-xs`}
        title="Administrador General"
      >
        <ShieldCheck className="w-2.5 h-2.5" />
      </span>
    );
  }

  if (isIntendente) {
    return (
      <span
        className={`absolute ${pinSize} rounded-full bg-[#0F766E] border border-[#5EEAD4] text-[#ECFDF5] flex items-center justify-center shadow-xs`}
        title="Intendente General"
      >
        <Wrench className="w-2.5 h-2.5" />
      </span>
    );
  }

  if (isFid) {
    return (
      <span
        className={`absolute ${pinSize} rounded-full bg-[#2E285F] border border-[#C7D2FE] text-[#C7D2FE] flex items-center justify-center shadow-xs`}
        title="Fiduciante del Fideicomiso"
      >
        <Landmark className="w-2.5 h-2.5" />
      </span>
    );
  }

  return (
    <span
      className={`absolute ${pinSize} rounded-full bg-[#F59E0B] border border-white text-white flex items-center justify-center shadow-xs`}
      title="Cabeza de Equipo"
    >
      <Star className="w-2.5 h-2.5 fill-current" />
    </span>
  );
};
