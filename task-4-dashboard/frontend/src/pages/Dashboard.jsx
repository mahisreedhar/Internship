import { useEffect, useMemo, useState } from "react";
import { getWesterosCharacters } from "../services/api";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 320;
const INITIAL_TEXT_FILTERS = {
  name: "",
  culture: "",
  aliases: "",
  born: "",
  died: "",
};

const GENDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "alive", label: "Alive" },
  { value: "deceased", label: "Deceased" },
];

function firstNonEmpty(list) {
  if (!Array.isArray(list)) {
    return "";
  }

  for (const item of list) {
    if (typeof item === "string" && item.trim()) {
      return item.trim();
    }
  }

  return "";
}

function getPrimaryName(character = {}) {
  const rawName = typeof character.name === "string" ? character.name.trim() : "";
  if (rawName) {
    return rawName;
  }

  const aliasName = firstNonEmpty(character.aliases);
  return aliasName || "Unknown Soul";
}

function getInitials(name = "") {
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return "??";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  return `${words[0][0] || ""}${words[1][0] || ""}`.toUpperCase();
}

function getPrimaryTitle(character = {}) {
  const title = firstNonEmpty(character.titles);
  return title || "No sworn title recorded.";
}

function getActorName(character = {}) {
  const actor = firstNonEmpty(character.playedBy);
  return actor || "Unknown";
}

