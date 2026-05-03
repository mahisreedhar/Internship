import { useEffect, useState } from "react";
import { getThronesCharacters } from "../services/api";

const REALMS = [
  { label: "The North", icon: "ac_unit", active: true },
  { label: "The Reach", icon: "local_florist", active: false },
  { label: "The Westerlands", icon: "shield", active: false },
  { label: "The Riverlands", icon: "water_drop", active: false },
  { label: "The Vale", icon: "terrain", active: false },
];

const TOP_NAV_LINKS = ["Great Houses", "Characters"];
const PAGE_SIZE = 10;

function Dashboard() {
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [fatalError, setFatalError] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadCharacters = async () => {
      setIsLoading(true);
      setError("");
      setFatalError(null);

      try {
        const payload = await getThronesCharacters({
          page,
          pageSize: PAGE_SIZE,
          search: query,
        });

        if (!isActive) {
          return;
        }

        setCharacters(Array.isArray(payload?.items) ? payload.items : []);
        setHasNext(Boolean(payload?.has_next));
        setHasPrevious(Boolean(payload?.has_previous));
      } catch (err) {
        if (!isActive) {
          return;
        }

        const message = err?.message || "The Ravens are tired. GoT API is down or rate-limited.";
        setError(message);
        setCharacters([]);
        setHasNext(false);
        setHasPrevious(page > 1);

        if (err?.status === 503 || message.toLowerCase().includes("ravens are tired")) {
          setFatalError(err instanceof Error ? err : new Error(message));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadCharacters();

    return () => {
      isActive = false;
    };
  }, [page, query]);

  if (fatalError) {
    throw fatalError;
  }

  const renderCards = () => {
    if (isLoading) {
      return (
        <div className="col-span-full border border-[#D4AF37]/30 bg-black/40 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-secondary">
            Summoning the archives of Westeros...
          </p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="col-span-full border border-[#D4AF37]/30 bg-black/40 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-secondary">{error}</p>
        </div>
      );
    }

    if (!characters.length) {
      return (
        <div className="col-span-full border border-[#D4AF37]/30 bg-black/40 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-secondary">
            No names found for this search.
          </p>
        </div>
      );
    }

    return characters.map((character, index) => (
      <article
        key={character.id || `${character.fullName}-${index}`}
        className="group relative overflow-hidden border border-[#D4AF37]/20 shadow-2xl transition-all duration-500 hover:z-10 hover:scale-105 hover:border-[#D4AF37]/60 hover:shadow-[0_0_15px_rgba(212,175,55,0.3)]"
      >
        <div className="relative aspect-[2/3] w-full">
          <img
            src={character.imageUrl}
            alt={character.fullName || "Unknown character"}
            className="h-full w-full object-cover object-top"
            loading="lazy"
          />
          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,#0B0C10_0%,transparent_40%)]" />
          <div className="absolute bottom-0 left-0 z-20 w-full border-t border-[#D4AF37]/20 bg-black/40 p-5 backdrop-blur-md">
            <h3 className="font-headline-md text-headline-md text-primary">
              {character.fullName || "Unknown Name"}
            </h3>
            <p className="mt-2 font-body-md text-body-md text-secondary uppercase tracking-[0.2em] text-xs">
              {character.title || "No Known Title"}
            </p>
            <div className="mt-4 flex items-center">
              <span className="mr-4 h-[1px] w-8 bg-[#D4AF37]/40" />
              <span className="font-body-md text-[11px] uppercase tracking-[0.16em] text-silver-400">
                {character.family || "Unknown Family"}
              </span>
            </div>
          </div>
        </div>
      </article>
    ));
  };

  return (
    <div className="relative min-h-screen bg-background text-on-background font-body-md text-body-md selection:bg-primary-container selection:text-on-primary-container">
      <header className="fixed left-1/2 top-0 z-50 flex h-24 w-full max-w-[1440px] -translate-x-1/2 items-center justify-between border-b border-[#D4AF37]/30 bg-black/80 px-6 shadow-[0_4px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl xl:px-12">
        <div className="font-cinzel text-lg font-bold uppercase tracking-[0.25em] text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.4)] sm:text-xl xl:text-2xl">
          Directory of Thrones
        </div>

        <nav className="flex items-center gap-8 font-cinzel uppercase tracking-[0.2em]">
          {TOP_NAV_LINKS.map((link, index) => (
            <a
              key={link}
              href="#"
              className={
                index === 0
                  ? "border-b-2 border-[#D4AF37] pb-1 text-[#D4AF37] transition-colors duration-500"
                  : "text-silver-400 transition-colors duration-500 hover:text-[#D4AF37]"
              }
            >
              {link}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1440px] pt-24">
        <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-64 flex-col border-r border-[#D4AF37]/20 bg-black/90 shadow-2xl backdrop-blur-2xl lg:flex">
          <div className="border-b border-[#D4AF37]/10 p-8">
            <div className="font-body-md text-lg font-black uppercase tracking-widest text-[#D4AF37]">
              Seven Kingdoms
            </div>
            <div className="mt-1 font-body-md text-[10px] uppercase tracking-widest text-silver-400/70">
              Westeros Directory
            </div>
          </div>

          <nav className="flex-1 py-6">
            <ul className="space-y-1">
              {REALMS.map((realm) => (
                <li key={realm.label}>
                  <a
                    href="#"
                    className={
                      realm.active
                        ? "flex scale-95 items-center border-l-4 border-[#D4AF37] bg-[#D4AF37]/10 px-8 py-4 font-body-md text-xs uppercase tracking-widest text-[#D4AF37] transition-transform active:scale-100"
                        : "flex scale-95 items-center px-8 py-4 font-body-md text-xs uppercase tracking-widest text-silver-400/70 transition-transform hover:bg-white/5 hover:text-silver-200 active:scale-100"
                    }
                  >
                    <span className="material-symbols-outlined mr-4">{realm.icon}</span>
                    {realm.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="smoke-bg flex-1 bg-surface-dim px-6 pb-section-gap md:px-10 xl:px-container-padding">
          <section className="flex flex-col items-center justify-center pb-16 pt-24 text-center">
            <h1 className="mb-element-gap font-headline-xl text-headline-xl text-primary drop-shadow-[0_0_15px_rgba(242,202,80,0.3)]">
              DIRECTORY OF THRONES
            </h1>

            <div className="group relative w-full max-w-2xl">
              <input
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="Search the lineages of the Seven Kingdoms..."
                className="w-full border border-[#D4AF37]/30 bg-black/40 px-8 py-5 font-body-md text-body-md italic text-silver-400 backdrop-blur-md transition-all duration-500 placeholder:text-silver-400/50 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-primary">
                search
              </span>
            </div>
          </section>

          <div className="throne-divider mb-section-gap" />

          <section className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {renderCards()}
          </section>

          <section className="mx-auto mt-section-gap flex max-w-4xl items-center justify-between">
            <button
              type="button"
              onClick={() => hasPrevious && setPage((currentPage) => Math.max(1, currentPage - 1))}
              disabled={!hasPrevious}
              className="group flex items-center gap-4 border border-[#D4AF37] px-6 py-4 font-body-md text-label-caps text-silver-400 transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 sm:px-10"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-2">
                arrow_back_ios
              </span>
              Previous Realm
            </button>

            <button
              type="button"
              onClick={() => hasNext && setPage((currentPage) => currentPage + 1)}
              disabled={!hasNext}
              className="group flex items-center gap-4 border border-[#D4AF37] px-6 py-4 font-body-md text-label-caps text-silver-400 transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 sm:px-10"
            >
              Next Realm
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-2">
                arrow_forward_ios
              </span>
            </button>
          </section>
        </main>
      </div>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute right-[-10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-primary/5 blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] h-[50%] w-[50%] rounded-full bg-white/2 blur-[150px]" />
      </div>
    </div>
  );
}

export default Dashboard;
