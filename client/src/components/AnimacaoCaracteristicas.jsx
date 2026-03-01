import { useEffect, useState } from 'react';
import { getAmenityLabel, getAmenityIcon, CHARACTERISTIC_ICONS } from '../lib/amenitiesLabels';

/**
 * Layout tipo referência: logo, imobname, propertyCodes, grid de características (quartos, banheiros, vagas, área)
 * com ícones Material Symbols, depois seção "Lazer e comodidades" em caixas arredondadas. Área 1080×1450.
 */
const ART_WIDTH = 1080;
const ART_HEIGHT = 1450;
const DURATION_MS = 5000;
const PRIMARY_COLOR = '#1152d4';
const CHAR_ORDER = ['numberOfRooms', 'numberOfSuites', 'numberOfBathroomsTotal', 'numberOfParkingSpaces', 'floorSize'];

function getCharacteristics(amenities) {
  const byKey = {};
  (amenities || []).forEach((item) => {
    const name = item?.name;
    if (name && CHARACTERISTIC_ICONS[name]) byKey[name] = item;
  });
  const result = [];
  CHAR_ORDER.forEach((key) => {
    if (byKey[key]) result.push(byKey[key]);
  });
  return result;
}

function getLeisureAmenities(amenities) {
  const charKeys = new Set(Object.keys(CHARACTERISTIC_ICONS));
  return (amenities || []).filter((item) => item?.name && !charKeys.has(item.name));
}

export default function AnimacaoCaracteristicas({ listing, onEnd, backgroundColor = 'var(--surface)', itemsPerRow = 3, iconSize = 28 }) {
  const [started, setStarted] = useState(false);
  const amenities = listing?.amenitiesList || listing?.['amenities-list'] || [];
  const logoimob = listing?.logoimob;
  const imobname = listing?.imobname;
  const propertyCodes = listing?.propertyCodes;
  const fontScale = iconSize / 28;
  const characteristics = getCharacteristics(amenities);
  const leisure = getLeisureAmenities(amenities);

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
        boxSizing: 'border-box',
        background: backgroundColor,
        borderRadius: 8,
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
              fontSize: `${Math.round(24 * fontScale)}px`,
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
              fontSize: `${Math.round(16 * fontScale)}px`,
              color: 'var(--muted)',
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            {propertyCodes}
          </div>
        )}

        {/* Grid de características (quartos, banheiros, vagas, área) — ícone em cima, texto embaixo */}
        {characteristics.length > 0 && (
          <div
            style={{
              opacity: started ? 1 : 0,
              transition: 'opacity 0.35s ease 0.5s',
              padding: '16px 0',
              borderTop: '1px solid rgba(0,0,0,0.08)',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.min(4, characteristics.length)}, 1fr)`,
              gap: 8,
              marginBottom: 20,
            }}
          >
            {characteristics.map((item, i) => {
              const iconName = CHARACTERISTIC_ICONS[item.name];
              const label = getAmenityLabel(item.name);
              const value = item?.value ?? (typeof item === 'string' ? item : '');
              const text = value && typeof value === 'string' ? value : label;
              const iconPx = Math.round(32 * fontScale);
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 8,
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      color: PRIMARY_COLOR,
                      fontSize: iconPx,
                      marginBottom: 4,
                    }}
                    aria-hidden
                  >
                    {iconName}
                  </span>
                  <span style={{ fontSize: `${Math.round(14 * fontScale)}px`, fontWeight: 700, color: 'var(--text)' }}>
                    {text}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Lazer e comodidades — caixas arredondadas, ícone + label */}
        {leisure.length > 0 && (
          <>
            <h3
              style={{
                opacity: started ? 1 : 0,
                transition: 'opacity 0.35s ease 0.6s',
                fontSize: `${Math.round(18 * fontScale)}px`,
                fontWeight: 700,
                color: 'var(--text)',
                marginBottom: 16,
              }}
            >
              Lazer e comodidades
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
                gap: 12,
                flex: 1,
                alignContent: 'start',
              }}
            >
              {leisure.map((item, i) => {
                const label = getAmenityLabel(item?.name);
                const value = item?.value ?? item;
                const delay = 0.65 + i * 0.06;
                const iconName = getAmenityIcon(item?.name);
                const iconPx = Math.round(24 * fontScale);
                const fontSize = Math.round(14 * fontScale);
                return (
                  <div
                    key={i}
                    style={{
                      opacity: started ? 1 : 0,
                      transform: started ? 'translateY(0)' : 'translateY(8px)',
                      transition: `opacity 0.3s ease ${delay}s, transform 0.3s ease ${delay}s`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 16,
                      borderRadius: 12,
                      background: 'rgba(0,0,0,0.06)',
                      fontSize: `${fontSize}px`,
                      color: 'var(--text)',
                      fontWeight: 500,
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: PRIMARY_COLOR, fontSize: iconPx, flexShrink: 0 }}
                      aria-hidden
                    >
                      {iconName}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {label}
                      {value && typeof value === 'string' && label !== value && (
                        <span style={{ color: 'var(--muted)', marginLeft: 4 }}>{value}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Se não tiver características nem lazer, fallback: lista única de amenities */}
        {characteristics.length === 0 && leisure.length === 0 && amenities.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${itemsPerRow}, 1fr)`,
              gap: '12px 16px',
              flex: 1,
              alignContent: 'start',
            }}
          >
            {amenities.map((item, i) => {
              const label = getAmenityLabel(item?.name);
              const value = item?.value ?? item;
              const delay = 0.6 + i * 0.08;
              const fontSize = Math.round(14 * fontScale);
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
                    fontSize: `${fontSize}px`,
                    color: 'var(--text)',
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      width: iconSize,
                      height: iconSize,
                      flexShrink: 0,
                      color: PRIMARY_COLOR,
                      fontSize: iconSize,
                    }}
                    aria-hidden
                  >
                    {getAmenityIcon(item?.name)}
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
        )}

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
            fontSize: `${Math.round(16 * fontScale)}px`,
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
