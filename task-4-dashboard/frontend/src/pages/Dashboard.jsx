import { useEffect, useRef, useState } from "react";
import { fetchPokemon } from "../services/api";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 320;

const GENERATION_PRESETS = [
  { id: 0, label: "All Pokémon" },
  { id: 1, label: "Generation I — Kanto" },
  { id: 2, label: "Generation II — Johto" },
  { id: 3, label: "Generation III — Hoenn" },
  { id: 4, label: "Generation IV — Sinnoh" },
  { id: 5, label: "Generation V — Unova" },
  { id: 6, label: "Generation VI — Kalos" },
  { id: 7, label: "Generation VII — Alola" },
  { id: 8, label: "Generation VIII — Galar" },
  { id: 9, label: "Generation IX — Paldea" },
];

const TYPE_COLORS = {
  normal:   "#7a7a6a",
  fire:     "#b34200",
  water:    "#1a56b0",
  electric: "#b08a00",
  grass:    "#2a6b24",
  ice:      "#00727a",
  fighting: "#8a1e1a",
  poison:   "#561880",
  ground:   "#6e5b0e",
  flying:   "#362090",
  psychic:  "#9c1e42",
  bug:      "#455e14",
  rock:     "#6a5620",
  ghost:    "#38206e",
  dragon:   "#101e88",
  dark:     "#2e343a",
  steel:    "#445560",
  fairy:    "#961858",
};

