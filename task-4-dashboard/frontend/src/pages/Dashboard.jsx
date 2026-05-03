import { useEffect, useMemo, useState } from "react";
import { getWesterosHouses } from "../services/api";

const REALMS = [
  { label: "The North", icon: "ac_unit", active: true },
  { label: "The Reach", icon: "local_florist", active: false },
  { label: "The Westerlands", icon: "shield", active: false },
  { label: "The Riverlands", icon: "water_drop", active: false },
  { label: "The Vale", icon: "terrain", active: false },
];

const TOP_NAV_LINKS = ["Great Houses", "Characters"];
const PAGE_SIZE = 10;

function getSigilId(houseName = "") {
  const normalized = houseName.toLowerCase();
  if (normalized.includes("stark")) return "stark";
  if (normalized.includes("lannister")) return "lannister";
  if (normalized.includes("targaryen")) return "targaryen";
  if (normalized.includes("baratheon")) return "baratheon";
  if (normalized.includes("greyjoy")) return "greyjoy";
  if (normalized.includes("arryn")) return "arryn";
  if (normalized.includes("martell")) return "martell";
  if (normalized.includes("tyrell")) return "tyrell";
  if (normalized.includes("tully")) return "tully";
  return "generic";
}

function RavenPulse() {
  return (
    <div className="col-span-full border border-[#D4AF37]/40 bg-black/35 p-12 text-center backdrop-blur-md">
      <div className="mx-auto flex w-fit items-center gap-3 text-[#D4AF37] animate-pulse">
        <svg viewBox="0 0 24 24" className="h-8 w-8 fill-current" aria-hidden="true">
          <path d="M3 12c4-2 6-6 9-9l2 1-2 3 3 2 4-1 2 2-3 2 1 3-2 2-2-3-3 1-2 5-2-2 1-3-4-1z" />
        </svg>
        <span className="font-headline-md text-headline-md uppercase tracking-widest">
          Raven Relay In Flight...
        </span>
      </div>
    </div>
  );
}

