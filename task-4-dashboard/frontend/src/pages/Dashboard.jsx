import { useEffect, useMemo, useState } from "react";
import { getThronesCharacters } from "../services/api";

const REALMS = [
  { label: "The North", icon: "ac_unit", active: true },
  { label: "The Reach", icon: "local_florist", active: false },
  { label: "The Westerlands", icon: "shield", active: false },
  { label: "The Riverlands", icon: "water_drop", active: false },
  { label: "The Vale", icon: "terrain", active: false },
];

const TOP_NAV_LINKS = ["Great Houses", "Characters", "Map", "History"];
const ITEMS_PER_PAGE = 10;

function Dashboard() {
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadCharacters = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await getThronesCharacters();
        if (isActive) {
          setCharacters(Array.isArray(result) ? result : []);
        }
      } catch (err) {
        if (isActive) {
          setError(err?.message || "The ravens are tired. Character records are unavailable.");
          setCharacters([]);
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
  }, []);

  const filteredCharacters = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return characters;
    }

    return characters.filter((character) => {
      const fullName = (character.fullName || "").toLowerCase();
      const title = (character.title || "").toLowerCase();
      const family = (character.family || "").toLowerCase();
      return fullName.includes(normalizedQuery) || title.includes(normalizedQuery) || family.includes(normalizedQuery);
    });
  }, [characters, query]);

  const totalPages = Math.max(1, Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE));

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages));
  }, [totalPages]);

  const paginatedCharacters = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, page]);

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

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

    if (!paginatedCharacters.length) {
      return (
        <div className="col-span-full border border-[#D4AF37]/30 bg-black/40 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-secondary">
            No names found for this search.
          </p>
        </div>
      );
    }

    return paginatedCharacters.map((character) => (
      <article
        key={character.id}
        className="group relative overflow-hidden border border-[#D4AF37]/20 shadow-2xl transition-all duration-500 hover:z-10 hover:scale-105 hover:border-[#D4AF37]/60 hover:shadow-[0_0_15px_rgba(212,175,55,0.3)]"
      >
        <div className="relative aspect-[2/3] w-full">
          <img
            src={character.imageUrl}
            alt={character.fullName || "Unknown character"}
            className="h-full w-full object-cover object-top"
            loading="lazy"
          />

          <div className="absolute inset-0 z-10 bg-[linear-gradient(to_top,rgba(11,12,16,0.98)_0%,rgba(11,12,16,0.8)_38%,rgba(11,12,16,0.15)_72%,rgba(11,12,16,0)_100%)]" />

          <div className="absolute bottom-0 left-0 z-20 w-full border-t border-[#D4AF37]/20 bg-black/40 p-6 backdrop-blur-md">
            <h3 className="font-headline-md text-headline-md text-primary">{character.fullName || "Unknown Name"}</h3>
            <p className="mt-2 font-body-md text-body-md text-secondary uppercase tracking-[0.2em] text-xs">
              {character.title || "No Known Title"}
            </p>
            <div className="mt-4 flex items-center">
              <span className="mr-4 h-[1px] w-8 bg-[#D4AF37]/40" />
              <span className="font-label-caps text-label-caps text-silver-400">
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

        <nav className="hidden items-center gap-8 font-cinzel uppercase tracking-[0.2em] lg:flex">
          {TOP_NAV_LINKS.map((link, index) => (
            <a
              key={link}
              href="#"
              className={
                index === 0
                  ? "border-b-2 border-[#D4AF37] pb-1 text-[#D4AF37] transition-colors duration-500"
                  : "text-gray-400 transition-colors duration-500 hover:text-[#D4AF37]"
              }
            >
              {link}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4 sm:gap-6">
          <button className="rounded-full p-2 text-gray-400 transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="rounded-full p-2 text-gray-400 transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37]">
            <span className="material-symbols-outlined">settings</span>
          </button>
          <div className="h-10 w-10 overflow-hidden rounded-full border border-[#D4AF37]/40">
            <img
              src="https://thronesapi.com/assets/images/jon-snow.jpg"
              alt="Commander Profile"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px] pt-24">
        <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-64 flex-col border-r border-[#D4AF37]/20 bg-black/90 shadow-2xl backdrop-blur-2xl lg:flex">
          <div className="border-b border-[#D4AF37]/10 p-8">
            <div className="font-body-md text-lg font-black uppercase tracking-widest text-[#D4AF37]">
              Seven Kingdoms
            </div>
            <div className="mt-1 font-body-md text-[10px] uppercase tracking-widest text-gray-500">
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
                        : "flex scale-95 items-center px-8 py-4 font-body-md text-xs uppercase tracking-widest text-gray-500 transition-transform hover:bg-white/5 hover:text-silver-200 active:scale-100"
                    }
                  >
                    <span className="material-symbols-outlined mr-4">{realm.icon}</span>
                    {realm.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-[#D4AF37]/10 p-6">
            <button className="w-full border border-[#D4AF37] py-4 font-body-md text-[10px] uppercase tracking-[0.2em] text-[#D4AF37] transition-all duration-400 hover:bg-[#D4AF37]/10">
              Support the Watch
            </button>
            <div className="mt-4">
              <a
                href="#"
                className="flex items-center px-2 py-2 font-body-md text-[10px] uppercase tracking-widest text-gray-500 hover:text-[#D4AF37]"
              >
                <span className="material-symbols-outlined mr-2 text-sm">auto_stories</span>
                Archives
              </a>
            </div>
          </div>
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
                className="w-full border border-[#D4AF37]/30 bg-black/40 px-8 py-5 font-body-md text-body-md italic text-on-surface backdrop-blur-md transition-all duration-500 placeholder:text-gray-600 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <button className="absolute right-6 top-1/2 -translate-y-1/2 text-primary">
                <span className="material-symbols-outlined">search</span>
              </button>
            </div>
          </section>

          <div className="throne-divider mb-section-gap" />

          <section className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {renderCards()}
          </section>

          <section className="mx-auto mt-section-gap flex max-w-4xl items-center justify-between">
            <button
              type="button"
              onClick={() => canGoPrevious && setPage((currentPage) => currentPage - 1)}
              disabled={!canGoPrevious}
              className="group flex items-center gap-4 border border-[#D4AF37] px-6 py-4 font-label-caps text-label-caps text-silver-400 transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 sm:px-10"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-2">
                arrow_back_ios
              </span>
              Previous Realm
            </button>

            <div className="hidden gap-4 md:flex">
              {[1, 2, 3].map((dotIndex) => (
                <span
                  key={dotIndex}
                  className={
                    dotIndex === Math.min(page, 3)
                      ? "h-2 w-2 rotate-45 bg-[#D4AF37]"
                      : "h-2 w-2 rotate-45 border border-[#D4AF37]"
                  }
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => canGoNext && setPage((currentPage) => currentPage + 1)}
              disabled={!canGoNext}
              className="group flex items-center gap-4 border border-[#D4AF37] px-6 py-4 font-label-caps text-label-caps text-silver-400 transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-35 sm:px-10"
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
