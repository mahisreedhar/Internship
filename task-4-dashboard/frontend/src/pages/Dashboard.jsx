import { useEffect, useMemo, useState } from "react";
import { fetchPokemon } from "../services/api";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 320;

const GENERATION_PRESETS = [
  { id: 0, label: "All Generations" },
  { id: 1, label: "Generation I - Kanto" },
  { id: 2, label: "Generation II - Johto" },
  { id: 3, label: "Generation III - Hoenn" },
  { id: 4, label: "Generation IV - Sinnoh" },
  { id: 5, label: "Generation V - Unova" },
  { id: 6, label: "Generation VI - Kalos" },
  { id: 7, label: "Generation VII - Alola" },
  { id: 8, label: "Generation VIII - Galar" },
  { id: 9, label: "Generation IX - Paldea" },
];

const TYPE_COLORS = {
  normal: "#7a7a6a",
  fire: "#b34200",
  water: "#1a56b0",
  electric: "#b08a00",
  grass: "#2a6b24",
  ice: "#00727a",
  fighting: "#8a1e1a",
  poison: "#561880",
  ground: "#6e5b0e",
  flying: "#362090",
  psychic: "#9c1e42",
  bug: "#455e14",
  rock: "#6a5620",
  ghost: "#38206e",
  dragon: "#101e88",
  dark: "#2e343a",
  steel: "#445560",
  fairy: "#961858",
};

const TYPE_OPTIONS = Object.keys(TYPE_COLORS);

function PokeBallPulse() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24">
      <div className="relative h-16 w-16 animate-spin">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#0B0C10" strokeWidth="5" />
          <path d="M 10 50 A 40 40 0 0 1 90 50 Z" fill="#dc2626" />
          <path d="M 10 50 A 40 40 0 0 0 90 50 Z" fill="#f8fafc" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#0B0C10" strokeWidth="6" />
          <circle cx="50" cy="50" r="10" fill="#f8fafc" stroke="#0B0C10" strokeWidth="5" />
          <circle cx="50" cy="50" r="4" fill="#0B0C10" />
        </svg>
      </div>
      <p className="mt-6 font-cinzel text-xs uppercase tracking-[0.25em] text-[#E0E6ED]/70">Loading Pokedex...</p>
    </div>
  );
}

