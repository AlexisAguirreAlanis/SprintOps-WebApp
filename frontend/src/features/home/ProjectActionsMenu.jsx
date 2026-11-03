import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImagePlus, MoreVertical, RotateCcw } from 'lucide-react';
import { projectsRepository } from '../../data/repositories/projectsRepository';

function menuPosition(anchor) {
  const width = 224;
  const rect = anchor.getBoundingClientRect();
  const stage = document.querySelector('.app-stage');
  const stageRect = stage?.getBoundingClientRect();
  const scale = stage && stageRect && stage.offsetWidth
    ? stageRect.width / stage.offsetWidth
    : 1;
  const originX = stageRect ? stageRect.left : 0;
  const originY = stageRect ? stageRect.top : 0;
  const rawLeft = (rect.right - originX) / scale - width;
  const rawTop = (rect.bottom - originY) / scale + 6;
  const maxLeft = ((stageRect?.width || window.innerWidth) / scale) - width - 8;
  return {
    top: Math.max(8, rawTop),
    left: Math.max(8, Math.min(rawLeft, maxLeft)),
  };
}

const ProjectActionsMenu = ({ project, userId, onCoverUpdated }) => {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const fileRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [root, setRoot] = useState(null);

  useEffect(() => {
    setRoot(document.getElementById('popup-root'));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      const target = event.target;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (open) {
      setOpen(false);
      return;
    }
    if (buttonRef.current) setPos(menuPosition(buttonRef.current));
    setOpen(true);
  };

  const upload = async (event) => {
    event.stopPropagation();
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const name = (file.name || '').toLowerCase();
    const ok = (file.type && file.type.startsWith('image/')) || /\.(jpe?g|png|webp|gif|heic|heif)$/.test(name);
    if (!ok) {
      window.alert('Selecciona una imagen (JPEG, PNG, WebP, GIF o HEIC).');
      return;
    }
    if (!userId) {
      window.alert('Inicia sesión para cambiar la imagen del proyecto.');
      return;
    }
    setBusy(true);
    try {
      await projectsRepository.uploadProjectCardCover(project.id, userId, file);
      onCoverUpdated?.();
      setOpen(false);
    } catch (err) {
      window.alert(err?.message || 'No se pudo subir la imagen');
    } finally {
      setBusy(false);
    }
  };

  const restore = async (event) => {
    event.stopPropagation();
    if (!userId) {
      window.alert('Inicia sesión para restaurar la imagen.');
      return;
    }
    setBusy(true);
    try {
      await projectsRepository.deleteProjectCardCover(project.id, userId);
      onCoverUpdated?.();
      setOpen(false);
    } catch (err) {
      window.alert(err?.message || 'No se pudo restaurar la imagen por defecto');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="ps-icon-btn"
        aria-label={`Acciones de ${project.name}`}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        onClick={toggle}
      >
        <MoreVertical size={16} strokeWidth={2.4} />
      </button>
      {open && pos && root && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="ps-menu"
          style={{ top: pos.top, left: pos.left }}
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" role="menuitem" className="ps-menu-item" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus size={16} />
            Subir imagen
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif" className="hidden" onChange={upload} />
          <button type="button" role="menuitem" className="ps-menu-item" disabled={busy} onClick={restore}>
            <RotateCcw size={16} />
            Imagen predeterminada
          </button>
        </div>,
        root,
      )}
    </>
  );
};

export default ProjectActionsMenu;
