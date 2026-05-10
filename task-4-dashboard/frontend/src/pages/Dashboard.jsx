import { useEffect, useState } from "react";
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
  normal: "#A8A77A",
  fire: "#EE8130",
  water: "#6390F0",
  electric: "#F7D02C",
  grass: "#7AC74C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
};

const TYPE_OPTIONS = Object.keys(TYPE_COLORS);
const SORT_OPTIONS = [
  { value: "dex_id", label: "Dex ID" },
  { value: "name_asc", label: "Name (A-Z)" },
  { value: "name_desc", label: "Name (Z-A)" },
];

function PokeBallPulse() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-24">
      <div className="relative h-16 w-16 animate-spin">
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#111827" strokeWidth="5" />
          <path d="M 10 50 A 40 40 0 0 1 90 50 Z" fill="#FF0000" />
          <path d="M 10 50 A 40 40 0 0 0 90 50 Z" fill="#FFFFFF" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="#111827" strokeWidth="6" />
          <circle cx="50" cy="50" r="10" fill="#FFFFFF" stroke="#111827" strokeWidth="5" />
          <circle cx="50" cy="50" r="4" fill="#111827" />
        </svg>
      </div>
      <p className="mt-6 font-cinzel text-xs uppercase tracking-[0.25em] text-[#3C5AA6]/75">Loading Pokedex...</p>
    </div>
  );
}

