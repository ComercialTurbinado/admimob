import { useEffect, useState } from 'react';
import { getAmenityLabel } from '../lib/amenitiesLabels';

/**
 * Animação de até 5s: logo, imobname, propertyCodes, amenitiesList em 3 colunas, rodapé.
 * Proporção 9:16 (1080x1920), área de arte 1000x1450.
 */
const ART_WIDTH = 1000;
const ART_HEIGHT = 1450;
const DURATION_MS = 5000;

export default function AnimacaoCaracteristicas({ listing, onEnd }) {
  const [started, setStarted] = useState(false);
  const amenities = listing?.amenitiesList || listing?.['amenities-list'] || [];
  const logoimob = listing?.logoimob;
  const imobname = listing?.imobname;
  const propertyCodes = listing?.propertyCodes;

  useEffect(() => {
    const t = setTimeout(() => {
      setStarted(true);
    }, 100);
    const tEnd = setTimeout(() => {
      onEnd?.();
    }, DURATION_MS + 200);
    return () => {
      clearTimeout(t);
      clearTimeout(tEnd);
    };
  }, [onEnd]);

  return (
    <div
      className="animacao-caracteristicas"
      style={{
        position: 'relative',
        width: ART_WIDTH,
        height: ART_HEIGHT,
        maxWidth: '100%',
        aspectRatio: `${ART_WIDTH} / ${ART_HEIGHT}`,
        background: 'var(--surface)',
        borderRadius: 12,
        overflow: 'hidden',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: 'clamp(24px, 3%, 40px)',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo */}
        {logoimob && (
          <div
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.4s ease, transform 0.4s ease',
              flexShrink: 0,
              marginBottom: 16,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <img
              src={logoimob}
              alt=""
              style={{ maxHeight: 120, maxWidth: 200, objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Nome da imobiliária */}
        {imobname && (
          <div
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(-10px)',
              transition: 'opacity 0.4s ease 0.2s, transform 0.4s ease 0.2s',
              fontSize: 'clamp(1.1rem, 2.2vw, 1.5rem)',
              fontWeight: 700,
              textAlign: 'center',
              color: 'var(--text)',
              marginBottom: 12,
            }}
          >
            {imobname}
          </div>
        )}

        {/* Códigos do imóvel */}
        {propertyCodes && (
          <div
            style={{
              opacity: started ? 1 : 0,
              transition: 'opacity 0.35s ease 0.4s',
              fontSize: 'clamp(0.75rem, 1.5vw, 0.9rem)',
              color: 'var(--muted)',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            {propertyCodes}
          </div>
        )}

        {/* 3 colunas: amenities com label traduzido + espaço para ícone */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px 16px',
            flex: 1,
            alignContent: 'start',
          }}
        >
          {amenities.map((item, i) => {
            const label = getAmenityLabel(item?.name);
            const value = item?.value ?? item;
            const delay = 0.6 + i * 0.08;
            return (
              <div
                key={i}
                style={{
                  opacity: started ? 1 : 0,
                  transform: started ? 'translateY(0)' : 'translateY(8px)',
                  transition: `opacity 0.3s ease ${delay}s, transform 0.3s ease ${delay}s`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 'clamp(0.7rem, 1.4vw, 0.85rem)',
                  color: 'var(--text)',
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    flexShrink: 0,
                    background: 'var(--border)',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Ícone"
                >
                  {/* espaço para ícone */}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{label}</strong>
                  {value && typeof value === 'string' && (
                    <span style={{ color: 'var(--muted)', marginLeft: 4 }}>{value}</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {/* Rodapé: site e telefone */}
        <div
          style={{
            opacity: started ? 1 : 0,
            transition: 'opacity 0.4s ease 1.2s',
            marginTop: 'auto',
            paddingTop: 20,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap',
            fontSize: 'clamp(0.75rem, 1.5vw, 0.9rem)',
            color: 'var(--muted)',
          }}
        >
          <span>Site: _______________</span>
          <span>Tel: _______________</span>
        </div>
      </div>
    </div>
  );
}