function RavenPulse() {
  return (
    <div className="col-span-full border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
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

function FilterOptionButton({ isActive, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        isActive
          ? "border border-[#D4AF37] bg-[#D4AF37]/12 px-3 py-2 font-body-md text-xs uppercase tracking-[0.18em] text-[#D4AF37]"
          : "border border-[#D4AF37]/35 bg-black/35 px-3 py-2 font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA] transition-colors duration-300 hover:text-[#D4AF37]"
      }
    >
      {label}
    </button>
  );
}

function Dashboard() {
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [fatalError, setFatalError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [textFilters, setTextFilters] = useState(INITIAL_TEXT_FILTERS);
  const [debouncedTextFilters, setDebouncedTextFilters] = useState(INITIAL_TEXT_FILTERS);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalFilteredItems: 0,
    totalPages: 1,
    hasNext: false,
    hasPrevious: false,
  });

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => document.documentElement.classList.remove("dark");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedTextFilters(textFilters);
      setCurrentPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [textFilters]);

  useEffect(() => {
    let isActive = true;

    const loadCharacters = async () => {
      setIsLoading(true);
      setError("");
      setFatalError(null);

      try {
        const result = await getWesterosCharacters({
          page: currentPage,
          pageSize: PAGE_SIZE,
          name: debouncedTextFilters.name,
          gender: genderFilter,
          culture: debouncedTextFilters.culture,
          aliases: debouncedTextFilters.aliases,
          born: debouncedTextFilters.born,
          died: debouncedTextFilters.died,
          status: statusFilter,
        });

        if (!isActive) {
          return;
        }

        setCharacters(result.items);
        setPagination({
          page: result.page,
          pageSize: result.pageSize,
          totalItems: result.totalItems,
          totalFilteredItems: result.totalFilteredItems,
          totalPages: result.totalPages,
          hasNext: result.hasNext,
          hasPrevious: result.hasPrevious,
        });

        if (result.page !== currentPage) {
          setCurrentPage(result.page);
        }
      } catch (err) {
        if (!isActive) {
          return;
        }

        const message = err?.message || "The Ravens are tired. GoT API is down or rate-limited.";
        setError(message);
        setCharacters([]);
        setPagination((previous) => ({
          ...previous,
          totalFilteredItems: 0,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        }));

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
  }, [currentPage, debouncedTextFilters, genderFilter, statusFilter]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        genderFilter !== "all" ||
          statusFilter !== "all" ||
          textFilters.name ||
          textFilters.culture ||
          textFilters.aliases ||
          textFilters.born ||
          textFilters.died,
      ),
    [genderFilter, statusFilter, textFilters],
  );

  if (fatalError) {
    throw fatalError;
  }

  const updateTextFilter = (field, value) => {
    setTextFilters((previous) => ({ ...previous, [field]: value }));
  };

  const clearFilters = () => {
    setGenderFilter("all");
    setStatusFilter("all");
    setTextFilters(INITIAL_TEXT_FILTERS);
    setDebouncedTextFilters(INITIAL_TEXT_FILTERS);
    setCurrentPage(1);
  };

  const renderCards = () => {
    if (isLoading) {
      return <RavenPulse />;
    }

    if (error) {
      return (
        <div className="col-span-full border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.2em] text-[#E0E6ED]">{error}</p>
        </div>
      );
    }

    if (!characters.length) {
      return (
        <div className="col-span-full border border-[#D4AF37]/60 bg-black/50 p-12 text-center backdrop-blur-md">
          <p className="font-body-md text-body-md uppercase tracking-[0.12em] text-[#E0E6ED]">
            This soul is not recorded in the Citadel&apos;s scrolls.
          </p>
        </div>
      );
    }

    return characters.map((character, index) => {
      const primaryName = getPrimaryName(character);
      const initials = getInitials(primaryName);
      const culture = typeof character.culture === "string" && character.culture.trim() ? character.culture : "Unknown";
      const gender = typeof character.gender === "string" && character.gender.trim() ? character.gender : "Unknown";
      const aliases = Array.isArray(character.aliases)
        ? character.aliases.filter((alias) => typeof alias === "string" && alias.trim())
        : [];
      const born = typeof character.born === "string" && character.born.trim() ? character.born : "Not recorded";
      const died = typeof character.died === "string" && character.died.trim() ? character.died : "Alive";

      return (
        <article
          key={character.url || `${primaryName}-${index}`}
          className="flex min-h-[430px] flex-col border border-[#D4AF37] bg-black/50 p-5 backdrop-blur-md transition-all duration-400 hover:shadow-[0_0_16px_rgba(212,175,55,0.2)]"
        >
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="border border-[#DDE3EA]/45 bg-[#DDE3EA]/10 px-2 py-1 font-body-md text-[10px] uppercase tracking-[0.12em] text-[#DDE3EA]">
              {culture}
            </span>
            <span className="border border-[#DDE3EA]/45 bg-[#DDE3EA]/10 px-2 py-1 font-body-md text-[10px] uppercase tracking-[0.12em] text-[#DDE3EA]">
              {gender}
            </span>
          </div>

          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#D4AF37] bg-black/70">
            <span className="font-cinzel text-2xl font-bold uppercase tracking-[0.1em] text-[#D4AF37]">{initials}</span>
          </div>

          <h3 className="mb-2 text-center font-cinzel text-lg font-bold uppercase tracking-[0.12em] text-[#D4AF37]">
            {primaryName}
          </h3>

          <p className="mb-4 border-l-2 border-[#D4AF37]/70 pl-3 font-cinzel text-sm italic text-[#DDE3EA]">
            {getPrimaryTitle(character)}
          </p>

          <div className="space-y-2 font-body-md text-sm text-[#E0E6ED]">
            <p>
              <span className="text-[#D4AF37]">Aliases:</span>{" "}
              {aliases.length ? aliases.slice(0, 3).join(", ") : "None recorded"}
            </p>
            <p>
              <span className="text-[#D4AF37]">Born:</span> {born}
            </p>
            <p>
              <span className="text-[#D4AF37]">Died:</span> {died}
            </p>
          </div>

          <p className="mt-auto pt-6 font-body-md text-xs uppercase tracking-[0.12em] text-[#DDE3EA]/65">
            Actor: {getActorName(character)}
          </p>
        </article>
      );
    });
  };

  return (
    <div className="relative min-h-screen bg-[#0B0C10] text-[#E0E6ED] font-body-md text-body-md">
      <header className="fixed left-1/2 top-0 z-50 flex h-24 w-full max-w-[1440px] -translate-x-1/2 items-center justify-between border-b border-[#D4AF37]/35 bg-black/80 px-6 shadow-[0_4px_30px_rgba(0,0,0,0.9)] backdrop-blur-xl md:px-10 xl:px-14">
        <h1 className="font-cinzel text-base font-bold uppercase tracking-[0.25em] text-[#D4AF37] sm:text-xl xl:text-2xl">
          Westeros Character Directory
        </h1>
      </header>

      <main className="smoke-bg mx-auto w-full max-w-[1440px] px-4 pb-24 pt-28 sm:px-8 md:px-12 xl:px-16 2xl:px-24">
        <section className="mx-auto mb-8 flex w-full max-w-[1180px] flex-col gap-6 border border-[#D4AF37]/60 bg-black/50 p-5 backdrop-blur-md sm:p-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Name</span>
              <input
                type="text"
                value={textFilters.name}
                onChange={(event) => updateTextFilter("name", event.target.value)}
                placeholder="Jon Snow, Arya..."
                className="w-full border border-[#D4AF37]/35 bg-black/45 px-4 py-3 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Culture</span>
              <input
                type="text"
                value={textFilters.culture}
                onChange={(event) => updateTextFilter("culture", event.target.value)}
                placeholder="Northmen, Valyrian..."
                className="w-full border border-[#D4AF37]/35 bg-black/45 px-4 py-3 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Aliases</span>
              <input
                type="text"
                value={textFilters.aliases}
                onChange={(event) => updateTextFilter("aliases", event.target.value)}
                placeholder="Kingslayer, Lord Snow..."
                className="w-full border border-[#D4AF37]/35 bg-black/45 px-4 py-3 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Born</span>
              <input
                type="text"
                value={textFilters.born}
                onChange={(event) => updateTextFilter("born", event.target.value)}
                placeholder="In 283 AC..."
                className="w-full border border-[#D4AF37]/35 bg-black/45 px-4 py-3 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Died</span>
              <input
                type="text"
                value={textFilters.died}
                onChange={(event) => updateTextFilter("died", event.target.value)}
                placeholder="In 300 AC..."
                className="w-full border border-[#D4AF37]/35 bg-black/45 px-4 py-3 font-body-md text-sm text-[#E0E6ED] placeholder:text-[#E0E6ED]/55 focus:border-[#D4AF37] focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <p className="mb-2 font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Gender</p>
              <div className="flex flex-wrap gap-2">
                {GENDER_OPTIONS.map((option) => (
                  <FilterOptionButton
                    key={option.value}
                    label={option.label}
                    isActive={genderFilter === option.value}
                    onClick={() => {
                      setGenderFilter(option.value);
                      setCurrentPage(1);
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => (
                  <FilterOptionButton
                    key={option.value}
                    label={option.label}
                    isActive={statusFilter === option.value}
                    onClick={() => {
                      setStatusFilter(option.value);
                      setCurrentPage(1);
                    }}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="h-11 self-end border border-[#D4AF37]/70 px-4 font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED] transition-colors duration-300 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear Filters
            </button>
          </div>
        </section>

        <section className="mx-auto mb-8 flex w-full max-w-[1180px] flex-col gap-3 border border-[#D4AF37]/40 bg-black/40 p-4 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]">
            Results: <span className="text-[#D4AF37]">{pagination.totalFilteredItems}</span> of {pagination.totalItems}
          </p>
          <p className="font-body-md text-xs uppercase tracking-[0.18em] text-[#DDE3EA]">
            Page <span className="text-[#D4AF37]">{pagination.page}</span> of {pagination.totalPages} showing {characters.length} of{" "}
            {pagination.totalFilteredItems}
          </p>
        </section>

        <section className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-7 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {renderCards()}
        </section>

        <section className="mx-auto mt-12 flex w-full max-w-[1180px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setCurrentPage((previous) => Math.max(1, previous - 1))}
            disabled={!pagination.hasPrevious || isLoading}
            className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
          >
            <span className="material-symbols-outlined text-sm transition-transform group-hover:-translate-x-2">
              arrow_back_ios
            </span>
            Previous Realm
          </button>

          <div className="font-body-md text-xs uppercase tracking-[0.18em] text-[#E0E6ED]/80">
            {pagination.page} / {pagination.totalPages}
          </div>

          <button
            type="button"
            onClick={() => pagination.hasNext && setCurrentPage((previous) => previous + 1)}
            disabled={!pagination.hasNext || isLoading}
            className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
          >
            Next Realm
            <span className="material-symbols-outlined text-sm transition-transform group-hover:translate-x-2">
              arrow_forward_ios
            </span>
          </button>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
