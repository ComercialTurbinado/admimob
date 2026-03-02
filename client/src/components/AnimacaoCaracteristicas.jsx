import { useEffect, useState, useRef } from 'react';
import { getAmenityLabel, getAmenityIcon, CHARACTERISTIC_ICONS } from '../lib/amenitiesLabels';

/**
 * Poster 1080×1920: hero (foto + brand glass), info (badge, ref, preço, localização),
 * stats (quartos, banheiros, vagas, área), amenities (lazer), footer.
 */
const ART_WIDTH = 1080;
const ART_HEIGHT = 1920;
const DURATION_MS = 5000;
export { DURATION_MS };
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

export default function AnimacaoCaracteristicas({ listing, onEnd, backgroundColor, itemsPerRow, iconSize, videoMode }) {
  const [started, setStarted] = useState(false);
  const [scale, setScale] = useState(1);
  const wrapRef = useRef(null);
  const amenities = listing?.amenitiesList || listing?.['amenities-list'] || [];
  const logoimob = listing?.logoimob;
  const imobname = listing?.imobname;
  const propertyCodes = listing?.propertyCodes;
  const characteristics = getCharacteristics(amenities);
  const leisure = getLeisureAmenities(amenities);
  const heroImg =
    (listing?.carousel_images && listing.carousel_images[0]) ||
    (listing?.selected_images && listing.selected_images[0]) ||
    listing?.images?.[0] ||
    HERO_PLACEHOLDER;
  const price = getPrice(listing);
  const location = getLocation(listing);
  const refText = propertyCodes ? `REF: ${propertyCodes}` : 'REF: —';
  const site = listing?.website || 'www.exemplo.com';
  const copyright = `© ${new Date().getFullYear()} ${(imobname || 'IMOBILIÁRIA').toUpperCase()} - TODOS OS DIREITOS RESERVADOS`;

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 100);
    const tEnd = setTimeout(() => onEnd?.(), DURATION_MS + 200);
    return () => {
      clearTimeout(t);
      clearTimeout(tEnd);
    };
  }, [onEnd]);

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
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: ART_WIDTH,
        maxHeight: ART_HEIGHT,
        boxSizing: 'border-box',
        overflow: 'hidden',
        margin: '0 auto',
        opacity: started ? 1 : 0,
        transition: 'opacity 0.4s ease',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <main
        className="poster"
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
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'scale(1)' : 'scale(1.08)',
              transition: 'opacity 0.8s ease, transform 1.2s ease',
              borderBottomLeftRadius: 50,
              borderBottomRightRadius: 50,
            }}
          />
          <div
            className="brand-glass"
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'scale(1)' : 'scale(0.9)',
              transition: 'opacity 0.5s ease 0.5s, transform 0.6s ease 0.5s',
            }}
          >
            <div className="brand-card">
              <div className="brand-icon">
                {logoimob ? (
                  <img src={logoimob} alt="" />
                ) : (
                  <span className="material-symbols-outlined">apartment</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* INFO */}
        <section className="info">
          <div
            className="meta"
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(14px)',
              transition: 'opacity 0.45s ease 1s, transform 0.45s ease 1s',
            }}
          >
            <span className="badge-poster">À VENDA</span>
            <span className="ref">{refText}</span>
          </div>
          <h1
            className="price"
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(12px)',
              transition: 'opacity 0.45s ease 1.5s, transform 0.45s ease 1.5s',
            }}
          >
            {price}
          </h1>
          <div
            className="location"
            style={{
              opacity: started ? 1 : 0,
              transform: started ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.45s ease 2s, transform 0.45s ease 2s',
            }}
          >
            <span className="material-symbols-outlined">location_on</span>
            <span>{location}</span>
          </div>
        </section>

        {/* STATS */}
        {characteristics.length > 0 && (
          <section
            className="stats"
            style={{
              gridTemplateColumns: `repeat(${characteristics.length}, 1fr)`,
              background: started ? '#fafafa' : '#fff',
              borderTop: '1px solid',
              borderBottom: '1px solid',
              borderColor: started ? 'var(--line-poster)' : 'transparent',
              transition: 'background 0.4s ease 2.5s, border-color 0.4s ease 2.5s',
            }}
          >
            {characteristics.map((item, i) => {
              const iconName = CHARACTERISTIC_ICONS[item.name];
              const value = item?.value ?? (typeof item === 'string' ? item : '');
              const text = value && typeof value === 'string' ? value : getAmenityLabel(item.name);
              const delay = 2.5 + i * 0.15;
              return (
                <div
                  key={i}
                  className="stat"
                  style={{
                    opacity: started ? 1 : 0,
                    transform: started ? 'translateY(0)' : 'translateY(16px)',
                    transition: `opacity 0.45s ease ${delay}s, transform 0.45s ease ${delay}s`,
                  }}
                >
                  <span className="material-symbols-outlined">{iconName}</span>
                  <div className="label">{text}</div>
                </div>
              );
            })}
          </section>
        )}

        {/* AMENITIES */}
        {leisure.length > 0 && (
          <section className="amenities">
            <h3
              style={{
                opacity: started ? 1 : 0,
                transform: started ? 'translateY(0)' : 'translateY(12px)',
                transition: 'opacity 0.45s ease 3.2s, transform 0.45s ease 3.2s',
              }}
            >
              Lazer e comodidades
            </h3>
            <div className="amen-grid">
              {leisure.map((item, i) => {
                const label = getAmenityLabel(item?.name);
                const value = item?.value ?? item;
                const text = value && typeof value === 'string' && label !== value ? value : label;
                const iconName = getAmenityIcon(item?.name);
                const delay = 3.5 + i * 0.12;
                return (
                  <div
                    key={i}
                    className="amen"
                    style={{
                      opacity: started ? 1 : 0,
                      transform: started ? 'translateY(0)' : 'translateY(14px)',
                      transition: `opacity 0.4s ease ${delay}s, transform 0.4s ease ${delay}s`,
                    }}
                  >
                    <span className="material-symbols-outlined">{iconName}</span>
                    <span className="text">{text}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <div className="spacer" />

        {/* FOOTER */}
        <footer
          className="footer-poster"
          style={{
            opacity: started ? 1 : 0,
            transform: started ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity 0.5s ease 4s, transform 0.5s ease 4s',
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
