import { useEffect, useRef, useState } from 'react';
import { ValleyEngine } from './valley/ValleyEngine';
import { StudioDrawer, StudioSection } from './components/StudioDrawer';

export default function App() {
  const valleyRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ValleyEngine | null>(null);
  const vignetteRef = useRef<HTMLDivElement | null>(null);

  const [loaded, setLoaded] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [activeSection, setActiveSection] = useState<StudioSection>(null);

  useEffect(() => {
    const container = valleyRef.current;
    if (!container) return;

    let introShown = false;

    let engine: ValleyEngine | null = null;
    try {
      engine = new ValleyEngine(
        container,
        () => {
          setLoaded(true);
        },
        () => {
          if (!introShown) {
            introShown = true;
            setIntroDone(true);
          }
        },
        (speed) => {
          if (vignetteRef.current) {
            // Subtle extra vignette depth synced to camera velocity
            vignetteRef.current.style.opacity = String(0.68 + speed * 0.32);
          }
        }
      );
      engineRef.current = engine;
    } catch {
      setLoaded(true);
      setIntroDone(true);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveSection(null);
        engine?.stopHoverTransition();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        engine?.nudgeScroll(4.5);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        engine?.nudgeScroll(-4.5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  // Keep valley hover dispersion & muffled audio synced whenever a studio drawer is open
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (activeSection) {
      engine.startHoverTransition();
    } else {
      engine.stopHoverTransition();
    }
  }, [activeSection]);

  const handleToggleSound = () => {
    const engine = engineRef.current;
    if (!engine || !engine.audioStore.isInitialized) return;
    const muted = engine.audioStore.toggleMute();
    setSoundOn(!muted);
  };

  const handleGoEnter = () => {
    if (!activeSection) {
      engineRef.current?.startHoverTransition();
    }
  };

  const handleGoLeave = () => {
    if (!activeSection) {
      engineRef.current?.stopHoverTransition();
    }
  };

  const handleOpenSection = (section: StudioSection) => {
    setActiveSection(section);
  };

  return (
    <>
      <div id="valley" ref={valleyRef} aria-hidden="true">
        <div className="js-canvas-container" />
      </div>

      <div className="valley-vignette" ref={vignetteRef} aria-hidden="true" />

      <div className={`ui${introDone ? ' on' : ''}`} id="ui">
        <header className="valley-header">
          <a
            className="logo"
            href="#top"
            aria-label="SKY RIFT"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection(null);
            }}
          >
            <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
              <defs>
                <filter id="logo-keyout" colorInterpolationFilters="sRGB">
                  <feColorMatrix
                    type="matrix"
                    values="0 0 0 0 0.961
                            0 0 0 0 0.937
                            0 0 0 0 0.886
                            0.95 0.95 0.95 0 -0.45"
                  />
                </filter>
              </defs>
            </svg>
            <img
              className="logo-img"
              src="./assets/aistudio/IMG_1030_af4eb529.PNG"
              alt="SKY RIFT"
            />
          </a>
          <nav className="valley-nav" aria-label="Main">
            <button type="button" onClick={() => handleOpenSection('about')}>
              О бренде
            </button>
            <button type="button" onClick={() => handleOpenSection('contact')}>
              Контакты
            </button>
            <button type="button" onClick={() => handleOpenSection('journal')}>
              История
            </button>
            <button
              type="button"
              className="pill"
              onClick={() => handleOpenSection('work')}
            >
              Проекты
            </button>
          </nav>
        </header>

        <section className="hero" aria-label="Fernhollow Hero">
          <h1>SKY RIFT</h1>
          <p className="cap">
            Укоренено в природе.
            <br />
            Создано для будущего.
          </p>
          <button
            type="button"
            className="go"
            id="go"
            aria-label="Посмотрите наши работы"
            onPointerEnter={handleGoEnter}
            onPointerLeave={handleGoLeave}
            onClick={() => handleOpenSection('work')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </button>
        </section>

        <div className="corner">
          <span>Прокрутите, чтобы побродить</span>
          <i aria-hidden="true" />
          <button
            type="button"
            className="sound"
            id="sound"
            aria-pressed={soundOn}
            aria-label="Окружающий звук"
            onClick={handleToggleSound}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5Z" />
              <path
                className="w"
                d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"
              />
              <path className="x" d="m16 10 4 4m0-4-4 4" />
            </svg>
          </button>
        </div>
      </div>

      <div className={`loader${loaded ? ' gone' : ''}`} id="loader" aria-hidden="true">
        <span />
      </div>

      <StudioDrawer section={activeSection} onClose={() => setActiveSection(null)} />
    </>
  );
}
