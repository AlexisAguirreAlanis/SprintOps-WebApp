import React from 'react';

const Avatar = ({ name, avatarUrl, size = 'md', className = '' }) => {
  const initials = name
    ? name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : '??';

  const sizes = {
    xs: 'w-7 h-7 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
  };

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name || ''} className={`${sizes[size]} rounded-full object-cover ${className}`} />
    );
  }

  return (
    <div className={`${sizes[size]} ps-avatar-fallback flex items-center justify-center rounded-full font-bold ${className}`}>
      {initials}
    </div>
  );
};

export default Avatar;
