import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const formatDay = (iso) => {
  if (!iso) return '';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
};

const AiCreditDock = ({
  balance,
  estimate,
  open,
  onToggle,
  pendingPack,
  onPick,
  onConfirm,
  buying,
  purchaseNote,
}) => {
  if (!balance) return null;
  const renewal = formatDay(balance.renewal);
  const empty = balance.available <= 0;

  return (
    <div className="ai-creditbar">
      <button
        type="button"
        className="ai-credit-pill"
        aria-expanded={open}
        onClick={onToggle}
      >
        <Sparkles size={12} />
        {balance.available} créditos
      </button>
      {estimate > 0 && <span className="ai-credit-estimate">Estimación: cerca de {estimate} créditos</span>}
      {open && (
        <div className="ai-credit-panel" role="dialog" aria-label="Saldo de créditos">
          <p>Personales: {balance.personal}</p>
          <p>Del plan: {balance.monthly} · Comprados: {balance.purchased}</p>
          <p>Compartidos de este proyecto: {balance.shared}</p>
          <p>Plan {balance.planLabel}: {balance.included} al mes</p>
          {renewal && <p>Renovación del plan: {renewal}. Los comprados se conservan.</p>}
          <p className="ai-credit-note">Preparar una recarga no cobra ni suma créditos. El cobro se activa cuando exista un proveedor de pagos.</p>
          <div className="ai-credit-packs">
            {balance.packs.map((pack) => (
              <button
                key={pack.credits}
                type="button"
                aria-pressed={pendingPack === pack.credits}
                className={pendingPack === pack.credits ? 'is-on' : ''}
                onClick={() => onPick(pack.credits)}
              >
                {pack.credits} créditos{pack.price > 0 ? ` · $${pack.price} MXN` : ''}
              </button>
            ))}
          </div>
          <button type="button" className="is-confirm" disabled={!pendingPack || buying} onClick={onConfirm}>
            Preparar recarga
          </button>
          {purchaseNote && <p className="ai-credit-note">{purchaseNote}</p>}
        </div>
      )}
      {empty && (
        <div className="ai-credit-notice">
          <strong>Te quedaste sin créditos de IA</strong>
          <p>
            Puedes esperar a tu próxima renovación{renewal ? ` (${renewal})` : ''} o adquirir créditos adicionales para continuar.
          </p>
          <div>
            <Link to="/settings/plan">Ver planes</Link>
            <button type="button" onClick={() => { if (!open) onToggle(); }}>Comprar créditos</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiCreditDock;
