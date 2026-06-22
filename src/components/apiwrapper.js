import { createAPIClient } from "@wareraprojects/api";

export function getWarEraClient() {
  const apiKey = localStorage.getItem("warera_api_key") || "";

    return createAPIClient({
      apiKey: apiKey !== "" ? apiKey.trim() : null
    })
  
}