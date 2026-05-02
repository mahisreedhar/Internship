import { useEffect, useState } from "react";

function useFetchData(fetchFunction, page) {
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    const runFetch = async () => {
      setIsLoading(true);
      setError("");

      try {
        const result = await fetchFunction(page);
        if (isActive) {
          setData(result);
        }
      } catch (err) {
        if (isActive) {
          setError(err?.message || "Something went wrong while fetching data.");
          setData([]);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    runFetch();

    return () => {
      isActive = false;
    };
  }, [page]);

  return { data, isLoading, error };
}

export default useFetchData;