function Dashboard() {
  const [houses, setHouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [fatalError, setFatalError] = useState(null);
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadHouses = async () => {
      setIsLoading(true);
      setError("");
      setFatalError(null);

      try {
        const result = await getWesterosHouses({
          page: currentPage,
          pageSize: PAGE_SIZE,
        });

        if (!isActive) {
          return;
        }

        setHouses(result);
        setHasNext(result.length === PAGE_SIZE);
      } catch (err) {
        if (!isActive) {
          return;
        }

        const message = err?.message || "The Ravens are tired. GoT API is down or rate-limited.";
        setError(message);
        setHouses([]);
        setHasNext(false);

        if (err?.status === 503 || message.toLowerCase().includes("ravens are tired")) {
          setFatalError(err instanceof Error ? err : new Error(message));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadHouses();

    return () => {
      isActive = false;
    };
  }, [currentPage]);

  const filteredHouses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return houses;
    }

    return houses.filter((house) => {
      const name = (house.name || "").toLowerCase();
      const region = (house.region || "").toLowerCase();
      return name.includes(normalizedQuery) || region.includes(normalizedQuery);
    });
  }, [houses, query]);

  if (fatalError) {
    throw fatalError;
  }

  const renderCards = () => {
    if (isLoading) {
      return <RavenPulse />;
    }

    if (error) {
      return (
        <div className="col-span-full border border-[#D4AF37]/40 bg-black/35 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-[#E0E6ED]">{error}</p>
        </div>
      );
    }

    if (!filteredHouses.length) {
      return (
        <div className="col-span-full border border-[#D4AF37]/40 bg-black/35 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-[#E0E6ED]">
            No houses found on this page.
          </p>
        </div>
      );
    }

    return filteredHouses.map((house, index) => (
      <article
        key={house.url || `${house.name}-${index}`}
        className="group relative overflow-hidden border border-[#D4AF37]/40 bg-black/35 backdrop-blur-md transition-all duration-500 hover:border-[#D4AF37]/80 hover:shadow-[0_0_18px_rgba(212,175,55,0.25)]"
      >
        <div className="relative flex aspect-[2/3] w-full flex-col justify-between p-5">
          <div className="mx-auto mt-2 flex h-28 w-28 items-center justify-center rounded-full border border-[#D4AF37]/45 bg-[#0B0C10]/80">
            <svg viewBox="0 0 120 120" className="h-20 w-20 text-[#D4AF37] fill-current">
              <use href={`/house-sigils.svg#sigil-${getSigilId(house.name)}`} />
            </svg>
          </div>

          <div className="absolute inset-x-0 bottom-0 h-36 bg-[linear-gradient(to_top,#0B0C10_0%,transparent_40%)]" />

          <div className="relative z-10 space-y-2">
            <h3 className="font-headline-md text-headline-md text-[#D4AF37]">
              {house.name || "Unnamed House"}
            </h3>
            <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED]">
              {house.region || "Unknown Region"}
            </p>
            <p className="max-h-10 overflow-hidden font-body-md text-xs text-[#E0E6ED]/90">
              {house.coatOfArms || "Coat of arms not listed."}
            </p>
            <p className="max-h-10 overflow-hidden font-body-md text-xs italic text-[#E0E6ED]/85">
              {house.words ? `"${house.words}"` : "Words: Not recorded."}
            </p>
          </div>
        </div>
      </article>
    ));
  };

  return (
    <div className="relative min-h-screen bg-[#0B0C10] text-[#E0E6ED] font-body-md text-body-md">
      <header className="fixed left-1/2 top-0 z-50 flex h-24 w-full max-w-[1440px] -translate-x-1/2 items-center justify-between border-b border-[#D4AF37]/35 bg-black/80 px-6 shadow-[0_4px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl xl:px-12">
        <div className="font-cinzel text-lg font-bold uppercase tracking-[0.25em] text-[#D4AF37] sm:text-xl xl:text-2xl">
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
                  : "text-[#E0E6ED] transition-colors duration-500 hover:text-[#D4AF37]"
              }
            >
              {link}
            </a>
          ))}
        </nav>
      </header>

      <div className="mx-auto flex max-w-[1440px] pt-24">
        <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-64 flex-col border-r border-[#D4AF37]/25 bg-black/85 shadow-2xl backdrop-blur-2xl lg:flex">
          <div className="border-b border-[#D4AF37]/15 p-8">
            <div className="font-body-md text-lg font-black uppercase tracking-widest text-[#D4AF37]">
              Seven Kingdoms
            </div>
            <div className="mt-1 font-body-md text-[10px] uppercase tracking-widest text-[#E0E6ED]/70">
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
                        : "flex scale-95 items-center px-8 py-4 font-body-md text-xs uppercase tracking-widest text-[#E0E6ED]/75 transition-transform hover:bg-white/5 hover:text-[#E0E6ED] active:scale-100"
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

        <main className="smoke-bg flex-1 bg-[#0B0C10] px-6 pb-section-gap md:px-10 xl:px-container-padding">
          <section className="flex flex-col items-center justify-center pb-16 pt-24 text-center">
            <h1 className="mb-element-gap font-headline-xl text-headline-xl text-[#D4AF37]">
              DIRECTORY OF THRONES
            </h1>

            <div className="group relative w-full max-w-2xl">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search house name or region on this page..."
                className="w-full border border-[#D4AF37]/35 bg-black/40 px-8 py-5 font-body-md text-body-md italic text-[#E0E6ED] backdrop-blur-md transition-all duration-500 placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none focus:ring-1 focus:ring-[#D4AF37]"
              />
              <span className="material-symbols-outlined absolute right-6 top-1/2 -translate-y-1/2 text-[#D4AF37]">
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
              onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
              disabled={currentPage === 1 || isLoading}
              className="group flex items-center gap-4 border border-[#D4AF37] px-6 py-4 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-35 sm:px-10"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-2">
                arrow_back_ios
              </span>
              Previous Realm
            </button>

            <div className="font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED]/80">
              Page {currentPage}
            </div>

            <button
              type="button"
              onClick={() => hasNext && setCurrentPage((previous) => previous + 1)}
              disabled={!hasNext || isLoading}
              className="group flex items-center gap-4 border border-[#D4AF37] px-6 py-4 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-35 sm:px-10"
            >
              Next Realm
              <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-2">
                arrow_forward_ios
              </span>
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard;
