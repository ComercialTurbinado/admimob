import { useEffect, useState, useRef, useMemo } from 'react';
import { API } from '../api';
import { getAmenityLabel, getAmenityIcon, CHARACTERISTIC_ICONS } from '../lib/amenitiesLabels';
import { getDominantColorFromImageUrl, getPaletteFromPrimary } from '../lib/dominantColor';

/**
 * Tamanho do box do logo a partir do intrinsic size da imagem (aspect ratio preservado).
 * Quadrado ou próximo (ratio 0.85–1.15): altura 20% da arte, largura proporcional.
 * Outros (ex.: 3:1): altura 25% da arte, largura proporcional; máx. 50% da largura da arte.
 */
function getLogoBoxSize(naturalW, naturalH, artHeight = ART_HEIGHT, artWidth = ART_WIDTH) {
  if (!naturalW || !naturalH || naturalW <= 0 || naturalH <= 0) return { width: 186, height: 186 };
  const ratio = naturalW / naturalH;
  const vh20 = 0.2 * artHeight;
  const vh25 = 0.25 * artHeight;
  const isSquare = ratio >= 0.85 && ratio <= 1.15;
  let height = isSquare ? vh20 : vh25;
  let width = height * ratio;
  const maxW = 0.5 * artWidth;
  if (width > maxW) {
    width = maxW;
    height = width / ratio;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

/** Usa proxy para imagens externas: evita 403 (hotlink do Viva Real/etc.) e CORS/taint no Browserless. */
function proxyIfNeeded(url, useProxy) {
  if (!useProxy || !url || typeof url !== 'string') return url;
  const u = url.trim();
  if (u.startsWith('http://') || u.startsWith('https://')) return `${API}/proxy-image?url=${encodeURIComponent(u)}`;
  return url;
}

/**
 * Poster 1080×1920: hero (foto + brand glass), info (badge, ref, preço, localização),
 * stats (quartos, banheiros, vagas, área), amenities (lazer), footer.
 */
const ART_WIDTH = 1080;
const ART_HEIGHT = 1920;
/** 240 frames a 24 fps = 10 s. */
const CAPTURE_FRAMES = 240;
const DURATION_MS = Math.round((CAPTURE_FRAMES / 24) * 1000);
export { DURATION_MS };

/** Tempo (em segundos) em que a animação da imagem de capa termina; os demais elementos só entram depois. */
const HERO_ANIM_END_S = 0.8;
/** Após os detalhes do imóvel, esperar 3s e então mostrar só logo + contatos. */
const DETAILS_END_S = 5;
const WAIT_CONTACT_S = 3;
const CONTACT_START_S = DETAILS_END_S + WAIT_CONTACT_S;
const CONTACT_TRANSITION_S = 0.8;
const TOTAL_DURATION_MS = (CONTACT_START_S + CONTACT_TRANSITION_S) * 1000;

/** Progress 0..1 no tempo t (ms), com delay e duration em segundos. */
function progressAt(tMs, delayS, durationS) {
  const t = tMs / 1000;
  const p = (t - delayS) / durationS;
  return Math.min(1, Math.max(0, p));
}
const CHAR_ORDER = ['numberOfRooms', 'numberOfSuites', 'numberOfBathroomsTotal', 'numberOfParkingSpaces', 'floorSize'];
const HERO_PLACEHOLDER = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDDjW4HkXfRR2G54Zb24wBS9_NMPeZXQNtmjDaNwC_wCnTRA_3RopIOvyzjiCEmgWT6iq4bGqtLt_Oy6ndH8q2ajU3EN5jLhnvayXXfy9ha4FuFYxJCdh42kv7pWaSTMHbKYCS3RhttWmqkPBsn2rZkt7-rv9asad0tsixJDCTTAhJY9NbXv5AiYjQ9knr6XS-C0M4vqnGM90sTYxz9vxErTvuWCgBDmxT54voEaI_wPskr6HSv6qJzwYXipfe6ziFmIu_Q_guXZMk';

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

function getPrice(listing) {
  const p = listing?.prices;
  if (!p || typeof p !== 'object') return 'R$ —';
  const v = p.Venda ?? p.venda ?? Object.values(p)[0];
  return v && typeof v === 'string' ? v : 'R$ —';
}

function getLocation(listing) {
  const parts = [listing?.address, listing?.city, listing?.state].filter(Boolean);
  return parts.length ? parts.join(', ') : '—';
}

export default function AnimacaoCaracteristicas({ listing, onEnd, backgroundColor, itemsPerRow, iconSize, videoMode, captureStep, layout = 'classic', previewPhase = null }) {
  const [started, setStarted] = useState(false);
  const [showContactPhase, setShowContactPhase] = useState(false);
  const showInfoPart = previewPhase === 'contact' ? false : (previewPhase === 'info' ? true : !showContactPhase);
  const showContactPart = previewPhase === 'contact' ? true : (previewPhase === 'info' ? false : showContactPhase);
  const [scale, setScale] = useState(1);
  const [heroProxyFailed, setHeroProxyFailed] = useState(false);
  const [logoProxyFailed, setLogoProxyFailed] = useState(false);
  const [posterPalette, setPosterPalette] = useState(null);
  const [logoNaturalSize, setLogoNaturalSize] = useState(null);
  const wrapRef = useRef(null);
  const logoBoxSize = useMemo(
    () => getLogoBoxSize(logoNaturalSize?.w, logoNaturalSize?.h),
    [logoNaturalSize?.w, logoNaturalSize?.h]
  );
  const client = listing?.client || {};
  const amenities = listing?.amenitiesList || listing?.['amenities-list'] || [];
  const logoimob = listing?.logoimob;
  const imobname = listing?.imobname;
  const propertyCodes = listing?.propertyCodes;
  const characteristics = getCharacteristics(amenities);
  const leisure = getLeisureAmenities(amenities);
  const heroImgRaw =
    (listing?.carousel_images && listing.carousel_images[0]) ||
    (listing?.selected_images && listing.selected_images[0]) ||
    listing?.images?.[0] ||
    HERO_PLACEHOLDER;
  const heroImg = heroProxyFailed ? heroImgRaw : proxyIfNeeded(heroImgRaw, true);
  const logoImg = logoProxyFailed ? (logoimob || '') : proxyIfNeeded(logoimob, true);
  const price = getPrice(listing);
  const location = getLocation(listing);
  const hasLocation = location && location !== '—';
  const refText = propertyCodes ? `REF: ${propertyCodes}` : 'REF: —';
  const site = listing?.website || 'www.exemplo.com';
  const copyright = `© ${new Date().getFullYear()} ${(imobname || 'IMOBILIÁRIA').toUpperCase()} - TODOS OS DIREITOS RESERVADOS`;

  const stepMode = typeof captureStep === 'number' && captureStep >= 0;
  const tMs = stepMode ? (captureStep / (CAPTURE_FRAMES - 1)) * DURATION_MS : 0;

  useEffect(() => {
    if (previewPhase === 'info' || previewPhase === 'contact') setStarted(true);
  }, [previewPhase]);

  useEffect(() => {
    if (stepMode || (previewPhase != null && previewPhase !== undefined)) return;
    const t = setTimeout(() => setStarted(true), 100);
    const tContact = setTimeout(() => setShowContactPhase(true), CONTACT_START_S * 1000);
    const tEnd = setTimeout(() => onEnd?.(), TOTAL_DURATION_MS + 200);
    return () => {
      clearTimeout(t);
      clearTimeout(tContact);
      clearTimeout(tEnd);
    };
  }, [onEnd, stepMode, previewPhase]);

  useEffect(() => {
    const raw = listing?.logoimob;
    if (!raw || typeof raw !== 'string') {
      setPosterPalette(null);
      setLogoNaturalSize(null);
      return;
    }
    const logoUrl = proxyIfNeeded(raw, true);
    if (!logoUrl.startsWith('http') && !logoUrl.startsWith('/')) {
      setPosterPalette(null);
      return;
    }
    let cancelled = false;
    getDominantColorFromImageUrl(logoUrl).then((result) => {
      if (cancelled || !result || !result.dominant) return;
      setPosterPalette(getPaletteFromPrimary(result.dominant, result.darkest ?? null, result.lightest ?? null));
    });
    return () => { cancelled = true; };
  }, [listing?.logoimob]);

  useEffect(() => {
    if (videoMode) {
      setScale(1);
      return;
    }
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const scaleW = w > 0 ? w / ART_WIDTH : 1;
      const scaleH = h > 0 ? h / ART_HEIGHT : 1;
      setScale(Math.min(scaleW, scaleH, 1));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [videoMode]);

  return (
    <div
      ref={wrapRef}
      className="poster-preview"
      style={{
        ...(posterPalette || {}),
        ...(client?.design_config || {}),
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: ART_WIDTH,
        maxHeight: ART_HEIGHT,
        boxSizing: 'border-box',
        overflow: 'hidden',
        margin: '0 auto',
        opacity: stepMode ? 1 : started ? 1 : 0,
        transition: stepMode ? 'none' : 'opacity 0.4s ease',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <main
        className="poster"
        data-layout={layout}
        style={{
          width: ART_WIDTH,
          height: ART_HEIGHT,
          flexShrink: 0,
          transformOrigin: 'top center',
          transform: `scale(${scale})`,
          position: 'relative',
        }}
      >
        <div
          style={{
            opacity: showInfoPart ? 1 : 0,
            transition: 'opacity 0.5s ease',
            pointerEvents: showInfoPart ? 'auto' : 'none',
          }}
        >
        {/* HERO */}
        <section className="hero">
          <img
            src={heroImg}
            alt=""
            crossOrigin="anonymous"
            onError={() => videoMode && setHeroProxyFailed(true)}
            style={stepMode
              ? {
                  opacity: progressAt(tMs, 0, 0.8),
                  transition: 'none',
                }
              : {
                  opacity: started ? 1 : 0,
                  transition: 'opacity 0.8s ease',
                }}
          />
          <div
            className="brand-glass"
            style={stepMode
              ? {
                  opacity: progressAt(tMs, HERO_ANIM_END_S, 0.5),
                  transition: 'none',
                }
              : {
                  opacity: started ? 1 : 0,
                  transition: `opacity 0.5s ease ${HERO_ANIM_END_S}s`,
                }}
          >
            <div className="brand-card">
              <div
                className="brand-icon"
                style={logoimob ? { width: logoBoxSize.width, height: logoBoxSize.height } : undefined}
              >
                {logoimob ? (
                  <img
                    src={logoImg}
                    alt=""
                    crossOrigin="anonymous"
                    onError={() => videoMode && setLogoProxyFailed(true)}
                    onLoad={(e) => {
                      const img = e.target;
                      if (img?.naturalWidth && img?.naturalHeight)
                        setLogoNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <span className="material-symbols-outlined">apartment</span>
                )}
              </div>
            </div>
          </div>
        </section>
        {layout === 'cards' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 600, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', padding: '0 0 32px 32px' }}>
            <span style={{ background: 'var(--bg-poster)', color: '#fff', padding: '8px 24px', borderRadius: 8, fontWeight: 700, fontSize: 20, letterSpacing: '0.08em', opacity: stepMode ? progressAt(tMs, HERO_ANIM_END_S, 0.2) : started ? 1 : 0, transition: stepMode ? 'none' : `opacity 0.5s ease ${HERO_ANIM_END_S + 0.2}s` }}>{refText}</span>
          </div>
        )}
        {/* INFO */}
        <section className="info">
          <div
            className="meta"
            style={stepMode
              ? {
                  opacity: progressAt(tMs, HERO_ANIM_END_S + 0.2, 0.45),
                  transform: `translateY(${14 - 14 * progressAt(tMs, HERO_ANIM_END_S + 0.2, 0.45)}px)`,
                  transition: 'none',
                }
              : {
                  opacity: started ? 1 : 0,
                  transform: started ? 'translateY(0)' : 'translateY(14px)',
                  transition: `opacity 0.45s ease ${HERO_ANIM_END_S + 0.2}s, transform 0.45s ease ${HERO_ANIM_END_S + 0.2}s`,
                }}
          >
            <span className="badge-poster">À VENDA</span>
            <span className="ref">{refText}</span>
          </div>
          <h1
            className="price"
            style={stepMode
              ? {
                  opacity: progressAt(tMs, HERO_ANIM_END_S + 0.7, 0.45),
                  transform: `translateY(${12 - 12 * progressAt(tMs, HERO_ANIM_END_S + 0.7, 0.45)}px)`,
                  transition: 'none',
                }
              : {
                  opacity: started ? 1 : 0,
                  transform: started ? 'translateY(0)' : 'translateY(12px)',
                  transition: `opacity 0.45s ease ${HERO_ANIM_END_S + 0.7}s, transform 0.45s ease ${HERO_ANIM_END_S + 0.7}s`,
                }}
          >
            {price}
          </h1>
          {hasLocation && (
          <div
            className="location"
            style={stepMode
              ? {
                  opacity: progressAt(tMs, HERO_ANIM_END_S + 1.2, 0.45),
                  transform: `translateY(${10 - 10 * progressAt(tMs, HERO_ANIM_END_S + 1.2, 0.45)}px)`,
                  transition: 'none',
                }
              : {
                  opacity: started ? 1 : 0,
                  transform: started ? 'translateY(0)' : 'translateY(10px)',
                  transition: `opacity 0.45s ease ${HERO_ANIM_END_S + 1.2}s, transform 0.45s ease ${HERO_ANIM_END_S + 1.2}s`,
                }}
          >
            <span className="material-symbols-outlined">location_on</span>
            <span>{location}</span>
          </div>
          )}
        </section>

        {/* STATS */}
        {characteristics.length > 0 && (() => {
          const n = characteristics.length;
          const cols = n <= 5 ? n : n === 6 ? 3 : n <= 8 ? 4 : 5;
          const lastFullWidth = n > cols && n % cols === 1;
          return (
          <section
            className="stats"
            data-last-full-width={lastFullWidth ? 'true' : undefined}
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              ...(stepMode
                ? {
                    background: progressAt(tMs, HERO_ANIM_END_S + 1.7, 0.4) >= 1 ? '#fafafa' : '#fff',
                    borderTop: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: progressAt(tMs, HERO_ANIM_END_S + 1.7, 0.4) >= 1 ? 'var(--line-poster)' : 'transparent',
                    transition: 'none',
                  }
                : {
                    background: started ? '#fafafa' : '#fff',
                    borderTop: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: started ? 'var(--line-poster)' : 'transparent',
                    transition: `background 0.4s ease ${HERO_ANIM_END_S + 1.7}s, border-color 0.4s ease ${HERO_ANIM_END_S + 1.7}s`,
                  }),
            }}
          >
            {characteristics.map((item, i) => {
              const iconName = CHARACTERISTIC_ICONS[item.name];
              const value = item?.value ?? (typeof item === 'string' ? item : '');
              const text = value && typeof value === 'string' ? value : getAmenityLabel(item.name);
              const statLabel = getAmenityLabel(item.name);
              const delay = HERO_ANIM_END_S + 1.7 + i * 0.15;
              return (
                <div
                  key={i}
                  className="stat"
                  style={stepMode
                    ? {
                        opacity: progressAt(tMs, delay, 0.45),
                        transform: `translateY(${16 - 16 * progressAt(tMs, delay, 0.45)}px)`,
                        transition: 'none',
                      }
                    : {
                        opacity: started ? 1 : 0,
                        transform: started ? 'translateY(0)' : 'translateY(16px)',
                        transition: `opacity 0.45s ease ${delay}s, transform 0.45s ease ${delay}s`,
                      }}
                >
                  <span className="material-symbols-outlined">{iconName}</span>
                  <div className="stat-content">
                    <span className="stat-name">{statLabel}</span>
                    <div className="label">{text}</div>
                  </div>
                </div>
              );
            })}
          </section>
          );
        })()}

        {/* AMENITIES */}
        {leisure.length > 0 && (() => {
          const n = leisure.length;
          const cols = n <= 6 ? 3 : 4;
          const rem = n % cols;
          const hasLastFull = rem === 1 && n > cols;
          const hasLastTwo = rem === 2 && n > cols;

          const renderAmen = (item, i, delayOffset = 0) => {
            const label = getAmenityLabel(item?.name);
            const value = item?.value ?? item;
            const text = value && typeof value === 'string' && label !== value ? value : label;
            const iconName = getAmenityIcon(item?.name);
            const delay = HERO_ANIM_END_S + 2.7 + (i + delayOffset) * 0.12;
            return (
              <div
                key={i}
                className="amen"
                style={stepMode
                  ? {
                      opacity: progressAt(tMs, delay, 0.4),
                      transform: `translateY(${14 - 14 * progressAt(tMs, delay, 0.4)}px)`,
                      transition: 'none',
                    }
                  : {
                      opacity: started ? 1 : 0,
                      transform: started ? 'translateY(0)' : 'translateY(14px)',
                      transition: `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s`,
                    }}
              >
                <span className="material-symbols-outlined">{iconName}</span>
                <span className="text">{text}</span>
              </div>
            );
          };

          return (
          <section className="amenities">
            <h3
              style={stepMode
                ? {
                    opacity: progressAt(tMs, HERO_ANIM_END_S + 2.4, 0.45),
                    transform: `translateY(${12 - 12 * progressAt(tMs, HERO_ANIM_END_S + 2.4, 0.45)}px)`,
                    transition: 'none',
                  }
                : {
                    opacity: started ? 1 : 0,
                    transform: started ? 'translateY(0)' : 'translateY(12px)',
                    transition: `opacity 0.45s ease ${HERO_ANIM_END_S + 2.4}s, transform 0.45s ease ${HERO_ANIM_END_S + 2.4}s`,
                  }}
            >
              Lazer e comodidades
            </h3>
            {hasLastFull ? (
              <div className="amen-grid amen-grid--split">
                <div className="amen-grid__main" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '20px 24px' }}>
                  {leisure.slice(0, n - 1).map((item, i) => renderAmen(item, i))}
                </div>
                <div className="amen-grid__last-full">
                  {renderAmen(leisure[n - 1], n - 1, n - 1)}
                </div>
              </div>
            ) : hasLastTwo ? (
              <div className="amen-grid amen-grid--split">
                <div className="amen-grid__main" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '20px 24px' }}>
                  {leisure.slice(0, n - 2).map((item, i) => renderAmen(item, i))}
                </div>
                <div className="amen-grid__last-row">
                  {renderAmen(leisure[n - 2], n - 2, n - 2)}
                  {renderAmen(leisure[n - 1], n - 1, n - 1)}
                </div>
              </div>
            ) : (
              <div
                className="amen-grid"
                style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: '20px 24px' }}
              >
                {leisure.map((item, i) => renderAmen(item, i))}
              </div>
            )}
          </section>
          );
        })()}

        <div className="spacer" />

        {/* FOOTER */}
        <footer
          className="footer-poster"
          style={stepMode
            ? {
                opacity: progressAt(tMs, HERO_ANIM_END_S + 3.2, 0.5),
                transform: `translateY(${10 - 10 * progressAt(tMs, HERO_ANIM_END_S + 3.2, 0.5)}px)`,
                transition: 'none',
              }
            : {
                opacity: started ? 1 : 0,
                transform: started ? 'translateY(0)' : 'translateY(10px)',
                transition: `opacity 0.5s ease ${HERO_ANIM_END_S + 3.2}s, transform 0.5s ease ${HERO_ANIM_END_S + 3.2}s`,
              }}
        >
          <div className="site">{site}</div>
          <div className="social">
            <a href="#instagram" aria-label="Instagram">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9A5.5 5.5 0 0 1 16.5 22h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.6-2.2a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
              </svg>
            </a>
            <a href="#facebook" aria-label="Facebook">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V5a22 22 0 0 0-2.5-.1C11.7 4.9 10 6.5 10 9.5V11H7.5v3H10v8h3.5Z" />
              </svg>
            </a>
          </div>
          <div className="copyright">{copyright}</div>
        </footer>
        </div>

        {/* Fase contato: após 3s só logo + whatsapp, email, site, instagram */}
        {(!stepMode || previewPhase === 'contact') && (() => {
          const phoneVal = client.phone || client.phone_secondary || '(13) 99999-9999';
          const emailVal = client.email || 'contato@exemplo.com';
          const siteVal = client.website || site || 'www.exemplo.com';
          const instagramVal = client.instagram || '@suaimobiliaria';
          const hasPhone = client.phone || client.phone_secondary;
          const hasEmail = client.email;
          const hasSite = client.website || site;
          const hasInstagram = client.instagram;
          const contactTextColor = 'var(--contact-text)';
          const contactNegativo = { color: contactTextColor, fontWeight: 700, fontSize: 40, textDecoration: 'none' };
          const iconStyle = { fontSize: 47, color: contactTextColor, flexShrink: 0 };
          const InstagramIcon = () => (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={47} height={47} style={{ flexShrink: 0, color: contactTextColor }}>
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
            </svg>
          );
          return (
          <div
            aria-hidden={!showContactPart}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--contact-bg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 30,
              opacity: showContactPart ? 1 : 0,
              transition: 'opacity 0.5s ease',
              pointerEvents: showContactPart ? 'auto' : 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transform: showContactPart ? 'translateY(100px) scale(1.2)' : 'translateY(0) scale(1)',
                transition: 'transform 0.6s ease',
                marginTop: 0,
                marginBottom: 100 + (logoBoxSize.height || 180) * 0.15,
              }}
            >
              <div style={{ width: logoBoxSize.width, height: logoBoxSize.height, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {logoimob ? (
                  <img src={logoImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 180, color: contactTextColor }}>apartment</span>
                )}
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {[
                { href: hasPhone ? `https://wa.me/55${(client.phone || client.phone_secondary || '').replace(/\D/g, '')}` : '#', icon: <span className="material-symbols-outlined" style={iconStyle}>chat</span>, label: phoneVal, external: true },
                { href: hasEmail ? `mailto:${client.email}` : '#', icon: <span className="material-symbols-outlined" style={iconStyle}>mail</span>, label: emailVal, external: false },
                { href: hasSite ? ((client.website || site).startsWith('http') ? (client.website || site) : `https://${(client.website || site).replace(/^\/+/, '')}`) : '#', icon: <span className="material-symbols-outlined" style={iconStyle}>language</span>, label: siteVal, external: true },
                { href: hasInstagram ? (client.instagram.startsWith('http') ? client.instagram : `https://instagram.com/${client.instagram.replace(/^@/, '')}`) : '#', icon: <InstagramIcon />, label: instagramVal, external: true },
              ].map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    ...contactNegativo,
                    opacity: showContactPart ? 1 : 0,
                    transform: showContactPart ? 'translateY(0)' : 'translateY(20px)',
                    transition: `opacity 0.4s ease ${0.2 + index * 0.28}s, transform 0.4s ease ${0.2 + index * 0.28}s`,
                  }}
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
            </div>
          </div>
          );
        })()}
      </main>
    </div>
  );
}