function PokeBallPulse() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24">
      <div className="relative h-16 w-16 animate-spin">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#D4AF37" strokeWidth="5" />
          <path d="M 10 50 A 40 40 0 0 1 90 50 Z" fill="#D4AF37" />
          <path d="M 10 50 A 40 40 0 0 0 90 50 Z" fill="#1a1c22" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#0B0C10" strokeWidth="5" />
          <circle cx="50" cy="50" r="9" fill="#1a1c22" stroke="#0B0C10" strokeWidth="4" />
          <circle cx="50" cy="50" r="5" fill="#D4AF37" />
        </svg>
      </div>
      <p className="mt-6 font-cinzel text-xs uppercase tracking-[0.25em] text-[#D4AF37]/70">
        Loading Pokédex...
      </p>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState({ items: [], total_items: 0, page: 1, page_size: PAGE_SIZE });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [activeGeneration, setActiveGeneration] = useState(0);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  // Debounce search — resets page to 1
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  // Main fetch effect — triggers on page, search, or generation change
  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError("");

    fetchPokemon({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: debouncedSearchTerm,
      generation: activeGeneration,
    })
      .then((result) => {
        if (isActive) setData(result);
      })
      .catch((err) => {
        if (isActive) {
          setError(err.message || "Failed to load Pokémon data.");
          setData({ items: [], total_items: 0, page: currentPage, page_size: PAGE_SIZE });
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, activeGeneration]);

  const totalPages = Math.max(1, Math.ceil(data.total_items / PAGE_SIZE));
  const hasActiveFilters = Boolean(activeGeneration !== 0 || searchTerm);

  const onGenerationSelect = (gen) => {
    setActiveGeneration(gen.id);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setActiveGeneration(0);
    setCurrentPage(1);
  };

  const renderCards = () => {
    if (isLoading) return <PokeBallPulse />;

    if (error) {
      return (
        <div className="col-span-full border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-sm uppercase tracking-[0.2em] text-[#E0E6ED]">{error}</p>
        </div>
      );
    }

    if (!data.items.length) {
      return (
        <div className="col-span-full border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-sm uppercase tracking-[0.12em] text-[#E0E6ED]">
            No Pokémon match your search.
          </p>
        </div>
      );
    }

    return data.items.map((pokemon, index) => (
      <article
        key={pokemon.id}
        style={{ animationDelay: `${index * 55}ms` }}
        className="stagger-card group relative flex min-h-[380px] cursor-pointer flex-col overflow-hidden border border-[#1e2030] bg-[#101216] transition-all duration-400 hover:border-[#D4AF37]/60 hover:shadow-[0_0_20px_rgba(212,175,55,0.25)]"
      >
        {/* Official artwork background */}
        <div className="absolute inset-0">
          {pokemon.image ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${pokemon.image})` }}
            />
          ) : null}
          {/* Bottom-to-top gradient for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10]/95 via-[#0B0C10]/50 to-[#0B0C10]/10" />
        </div>

        {/* Type badges — top left */}
        <div className="relative z-10 flex flex-wrap gap-1.5 p-3">
          {pokemon.types.map((typeName) => (
            <span
              key={typeName}
              style={{ backgroundColor: TYPE_COLORS[typeName] ?? "#555" }}
              className="rounded-sm px-2 py-0.5 font-body-md text-[10px] font-medium uppercase tracking-[0.1em] text-white/90"
            >
              {typeName}
            </span>
          ))}
        </div>

        {/* Bottom content */}
        <div className="relative z-10 mt-auto p-4">
          <h3 className="mb-2 font-cinzel text-xl font-bold uppercase tracking-[0.12em] text-[#D4AF37]">
            {pokemon.name}
          </h3>
          <div className="space-y-0.5 font-body-md text-sm text-[#DDE3EA]/70">
            <p>
              <span className="text-[#D4AF37]/80">ID:</span>{" "}
              <span className="text-[#DDE3EA]">#{String(pokemon.id).padStart(3, "0")}</span>
            </p>
            <p>
              <span className="text-[#D4AF37]/80">Weight:</span>{" "}
              <span className="text-[#DDE3EA]">{pokemon.weight / 10} kg</span>
            </p>
            <p>
              <span className="text-[#D4AF37]/80">Height:</span>{" "}
              <span className="text-[#DDE3EA]">{pokemon.height / 10} m</span>
            </p>
          </div>
        </div>
      </article>
    ));
  };

  return (
    <div className="relative min-h-screen bg-[#0B0C10] text-[#E0E6ED] font-body-md text-body-md">
      {/* Header */}
      <header className="fixed left-1/2 top-0 z-50 flex h-24 w-full max-w-[1440px] -translate-x-1/2 items-center justify-between border-b border-[#D4AF37]/35 bg-black/80 px-6 shadow-[0_4px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl md:px-10 xl:px-14">
        <h1 className="font-cinzel text-base font-bold uppercase tracking-[0.25em] text-[#D4AF37] sm:text-xl xl:text-2xl">
          Pokédex Dashboard
        </h1>
        {data.total_items > 0 && (
          <p className="hidden font-body-md text-[11px] uppercase tracking-[0.2em] text-[#DDE3EA]/50 sm:block">
            {data.total_items.toLocaleString()} results
          </p>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[1440px] pt-24">
        {/* Generation sidebar */}
        <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-64 flex-col border-r border-[#D4AF37]/25 bg-black/85 backdrop-blur-2xl lg:flex">
          <div className="border-b border-[#D4AF37]/20 p-6">
            <p className="font-cinzel text-sm uppercase tracking-[0.2em] text-[#D4AF37]">Generation</p>
            <p className="mt-2 font-body-md text-[10px] uppercase tracking-[0.2em] text-[#DDE3EA]/70">
              Regional Navigator
            </p>
          </div>
          <nav className="overflow-y-auto py-4">
            {GENERATION_PRESETS.map((gen) => {
              const isActive = activeGeneration === gen.id;
              return (
                <button
                  key={gen.id}
                  type="button"
                  onClick={() => onGenerationSelect(gen)}
                  className={
                    isActive
                      ? "relative flex w-full items-center bg-[#D4AF37]/10 px-5 py-3 text-left font-body-md text-xs uppercase tracking-[0.18em] text-[#D4AF37]"
                      : "relative flex w-full items-center px-5 py-3 text-left font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]/80 transition-colors hover:bg-white/5 hover:text-[#D4AF37]"
                  }
                >
                  {isActive ? (
                    <span className="absolute left-0 top-0 h-full w-[3px] bg-[#D4AF37]" aria-hidden="true" />
                  ) : null}
                  <span className="pl-2">{gen.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="smoke-bg w-full flex-1 px-4 pb-24 pt-6 sm:px-8 md:px-12 xl:px-16 2xl:px-24">
          {/* Filter panel */}
          <section className="mx-auto mb-8 flex w-full max-w-[1180px] flex-col gap-6 border border-[#D4AF37]/60 bg-black/50 p-5 backdrop-blur-md sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <label className="block flex-1">
                <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">
                  Name Search
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pikachu, Bulba..."
                  className="w-full border border-[#D4AF37]/35 bg-black/45 px-4 py-3 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-11 border border-[#D4AF37]/70 px-4 font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED] transition-colors duration-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Filters
              </button>
            </div>
          </section>

          {/* Stats bar */}
          <section className="mx-auto mb-8 flex w-full max-w-[1180px] flex-col gap-3 border border-[#D4AF37]/40 bg-black/40 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]">
              Total: <span className="text-[#D4AF37]">{data.total_items.toLocaleString()}</span> Pokémon
            </p>
            <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]">
              Page <span className="text-[#D4AF37]">{data.page}</span> of {totalPages}
            </p>
          </section>

          {/* Card grid */}
          <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {renderCards()}
          </section>

          {/* Pagination */}
          <section className="mx-auto mt-12 flex w-full max-w-[1180px] items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1 || isLoading}
              className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
            >
              <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-2">
                arrow_back_ios
              </span>
              Previous Page
            </button>

            <div className="font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED]/80">
              {data.page} / {totalPages}
            </div>

            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages || isLoading}
              className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
            >
              Next Page
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
