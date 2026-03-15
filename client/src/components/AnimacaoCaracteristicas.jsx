import { useEffect, useState, useRef } from 'react';
import { API } from '../api';
import { getAmenityLabel, getAmenityIcon, CHARACTERISTIC_ICONS } from '../lib/amenitiesLabels';
import { getDominantColorFromImageUrl, getPaletteFromPrimary } from '../lib/dominantColor';

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
/** 120 frames a 24 fps = 5 s; mais leve para n8n/FFmpeg (menos memória). */
const CAPTURE_FRAMES = 120;
const DURATION_MS = Math.round((CAPTURE_FRAMES / 24) * 1000);
export { DURATION_MS };

/** Tempo (em segundos) em que a animação da imagem de capa termina; os demais elementos só entram depois. */
const HERO_ANIM_END_S = 0.8;

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

export default function AnimacaoCaracteristicas({ listing, onEnd, backgroundColor, itemsPerRow, iconSize, videoMode, captureStep, layout = 'classic' }) {
  const [started, setStarted] = useState(false);
  const [scale, setScale] = useState(1);
  const [heroProxyFailed, setHeroProxyFailed] = useState(false);
  const [logoProxyFailed, setLogoProxyFailed] = useState(false);
  const [posterPalette, setPosterPalette] = useState(null);
  const wrapRef = useRef(null);
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
    if (stepMode) return;
    const t = setTimeout(() => setStarted(true), 100);
    const tEnd = setTimeout(() => onEnd?.(), DURATION_MS + 200);
    return () => {
      clearTimeout(t);
      clearTimeout(tEnd);
    };
  }, [onEnd, stepMode]);

  useEffect(() => {
    const raw = listing?.logoimob;
    if (!raw || typeof raw !== 'string') {
      setPosterPalette(null);
      return;
    }
    const logoUrl = proxyIfNeeded(raw, true);
    if (!logoUrl.startsWith('http') && !logoUrl.startsWith('/')) {
      setPosterPalette(null);
      return;
    }
    let cancelled = false;
    getDominantColorFromImageUrl(logoUrl).then((hex) => {
      if (cancelled || !hex) return;
      setPosterPalette(getPaletteFromPrimary(hex));
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
                  borderBottomLeftRadius: 50,
                  borderBottomRightRadius: 50,
                }
              : {
                  opacity: started ? 1 : 0,
                  transition: 'opacity 0.8s ease',
                  borderBottomLeftRadius: 50,
                  borderBottomRightRadius: 50,
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
              <div className="brand-icon">
                {logoimob ? (
                  <img src={logoImg} alt="" crossOrigin="anonymous" onError={() => videoMode && setLogoProxyFailed(true)} />
                ) : (
                  <span className="material-symbols-outlined">apartment</span>
                )}
              </div>
            </div>
          </div>
        </section>
        {layout === 'cards' && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 600, pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', padding: '0 0 32px 32px' }}>
            <span style={{ background: 'var(--primary)', color: '#fff', padding: '8px 24px', borderRadius: 8, fontWeight: 700, fontSize: 20, letterSpacing: '0.08em', opacity: stepMode ? progressAt(tMs, HERO_ANIM_END_S, 0.2) : started ? 1 : 0, transition: stepMode ? 'none' : `opacity 0.5s ease ${HERO_ANIM_END_S + 0.2}s` }}>{refText}</span>
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
      </main>
    </div>
  );
}