function TypeFilterDropdown({ selectedTypes, onToggleType }) {
  return (
    <details className="group relative z-50 w-full">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-lg border border-[#2A75BB]/40 bg-white px-4 font-body-md text-sm text-[#1F2937] shadow-sm marker:content-none focus:outline-none">
        <span>{selectedTypes.length ? `${selectedTypes.length} Type Filter(s)` : "Filter by Type"}</span>
        <span className="text-xs font-semibold text-[#2A75BB] transition-transform group-open:rotate-180">v</span>
      </summary>

      <div className="absolute left-0 top-full z-[90] mt-2 grid max-h-64 w-full grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[#2A75BB]/55 bg-white p-3 shadow-xl sm:grid-cols-3">
        {TYPE_OPTIONS.map((typeName) => {
          const checked = selectedTypes.includes(typeName);
          return (
            <label
              key={typeName}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-transparent px-2 py-1 text-xs uppercase tracking-[0.1em] text-[#1F2937] hover:border-[#2A75BB]/25 hover:bg-[#F3F4F6]"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleType(typeName)}
                className="h-3.5 w-3.5 accent-[#2A75BB]"
              />
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
                style={{ backgroundColor: TYPE_COLORS[typeName] ?? "#3C5AA6" }}
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
  const [sortBy, setSortBy] = useState("dex_id");

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
      sortBy,
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
  }, [currentPage, debouncedSearchTerm, activeGeneration, selectedTypes, sortBy]);

  const totalPages = Math.max(1, Math.ceil(data.total_items / PAGE_SIZE));
  const hasActiveFilters =
    activeGeneration !== 0 ||
    searchTerm.trim().length > 0 ||
    selectedTypes.length > 0 ||
    sortBy !== "dex_id";

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setActiveGeneration(0);
    setSelectedTypes([]);
    setSortBy("dex_id");
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

  const onSortByChange = (event) => {
    setSortBy(event.target.value);
    setCurrentPage(1);
  };

  const renderCards = () => {
    if (isLoading) return <PokeBallPulse />;

    if (error) {
      return (
        <div className="col-span-full rounded-xl border border-[#FF0000]/45 bg-[#FFF1F2] p-12 text-center">
          <p className="font-body-md text-sm uppercase tracking-[0.2em] text-[#991B1B]">{error}</p>
        </div>
      );
    }

    if (!data.items.length) {
      return (
        <div className="col-span-full rounded-xl border border-[#2A75BB]/35 bg-white p-12 text-center shadow-sm">
          <p className="font-body-md text-sm uppercase tracking-[0.12em] text-[#3C5AA6]">No Pokemon match your filter set.</p>
        </div>
      );
    }

    return data.items.map((pokemon, index) => (
      <article
        key={pokemon.id}
        style={{ animationDelay: `${index * 55}ms` }}
        className="stagger-card group relative flex min-h-[540px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md transition-all duration-400 hover:-translate-y-1 hover:border-[#2A75BB]/40 hover:shadow-lg"
      >
        <div className="flex h-[340px] items-end justify-center p-6 pb-2">
          {pokemon.image ? (
            <img
              src={pokemon.image}
              alt={pokemon.name}
              className="h-full w-full object-contain object-bottom transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : null}
        </div>

        <div className="mt-auto rounded-t-2xl border-t border-slate-200 bg-white p-5">
          <p className="mb-2 font-body-md text-base font-semibold tracking-[0.06em] text-[#3C5AA6]">
            #{String(pokemon.id).padStart(4, "0")}
          </p>
          <h3 className="mb-3 font-cinzel text-3xl font-black leading-none tracking-[0.02em] text-[#3C5AA6]">
            {pokemon.name}
          </h3>
          <p className="mb-3 font-body-md text-xs uppercase tracking-[0.14em] text-[#64748B]">
            {pokemon.generation?.label ?? "Generation Unknown"}
          </p>

          <div className="mb-3 flex flex-wrap gap-2">
            {pokemon.types.map((typeName) => (
              <span
                key={typeName}
                style={{ backgroundColor: TYPE_COLORS[typeName] ?? "#2A75BB" }}
                className="rounded-md px-3 py-1 font-body-md text-xs font-semibold uppercase tracking-[0.08em] text-white"
              >
                {typeName}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 font-body-md text-xs uppercase tracking-[0.1em] text-[#334155]">
            <p>Weight: {(pokemon.weight / 10).toFixed(1)} kg</p>
            <p>Height: {(pokemon.height / 10).toFixed(1)} m</p>
          </div>
        </div>
      </article>
    ));
  };

  return (
    <div className="relative min-h-screen bg-[#F3F4F6] text-[#1F2937] font-body-md text-body-md">
      <header className="fixed left-1/2 top-0 z-50 flex h-24 w-full max-w-[1600px] -translate-x-1/2 items-center justify-between border-b border-[#FFCB05]/80 bg-[#3C5AA6] px-6 shadow-md md:px-10 xl:px-14">
        <h1 className="font-cinzel text-base font-black uppercase tracking-[0.18em] text-[#FFCB05] sm:text-xl xl:text-2xl">
          Pokedex Dashboard
        </h1>
        {data.total_items > 0 && (
          <p className="hidden font-body-md text-[11px] uppercase tracking-[0.18em] text-[#FFCB05]/90 sm:block">
            {data.total_items.toLocaleString()} results
          </p>
        )}
      </header>

      <main className="smoke-bg mx-auto w-full max-w-[1600px] px-4 pb-24 pt-28 sm:px-8 md:px-12 xl:px-14">
        <section className="relative z-40 mx-auto mb-8 flex w-full max-w-[1480px] flex-col gap-5 rounded-xl border border-[#2A75BB]/30 bg-white p-5 shadow-md sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
            <label className="block lg:col-span-2">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.18em] text-[#3C5AA6]">Name Search</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Pikachu, Bulba..."
                className="h-11 w-full rounded-lg border border-[#2A75BB]/40 bg-white px-4 font-body-md text-sm text-[#1F2937] placeholder:text-slate-400 shadow-sm focus:border-[#2A75BB] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.18em] text-[#3C5AA6]">Generation</span>
              <select
                value={activeGeneration}
                onChange={onGenerationChange}
                className="h-11 w-full rounded-lg border border-[#2A75BB]/40 bg-white px-4 font-body-md text-sm text-[#1F2937] shadow-sm focus:border-[#2A75BB] focus:outline-none"
              >
                {GENERATION_PRESETS.map((gen) => (
                  <option key={gen.id} value={gen.id}>
                    {gen.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.18em] text-[#3C5AA6]">Sort By</span>
              <select
                value={sortBy}
                onChange={onSortByChange}
                className="h-11 w-full rounded-lg border border-[#2A75BB]/40 bg-white px-4 font-body-md text-sm text-[#1F2937] shadow-sm focus:border-[#2A75BB] focus:outline-none"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.18em] text-[#3C5AA6]">Type</span>
              <TypeFilterDropdown selectedTypes={selectedTypes} onToggleType={onToggleType} />
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-56">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="h-11 w-full rounded-lg border border-[#FF0000] bg-[#FF0000] px-4 font-body-md text-xs uppercase tracking-[0.16em] text-white transition-colors duration-300 hover:bg-[#C70000] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </section>

        <section className="relative z-20 mx-auto mb-8 flex w-full max-w-[1480px] flex-col gap-3 rounded-xl border border-[#2A75BB]/25 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-md text-xs uppercase tracking-[0.16em] text-[#334155]">
            Total: <span className="text-[#3C5AA6] font-semibold">{data.total_items.toLocaleString()}</span> Pokemon
          </p>
          <p className="font-body-md text-xs uppercase tracking-[0.16em] text-[#334155]">
            Page <span className="text-[#3C5AA6] font-semibold">{data.page}</span> of {totalPages}
          </p>
        </section>

        <section className="relative z-10 mx-auto grid w-full max-w-[1480px] grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {renderCards()}
        </section>

        <section className="mx-auto mt-12 flex w-full max-w-[1480px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1 || isLoading}
            className="group flex items-center gap-3 rounded-lg border border-[#FFCB05] bg-[#FFCB05] px-5 py-3 font-body-md text-label-caps text-[#3C5AA6] transition-all duration-300 hover:bg-[#F2B800] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
          >
            <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-1">arrow_back_ios</span>
            Previous Page
          </button>

          <div className="font-body-md text-xs uppercase tracking-[0.16em] text-[#3C5AA6]">
            {data.page} / {totalPages}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages || isLoading}
            className="group flex items-center gap-3 rounded-lg border border-[#FFCB05] bg-[#FFCB05] px-5 py-3 font-body-md text-label-caps text-[#3C5AA6] transition-all duration-300 hover:bg-[#F2B800] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
          >
            Next Page
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-1">arrow_forward_ios</span>
          </button>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
