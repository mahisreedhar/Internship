const THRONES_API_URL = "https://thronesapi.com/api/v2/Characters";

export async function getThronesCharacters() {
  const response = await fetch(THRONES_API_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch Thrones characters (status: ${response.status})`);
  }

  return response.json();
}
