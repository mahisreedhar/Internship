import { useEffect, useState } from "react";
import { getThronesCharacters } from "../services/api";

const CARD_SPAN_CLASSES = [
  "row-span-[44]",
  "row-span-[49]",
  "row-span-[53]",
  "row-span-[47]",
  "row-span-[56]",
  "row-span-[51]",
  "row-span-[46]",
  "row-span-[55]",
  "row-span-[50]",
];

function Dashboard() {
  const [characters, setCharacters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
          setError(err?.message || "The ravens failed to deliver character data.");
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_24%_22%,#1f1f1f_0%,#0b0c10_45%),linear-gradient(180deg,#131313_0%,#000000_100%)] px-6 py-10 sm:px-10 lg:px-14">
      <div className="mx-auto w-full max-w-[1600px] rounded-none border border-thrones-gold/40 bg-thrones-surface/85 p-6 sm:p-8 lg:p-12">
        <header className="mb-10 space-y-3">
          <p className="font-body text-xs uppercase tracking-[0.28em] text-thrones-silver/90">
            Westeros Directory
          </p>
          <h1 className="font-headline text-3xl uppercase tracking-widest text-thrones-gold sm:text-4xl lg:text-5xl">
            Directory of Thrones
          </h1>
          <p className="max-w-3xl font-body text-sm leading-relaxed tracking-[0.08em] text-thrones-muted sm:text-base">
            Alliances, bloodlines, and titles arranged in a regal command board inspired by
            Obsidian Throne.
          </p>
        </header>

        {isLoading && (
          <section className="rounded-none border border-thrones-gold/35 bg-black/30 p-8 text-center">
            <p className="font-body text-sm uppercase tracking-[0.22em] text-thrones-silver">
              Summoning the banners of Westeros...
            </p>
          </section>
        )}

        {!isLoading && error && (
          <section className="rounded-none border border-thrones-gold/45 bg-black/30 p-8 text-center">
            <p className="font-body text-sm uppercase tracking-[0.2em] text-thrones-silver">
              {error}
            </p>
          </section>
        )}

        {!isLoading && !error && (
          <section className="grid grid-cols-1 auto-rows-[8px] gap-7 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character, index) => {
              const cardSpanClass = CARD_SPAN_CLASSES[index % CARD_SPAN_CLASSES.length];

              return (
                <article
                  key={character.id || `${character.fullName}-${index}`}
                  className={`group relative overflow-hidden rounded-none border border-thrones-gold/45 ${cardSpanClass}`}
                >
                  <div
                    className="absolute inset-0 bg-center bg-cover"
                    style={{ backgroundImage: `url(${character.imageUrl})`, backgroundSize: "cover" }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,1),rgba(0,0,0,0))]" />

                  <div className="absolute inset-x-0 bottom-0 border-t border-thrones-gold/30 bg-black/40 p-4 backdrop-blur-md sm:p-5">
                    <h2 className="font-headline text-xl uppercase tracking-widest text-thrones-gold sm:text-2xl">
                      {character.fullName || "Unknown Name"}
                    </h2>
                    <p className="mt-2 font-body text-xs uppercase tracking-[0.16em] text-thrones-silver sm:text-sm">
                      {character.title || "No Known Title"}
                    </p>
                    <p className="mt-1 font-body text-xs uppercase tracking-[0.16em] text-thrones-silver/85 sm:text-sm">
                      {character.family || "Unknown Family"}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

export default Dashboard;
