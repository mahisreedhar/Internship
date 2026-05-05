import { useEffect, useMemo, useRef, useState } from "react";
import { getWesterosCharacters } from "../services/api";

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 320;
const INITIAL_TEXT_FILTERS = {
  name: "",
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

const CULTURE_OPTIONS = [
  "Northmen",
  "Ironborn",
  "Valyrian",
  "Braavosi",
  "Dornish",
  "Ghiscari",
  "Dothraki",
  "Free Folk",
  "Andal",
  "First Men",
  "Riverlands",
  "Westerlands",
];

const REGION_PRESETS = [
  { id: "all", label: "All Realms", cultures: [] },
  { id: "north", label: "The North", cultures: ["Northmen"] },
  { id: "iron-islands", label: "The Iron Islands", cultures: ["Ironborn"] },
  { id: "dorne", label: "Dorne", cultures: ["Dornish"] },
  { id: "westerlands", label: "The Westerlands", cultures: ["Westerlands", "Andal"] },
  { id: "essos", label: "Free Cities & Essos", cultures: ["Braavosi", "Valyrian", "Ghiscari", "Dothraki"] },
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

function matchesPreset(selectedCultures, presetCultures) {
  if (selectedCultures.length !== presetCultures.length) {
    return false;
  }

  const selected = new Set(selectedCultures.map((value) => value.toLowerCase()));
  return presetCultures.every((value) => selected.has(value.toLowerCase()));
}

function findRegionForCultures(selectedCultures) {
  for (const preset of REGION_PRESETS) {
    if (matchesPreset(selectedCultures, preset.cultures)) {
      return preset.id;
    }
  }

  return "custom";
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
  const [selectedCultures, setSelectedCultures] = useState([]);
  const [isCultureMenuOpen, setIsCultureMenuOpen] = useState(false);
  const [activeRegion, setActiveRegion] = useState("all");
  const cultureMenuRef = useRef(null);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentPage]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (cultureMenuRef.current && !cultureMenuRef.current.contains(event.target)) {
        setIsCultureMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
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
          cultures: selectedCultures,
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
  }, [currentPage, debouncedTextFilters, genderFilter, selectedCultures, statusFilter]);

  useEffect(() => {
    setActiveRegion(findRegionForCultures(selectedCultures));
  }, [selectedCultures]);

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        genderFilter !== "all" ||
          statusFilter !== "all" ||
          selectedCultures.length ||
          textFilters.name ||
          textFilters.born ||
          textFilters.died,
      ),
    [genderFilter, selectedCultures, statusFilter, textFilters],
  );

  if (fatalError) {
    throw fatalError;
  }

  const updateTextFilter = (field, value) => {
    setTextFilters((previous) => ({ ...previous, [field]: value }));
  };

  const onRegionSelect = (region) => {
    setActiveRegion(region.id);
    setSelectedCultures(region.cultures);
    setCurrentPage(1);
  };

  const onCultureToggle = (culture) => {
    setSelectedCultures((previous) => {
      const exists = previous.some((value) => value.toLowerCase() === culture.toLowerCase());
      if (exists) {
        return previous.filter((value) => value.toLowerCase() !== culture.toLowerCase());
      }

      return [...previous, culture];
    });
    setCurrentPage(1);
  };

  const clearCultureFilters = () => {
    setSelectedCultures([]);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setGenderFilter("all");
    setStatusFilter("all");
    setTextFilters(INITIAL_TEXT_FILTERS);
    setDebouncedTextFilters(INITIAL_TEXT_FILTERS);
    setSelectedCultures([]);
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
      const born = typeof character.born === "string" && character.born.trim() ? character.born : "Not recorded";
      const died = typeof character.died === "string" && character.died.trim() ? character.died : "Alive";

      return (
        <article
          key={character.url || `${primaryName}-${index}`}
          style={{ animationDelay: `${index * 55}ms` }}
          className="stagger-card group flex min-h-[430px] cursor-pointer flex-col border border-[#D4AF37] bg-black/50 p-5 backdrop-blur-md transition-all duration-400 hover:bg-[#101216]/65 hover:shadow-[0_0_15px_rgba(212,175,55,0.4)]"
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

      <div className="mx-auto flex w-full max-w-[1440px] pt-24">
        <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] w-64 flex-col border-r border-[#D4AF37]/25 bg-black/85 backdrop-blur-2xl lg:flex">
          <div className="border-b border-[#D4AF37]/20 p-6">
            <p className="font-cinzel text-sm uppercase tracking-[0.2em] text-[#D4AF37]">Seven Kingdoms</p>
            <p className="mt-2 font-body-md text-[10px] uppercase tracking-[0.2em] text-[#DDE3EA]/70">Region Navigator</p>
          </div>
          <nav className="py-4">
            {REGION_PRESETS.map((region) => {
              const isActive = activeRegion === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => onRegionSelect(region)}
                  className={
                    isActive
                      ? "relative flex w-full items-center bg-[#D4AF37]/10 px-5 py-3 text-left font-body-md text-xs uppercase tracking-[0.2em] text-[#D4AF37]"
                      : "relative flex w-full items-center px-5 py-3 text-left font-body-md text-xs uppercase tracking-[0.2em] text-[#DDE3EA]/80 transition-colors hover:bg-white/5 hover:text-[#D4AF37]"
                  }
                >
                  {isActive ? <span className="absolute left-0 top-0 h-full w-[3px] bg-[#D4AF37]" aria-hidden="true" /> : null}
                  <span className="pl-2">{region.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="smoke-bg w-full flex-1 px-4 pb-24 pt-6 sm:px-8 md:px-12 xl:px-16 2xl:px-24">
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

              <div className="relative" ref={cultureMenuRef}>
                <span className="mb-2 block font-cinzel text-xs uppercase tracking-[0.22em] text-[#D4AF37]">Culture</span>
                <button
                  type="button"
                  onClick={() => setIsCultureMenuOpen((previous) => !previous)}
                  className="flex w-full items-center justify-between border border-[#D4AF37]/70 bg-black/55 px-4 py-3 font-body-md text-sm text-[#E0E6ED]"
                >
                  <span>
                    Culture {selectedCultures.length ? `- Selected (${selectedCultures.length})` : "- All"}
                  </span>
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    {isCultureMenuOpen ? "expand_less" : "expand_more"}
                  </span>
                </button>

                {isCultureMenuOpen ? (
                  <div className="absolute z-20 mt-2 w-full border border-[#D4AF37]/70 bg-[#0B0C10] shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center justify-between border-b border-[#D4AF37]/30 px-3 py-2">
                      <p className="font-cinzel text-[11px] uppercase tracking-[0.2em] text-[#D4AF37]">Major Cultures</p>
                      <button
                        type="button"
                        onClick={clearCultureFilters}
                        className="font-body-md text-[10px] uppercase tracking-[0.16em] text-[#DDE3EA] hover:text-[#D4AF37]"
                      >
                        Clear All
                      </button>
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1">
                      {CULTURE_OPTIONS.map((cultureOption) => {
                        const isSelected = selectedCultures.some(
                          (value) => value.toLowerCase() === cultureOption.toLowerCase(),
                        );
                        return (
                          <li key={cultureOption}>
                            <label
                              className={
                                isSelected
                                  ? "flex cursor-pointer items-center gap-2 bg-[#D4AF37]/12 px-3 py-2 font-body-md text-xs text-[#D4AF37]"
                                  : "flex cursor-pointer items-center gap-2 px-3 py-2 font-body-md text-xs text-[#DDE3EA] hover:bg-white/5"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onCultureToggle(cultureOption)}
                                className="h-3.5 w-3.5 accent-[#D4AF37]"
                              />
                              <span>{cultureOption}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
              Page <span className="text-[#D4AF37]">{pagination.page}</span> of {pagination.totalPages} showing {characters.length} of {" "}
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
              className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
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
              className="group flex items-center gap-3 border border-[#D4AF37] px-5 py-3 font-body-md text-label-caps text-[#E0E6ED] transition-all duration-400 hover:bg-[#D4AF37]/10 hover:text-[#D4AF37] active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 sm:px-8"
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