function TypeFilterDropdown({ selectedTypes, onToggleType }) {
  return (
    <details className="group relative w-full sm:max-w-[320px]">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between border border-[#D4AF37]/35 bg-black/45 px-4 font-body-md text-sm text-[#E0E6ED] marker:content-none">
        <span>{selectedTypes.length ? `${selectedTypes.length} Type Filter(s)` : "Filter by Type"}</span>
        <span className="text-xs text-[#D4AF37] transition-transform group-open:rotate-180">v</span>
      </summary>

      <div className="absolute z-40 mt-2 grid max-h-64 w-full grid-cols-2 gap-2 overflow-y-auto border border-[#D4AF37]/45 bg-[#0F1117] p-3 shadow-[0_14px_30px_rgba(0,0,0,0.45)] sm:grid-cols-3">
        {TYPE_OPTIONS.map((typeName) => {
          const checked = selectedTypes.includes(typeName);
          return (
            <label
              key={typeName}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs uppercase tracking-[0.1em] text-[#DDE3EA] hover:border-[#D4AF37]/25 hover:bg-white/5"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleType(typeName)}
                className="h-3.5 w-3.5 accent-[#D4AF37]"
              />
              <span
                className="rounded px-1.5 py-0.5 text-[10px]"
                style={{ backgroundColor: TYPE_COLORS[typeName], color: "#F9FAFB" }}
              >
                {typeName}
              </span>
            </label>
          );
        })}
      </div>
    </details>
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
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [minId, setMinId] = useState("");
  const [maxId, setMaxId] = useState("");

  const parsedMinId = useMemo(() => {
    const value = Number(minId);
    return Number.isFinite(value) && value >= 1 ? value : undefined;
  }, [minId]);

  const parsedMaxId = useMemo(() => {
    const value = Number(maxId);
    return Number.isFinite(value) && value >= 1 ? value : undefined;
  }, [maxId]);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  // Debounce search - resets page to 1
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  // Main fetch effect - triggers on page + filters.
  useEffect(() => {
    let isActive = true;
    setIsLoading(true);
    setError("");

    fetchPokemon({
      page: currentPage,
      pageSize: PAGE_SIZE,
      search: debouncedSearchTerm,
      generation: activeGeneration,
      types: selectedTypes,
      minId: parsedMinId,
      maxId: parsedMaxId,
    })
      .then((result) => {
        if (isActive) setData(result);
      })
      .catch((err) => {
        if (isActive) {
          setError(err.message || "Failed to load Pokemon data.");
          setData({ items: [], total_items: 0, page: currentPage, page_size: PAGE_SIZE });
        }
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [currentPage, debouncedSearchTerm, activeGeneration, selectedTypes, parsedMinId, parsedMaxId]);

  const totalPages = Math.max(1, Math.ceil(data.total_items / PAGE_SIZE));
  const hasActiveFilters =
    activeGeneration !== 0 ||
    searchTerm.trim().length > 0 ||
    selectedTypes.length > 0 ||
    minId.trim().length > 0 ||
    maxId.trim().length > 0;

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setActiveGeneration(0);
    setSelectedTypes([]);
    setMinId("");
    setMaxId("");
    setCurrentPage(1);
  };

  const onToggleType = (typeName) => {
    setSelectedTypes((prev) => {
      if (prev.includes(typeName)) {
        return prev.filter((item) => item !== typeName);
      }
      return [...prev, typeName].sort();
    });
    setCurrentPage(1);
  };

  const onGenerationChange = (event) => {
    setActiveGeneration(Number(event.target.value));
    setCurrentPage(1);
  };

  const onMinIdChange = (event) => {
    setMinId(event.target.value);
    setCurrentPage(1);
  };

  const onMaxIdChange = (event) => {
    setMaxId(event.target.value);
    setCurrentPage(1);
  };

  const renderCards = () => {
    if (isLoading) return <PokeBallPulse />;

    if (error) {
      return (
        <div className="col-span-full rounded-xl border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-sm uppercase tracking-[0.2em] text-[#E0E6ED]">{error}</p>
        </div>
      );
    }

    if (!data.items.length) {
      return (
        <div className="col-span-full rounded-xl border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-sm uppercase tracking-[0.12em] text-[#E0E6ED]">No Pokemon match your filter set.</p>
        </div>
      );
    }

    return data.items.map((pokemon, index) => (
      <article
        key={pokemon.id}
        style={{ animationDelay: `${index * 55}ms` }}
        className="stagger-card group relative flex min-h-[410px] flex-col overflow-hidden rounded-xl border border-[#1e2030] bg-[#101216] transition-all duration-400 hover:-translate-y-1 hover:border-[#D4AF37]/60 hover:shadow-[0_14px_30px_rgba(0,0,0,0.45)]"
      >
        <div className="absolute inset-0">
          <div className="absolute inset-0 flex items-center justify-center p-6">
            {pokemon.image ? (
              <img
                src={pokemon.image}
                alt={pokemon.name}
                className="h-full w-full object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            ) : null}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0C10] via-[#0B0C10]/45 to-[#0B0C10]/5" />
        </div>

        <div className="relative z-10 mt-auto p-5">
          <p className="mb-2 font-body-md text-base font-semibold tracking-[0.06em] text-[#D5D7DC]">
            #{String(pokemon.id).padStart(4, "0")}
          </p>
          <h3 className="mb-3 font-cinzel text-3xl font-bold leading-none tracking-[0.04em] text-[#F4F5F7]">
            {pokemon.name}
          </h3>

          <div className="mb-3 flex flex-wrap gap-2">
            {pokemon.types.map((typeName) => (
              <span
                key={typeName}
                style={{ backgroundColor: TYPE_COLORS[typeName] ?? "#555" }}
                className="rounded-md px-3 py-1 font-body-md text-xs font-semibold uppercase tracking-[0.08em] text-white"
              >
                {typeName}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3 font-body-md text-xs uppercase tracking-[0.1em] text-[#DDE3EA]/80">
            <p>Weight: {(pokemon.weight / 10).toFixed(1)} kg</p>
            <p>Height: {(pokemon.height / 10).toFixed(1)} m</p>
          </div>
        </div>
      </article>
    ));
  };

  return (
    <div className="relative min-h-screen bg-[#0B0C10] text-[#E0E6ED] font-body-md text-body-md">
      <header className="fixed left-1/2 top-0 z-50 flex h-24 w-full max-w-[1600px] -translate-x-1/2 items-center justify-between border-b border-[#D4AF37]/35 bg-black/80 px-6 shadow-[0_4px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl md:px-10 xl:px-14">
        <h1 className="font-cinzel text-base font-bold uppercase tracking-[0.25em] text-[#D4AF37] sm:text-xl xl:text-2xl">
          Pokedex Dashboard
        </h1>
        {data.total_items > 0 && (
          <p className="hidden font-body-md text-[11px] uppercase tracking-[0.2em] text-[#DDE3EA]/50 sm:block">
            {data.total_items.toLocaleString()} results
          </p>
        )}
      </header>

      <main className="smoke-bg mx-auto w-full max-w-[1600px] px-4 pb-24 pt-28 sm:px-8 md:px-12 xl:px-14">
        <section className="mx-auto mb-8 flex w-full max-w-[1480px] flex-col gap-5 rounded-xl border border-[#D4AF37]/60 bg-black/50 p-5 backdrop-blur-md sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <label className="block lg:col-span-2">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Name Search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pikachu, Bulba..."
                className="h-11 w-full border border-[#D4AF37]/35 bg-black/45 px-4 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Generation</span>
              <select
                value={activeGeneration}
                onChange={onGenerationChange}
                className="h-11 w-full border border-[#D4AF37]/35 bg-black/45 px-4 font-body-md text-sm text-[#E0E6ED] focus:border-[#D4AF37] focus:outline-none"
              >
                {GENERATION_PRESETS.map((gen) => (
                  <option key={gen.id} value={gen.id}>
                    {gen.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Type</span>
              <TypeFilterDropdown selectedTypes={selectedTypes} onToggleType={onToggleType} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-2 block font-cinzel text-[10px] uppercase tracking-[0.2em] text-[#D4AF37]">Dex ID Min</span>
              <input
                type="number"
                min="1"
                max="1025"
                value={minId}
                onChange={onMinIdChange}
                placeholder="1"
                className="h-11 w-full border border-[#D4AF37]/35 bg-black/45 px-4 font-body-md text-sm text-[#E0E6ED] focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-[10px] uppercase tracking-[0.2em] text-[#D4AF37]">Dex ID Max</span>
              <input
                type="number"
                min="1"
                max="1025"
                value={maxId}
                onChange={onMaxIdChange}
                placeholder="1025"
                className="h-11 w-full border border-[#D4AF37]/35 bg-black/45 px-4 font-body-md text-sm text-[#E0E6ED] focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-11 w-full border border-[#D4AF37]/70 px-4 font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED] transition-colors duration-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto mb-8 flex w-full max-w-[1480px] flex-col gap-3 rounded-xl border border-[#D4AF37]/40 bg-black/40 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]">
            Total: <span className="text-[#D4AF37]">{data.total_items.toLocaleString()}</span> Pokemon
          </p>
          <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]">
            Page <span className="text-[#D4AF37]">{data.page}</span> of {totalPages}
          </p>
        </section>

        <section className="mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {renderCards()}
        </section>

        <section className="mx-auto mt-12 flex w-full max-w-[1480px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
          >
            <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-2">arrow_back_ios</span>
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
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-2">arrow_forward_ios</span>
          </button>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
